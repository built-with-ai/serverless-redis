package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/scaler/serverless-redis/internal/types"
)

// LoadTestResult holds the results of a load test
type LoadTestResult struct {
	TotalRequests    int
	SuccessfulReqs   int
	FailedReqs       int
	TotalDuration    time.Duration
	AvgResponseTime  time.Duration
	MinResponseTime  time.Duration
	MaxResponseTime  time.Duration
	RequestsPerSec   float64
	Errors           []string
}

// ConcurrentLoadTest performs concurrent load testing
func ConcurrentLoadTest(t *testing.T, server *TestServer, numWorkers, requestsPerWorker int, requestFactory func() (*http.Request, error)) *LoadTestResult {
	result := &LoadTestResult{
		TotalRequests:   numWorkers * requestsPerWorker,
		MinResponseTime: time.Hour, // Initialize with large value
		Errors:          make([]string, 0),
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	responseTimes := make([]time.Duration, 0, result.TotalRequests)

	startTime := time.Now()

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()

			for j := 0; j < requestsPerWorker; j++ {
				req, err := requestFactory()
				if err != nil {
					mu.Lock()
					result.Errors = append(result.Errors, fmt.Sprintf("Worker %d, Request %d: %v", workerID, j, err))
					result.FailedReqs++
					mu.Unlock()
					continue
				}

				w := httptest.NewRecorder()
				reqStart := time.Now()
				
				server.router.ServeHTTP(w, req)
				
				responseTime := time.Since(reqStart)

				mu.Lock()
				responseTimes = append(responseTimes, responseTime)
				
				if w.Code == http.StatusOK {
					result.SuccessfulReqs++
				} else {
					result.FailedReqs++
					result.Errors = append(result.Errors, fmt.Sprintf("Worker %d, Request %d: HTTP %d", workerID, j, w.Code))
				}

				if responseTime < result.MinResponseTime {
					result.MinResponseTime = responseTime
				}
				if responseTime > result.MaxResponseTime {
					result.MaxResponseTime = responseTime
				}
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	result.TotalDuration = time.Since(startTime)

	// Calculate average response time
	var totalResponseTime time.Duration
	for _, rt := range responseTimes {
		totalResponseTime += rt
	}
	if len(responseTimes) > 0 {
		result.AvgResponseTime = totalResponseTime / time.Duration(len(responseTimes))
	}

	// Calculate requests per second
	result.RequestsPerSec = float64(result.SuccessfulReqs) / result.TotalDuration.Seconds()

	return result
}

func TestCommandLoadTest(t *testing.T) {
	server := NewTestServer()

	requestFactory := func() (*http.Request, error) {
		reqBody := types.CommandRequest{
			Command: "SET",
			Args:    []interface{}{fmt.Sprintf("load-test-key-%d", time.Now().UnixNano()), "test-value"},
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}

		req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "test-api-key")
		return req, nil
	}

	t.Run("Light Load", func(t *testing.T) {
		result := ConcurrentLoadTest(t, server, 5, 20, requestFactory)
		
		if result.SuccessfulReqs < result.TotalRequests*95/100 {
			t.Errorf("Success rate too low: %d/%d (%.2f%%)", 
				result.SuccessfulReqs, result.TotalRequests, 
				float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
		}

		if result.AvgResponseTime > 10*time.Millisecond {
			t.Errorf("Average response time too high: %v", result.AvgResponseTime)
		}

		t.Logf("Light Load Results: %d requests, %.2f req/sec, avg: %v, max: %v", 
			result.TotalRequests, result.RequestsPerSec, result.AvgResponseTime, result.MaxResponseTime)
	})

	t.Run("Medium Load", func(t *testing.T) {
		result := ConcurrentLoadTest(t, server, 20, 50, requestFactory)
		
		if result.SuccessfulReqs < result.TotalRequests*90/100 {
			t.Errorf("Success rate too low: %d/%d (%.2f%%)", 
				result.SuccessfulReqs, result.TotalRequests, 
				float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
		}

		if result.AvgResponseTime > 50*time.Millisecond {
			t.Errorf("Average response time too high: %v", result.AvgResponseTime)
		}

		t.Logf("Medium Load Results: %d requests, %.2f req/sec, avg: %v, max: %v", 
			result.TotalRequests, result.RequestsPerSec, result.AvgResponseTime, result.MaxResponseTime)
	})

	t.Run("Heavy Load", func(t *testing.T) {
		result := ConcurrentLoadTest(t, server, 50, 100, requestFactory)
		
		if result.SuccessfulReqs < result.TotalRequests*85/100 {
			t.Errorf("Success rate too low: %d/%d (%.2f%%)", 
				result.SuccessfulReqs, result.TotalRequests, 
				float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
		}

		t.Logf("Heavy Load Results: %d requests, %.2f req/sec, avg: %v, max: %v", 
			result.TotalRequests, result.RequestsPerSec, result.AvgResponseTime, result.MaxResponseTime)
		
		if len(result.Errors) > 0 {
			t.Logf("Errors encountered: %d", len(result.Errors))
			for i, err := range result.Errors[:min(5, len(result.Errors))] {
				t.Logf("Error %d: %s", i+1, err)
			}
		}
	})
}

func TestPipelineLoadTest(t *testing.T) {
	server := NewTestServer()

	requestFactory := func() (*http.Request, error) {
		reqBody := types.PipelineRequest{
			Commands: []types.CommandRequest{
				{Command: "SET", Args: []interface{}{fmt.Sprintf("pipe-key1-%d", time.Now().UnixNano()), "value1"}},
				{Command: "SET", Args: []interface{}{fmt.Sprintf("pipe-key2-%d", time.Now().UnixNano()), "value2"}},
				{Command: "GET", Args: []interface{}{"pipe-key1"}},
			},
		}

		body, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}

		req := httptest.NewRequest("POST", "/v1/pipeline", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "test-api-key")
		return req, nil
	}

	result := ConcurrentLoadTest(t, server, 25, 40, requestFactory)
	
	if result.SuccessfulReqs < result.TotalRequests*90/100 {
		t.Errorf("Pipeline success rate too low: %d/%d (%.2f%%)", 
			result.SuccessfulReqs, result.TotalRequests, 
			float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
	}

	t.Logf("Pipeline Load Results: %d requests, %.2f req/sec, avg: %v, max: %v", 
		result.TotalRequests, result.RequestsPerSec, result.AvgResponseTime, result.MaxResponseTime)
}

func TestMixedWorkloadTest(t *testing.T) {
	server := NewTestServer()

	// Factory for mixed request types
	requestFactories := []func() (*http.Request, error){
		// Command requests (70%)
		func() (*http.Request, error) {
			reqBody := types.CommandRequest{
				Command: "SET",
				Args:    []interface{}{fmt.Sprintf("mixed-key-%d", time.Now().UnixNano()), "value"},
			}
			body, _ := json.Marshal(reqBody)
			req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")
			return req, nil
		},
		func() (*http.Request, error) {
			reqBody := types.CommandRequest{
				Command: "GET",
				Args:    []interface{}{"mixed-key"},
			}
			body, _ := json.Marshal(reqBody)
			req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")
			return req, nil
		},
		// Pipeline requests (20%)
		func() (*http.Request, error) {
			reqBody := types.PipelineRequest{
				Commands: []types.CommandRequest{
					{Command: "SET", Args: []interface{}{"pipe1", "value1"}},
					{Command: "SET", Args: []interface{}{"pipe2", "value2"}},
				},
			}
			body, _ := json.Marshal(reqBody)
			req := httptest.NewRequest("POST", "/v1/pipeline", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")
			return req, nil
		},
		// Health requests (10%)
		func() (*http.Request, error) {
			req := httptest.NewRequest("GET", "/health", nil)
			return req, nil
		},
	}

	weights := []int{4, 3, 2, 1} // Weighted selection

	mixedRequestFactory := func() (*http.Request, error) {
		// Weighted random selection
		total := 0
		for _, w := range weights {
			total += w
		}
		
		selection := time.Now().UnixNano() % int64(total)
		current := int64(0)
		
		for i, w := range weights {
			current += int64(w)
			if selection < current {
				return requestFactories[i]()
			}
		}
		
		return requestFactories[0]() // Fallback
	}

	result := ConcurrentLoadTest(t, server, 30, 100, mixedRequestFactory)
	
	if result.SuccessfulReqs < result.TotalRequests*85/100 {
		t.Errorf("Mixed workload success rate too low: %d/%d (%.2f%%)", 
			result.SuccessfulReqs, result.TotalRequests, 
			float64(result.SuccessfulReqs)/float64(result.TotalRequests)*100)
	}

	t.Logf("Mixed Workload Results: %d requests, %.2f req/sec, avg: %v, max: %v", 
		result.TotalRequests, result.RequestsPerSec, result.AvgResponseTime, result.MaxResponseTime)
}

func TestCompressionPerformanceImpact(t *testing.T) {
	server := NewTestServer()

	// Large response test
	largeDataFactory := func(compressed bool) func() (*http.Request, error) {
		return func() (*http.Request, error) {
			req := httptest.NewRequest("GET", "/health", nil)
			if compressed {
				req.Header.Set("Accept-Encoding", "gzip")
			}
			return req, nil
		}
	}

	t.Run("Without Compression", func(t *testing.T) {
		result := ConcurrentLoadTest(t, server, 20, 50, largeDataFactory(false))
		t.Logf("Without Compression: %.2f req/sec, avg: %v", result.RequestsPerSec, result.AvgResponseTime)
	})

	t.Run("With Compression", func(t *testing.T) {
		result := ConcurrentLoadTest(t, server, 20, 50, largeDataFactory(true))
		t.Logf("With Compression: %.2f req/sec, avg: %v", result.RequestsPerSec, result.AvgResponseTime)
	})
}

func TestMemoryUsageUnderLoad(t *testing.T) {
	server := NewTestServer()

	requestFactory := func() (*http.Request, error) {
		reqBody := types.CommandRequest{
			Command: "SET",
			Args:    []interface{}{fmt.Sprintf("memory-test-%d", time.Now().UnixNano()), "test-value"},
		}

		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "test-api-key")
		return req, nil
	}

	// Run load test and check for memory leaks
	initialCacheSize := server.cache.Size()
	
	result := ConcurrentLoadTest(t, server, 10, 100, requestFactory)
	
	finalCacheSize := server.cache.Size()
	
	t.Logf("Memory Test Results: %d requests, cache size: %d -> %d", 
		result.TotalRequests, initialCacheSize, finalCacheSize)
	
	// Cache should not grow excessively
	if finalCacheSize > initialCacheSize+50 {
		t.Errorf("Cache size grew too much: %d -> %d", initialCacheSize, finalCacheSize)
	}
}

func BenchmarkSingleCommand(b *testing.B) {
	server := NewTestServer()

	reqBody := types.CommandRequest{
		Command: "SET",
		Args:    []interface{}{"benchmark-key", "benchmark-value"},
	}

	body, _ := json.Marshal(reqBody)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")

			w := httptest.NewRecorder()
			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				b.Errorf("Expected status 200, got %d", w.Code)
			}
		}
	})
}

func BenchmarkPipeline(b *testing.B) {
	server := NewTestServer()

	reqBody := types.PipelineRequest{
		Commands: []types.CommandRequest{
			{Command: "SET", Args: []interface{}{"bench-key1", "value1"}},
			{Command: "SET", Args: []interface{}{"bench-key2", "value2"}},
			{Command: "GET", Args: []interface{}{"bench-key1"}},
		},
	}

	body, _ := json.Marshal(reqBody)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req := httptest.NewRequest("POST", "/v1/pipeline", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")

			w := httptest.NewRecorder()
			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				b.Errorf("Expected status 200, got %d", w.Code)
			}
		}
	})
}

func BenchmarkHealthEndpoint(b *testing.B) {
	server := NewTestServer()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req := httptest.NewRequest("GET", "/health", nil)
			w := httptest.NewRecorder()
			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				b.Errorf("Expected status 200, got %d", w.Code)
			}
		}
	})
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
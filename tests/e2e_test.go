package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/scaler/serverless-redis/internal/types"
)

// E2ETestSuite represents an end-to-end test suite
type E2ETestSuite struct {
	serverProcess *exec.Cmd
	baseURL       string
	apiKey        string
	httpClient    *http.Client
}

// NewE2ETestSuite creates a new end-to-end test suite
func NewE2ETestSuite() *E2ETestSuite {
	return &E2ETestSuite{
		baseURL:    "http://localhost:8084", // Use different port for E2E tests
		apiKey:     "test-api-key-12345",
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetupServer starts the server for end-to-end testing
func (suite *E2ETestSuite) SetupServer(t *testing.T) {
	// Get the project root directory (one level up from tests/)
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get working directory: %v", err)
	}
	projectRoot := filepath.Dir(wd)
	
	// Build the server binary from project root
	buildCmd := exec.Command("go", "build", "-o", "tests/test-server", "./cmd/server")
	buildCmd.Dir = projectRoot
	output, err := buildCmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Failed to build server: %v\nOutput: %s", err, string(output))
	}

	// Start the server from project root with proper configuration
	suite.serverProcess = exec.Command("./tests/test-server")
	suite.serverProcess.Dir = projectRoot
	suite.serverProcess.Env = append(os.Environ(),
		"PORT=8084",
		"REDIS_URL=localhost:6379",
		"JWT_SECRET=test-e2e-secret",
	)

	if err := suite.serverProcess.Start(); err != nil {
		t.Fatalf("Failed to start server: %v", err)
	}

	// Wait for server to be ready
	suite.waitForServer(t)
}

// TeardownServer stops the server
func (suite *E2ETestSuite) TeardownServer(t *testing.T) {
	if suite.serverProcess != nil {
		if err := suite.serverProcess.Process.Kill(); err != nil {
			t.Errorf("Failed to kill server process: %v", err)
		}
		_ = suite.serverProcess.Wait()
	}

	// Clean up binary
	os.Remove("../test-server")
}

// waitForServer waits for the server to be ready
func (suite *E2ETestSuite) waitForServer(t *testing.T) {
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		resp, err := suite.httpClient.Get(suite.baseURL + "/health")
		if err == nil && resp.StatusCode == http.StatusOK {
			resp.Body.Close()
			return
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(time.Second)
	}
	t.Fatal("Server did not become ready within timeout")
}

// makeRequest makes an authenticated HTTP request
func (suite *E2ETestSuite) makeRequest(method, path string, body interface{}) (*http.Response, error) {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req, err := http.NewRequest(method, suite.baseURL+path, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", suite.apiKey)

	return suite.httpClient.Do(req)
}

// TestE2EBasicOperations tests basic Redis operations end-to-end
func TestE2EBasicOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E tests in short mode")
	}

	// Check if Redis is available
	if !isRedisAvailable() {
		t.Skip("Redis not available, skipping E2E tests")
	}

	suite := NewE2ETestSuite()
	suite.SetupServer(t)
	defer suite.TeardownServer(t)

	t.Run("Health Check", func(t *testing.T) {
		resp, err := suite.httpClient.Get(suite.baseURL + "/health")
		if err != nil {
			t.Fatalf("Health check failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var health types.HealthResponse
		if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
			t.Fatalf("Failed to decode health response: %v", err)
		}

		if health.Status != "healthy" {
			t.Errorf("Expected healthy status, got %s", health.Status)
		}
	})

	t.Run("SET and GET Commands", func(t *testing.T) {
		// SET command
		setReq := types.CommandRequest{
			Command: "SET",
			Args:    []interface{}{"e2e-test-key", "e2e-test-value"},
		}

		resp, err := suite.makeRequest("POST", "/v1/command", setReq)
		if err != nil {
			t.Fatalf("SET request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200 for SET, got %d", resp.StatusCode)
		}

		var setResp types.CommandResponse
		if err := json.NewDecoder(resp.Body).Decode(&setResp); err != nil {
			t.Fatalf("Failed to decode SET response: %v", err)
		}

		if setResp.Result != "OK" {
			t.Errorf("Expected SET result 'OK', got %v", setResp.Result)
		}

		// GET command
		getReq := types.CommandRequest{
			Command: "GET",
			Args:    []interface{}{"e2e-test-key"},
		}

		resp, err = suite.makeRequest("POST", "/v1/command", getReq)
		if err != nil {
			t.Fatalf("GET request failed: %v", err)
		}
		defer resp.Body.Close()

		var getResp types.CommandResponse
		if err := json.NewDecoder(resp.Body).Decode(&getResp); err != nil {
			t.Fatalf("Failed to decode GET response: %v", err)
		}

		if getResp.Result != "e2e-test-value" {
			t.Errorf("Expected GET result 'e2e-test-value', got %v", getResp.Result)
		}
	})

	t.Run("Pipeline Operations", func(t *testing.T) {
		pipelineReq := types.PipelineRequest{
			Commands: []types.CommandRequest{
				{Command: "SET", Args: []interface{}{"pipe1", "value1"}},
				{Command: "SET", Args: []interface{}{"pipe2", "value2"}},
				{Command: "MGET", Args: []interface{}{"pipe1", "pipe2"}},
			},
		}

		resp, err := suite.makeRequest("POST", "/v1/pipeline", pipelineReq)
		if err != nil {
			t.Fatalf("Pipeline request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200 for pipeline, got %d", resp.StatusCode)
		}

		var pipelineResp types.PipelineResponse
		if err := json.NewDecoder(resp.Body).Decode(&pipelineResp); err != nil {
			t.Fatalf("Failed to decode pipeline response: %v", err)
		}

		if pipelineResp.Count != 3 {
			t.Errorf("Expected 3 commands in pipeline, got %d", pipelineResp.Count)
		}

		if len(pipelineResp.Results) != 3 {
			t.Errorf("Expected 3 results, got %d", len(pipelineResp.Results))
		}

		// Check MGET result
		mgetResult := pipelineResp.Results[2].Result
		if mgetResult == nil {
			t.Error("Expected MGET result, got nil")
		}
	})

	t.Run("Transaction Operations", func(t *testing.T) {
		transactionReq := types.TransactionRequest{
			Commands: []types.CommandRequest{
				{Command: "SET", Args: []interface{}{"tx-key", "tx-value"}},
				{Command: "GET", Args: []interface{}{"tx-key"}},
			},
		}

		resp, err := suite.makeRequest("POST", "/v1/transaction", transactionReq)
		if err != nil {
			t.Fatalf("Transaction request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200 for transaction, got %d", resp.StatusCode)
		}

		var transactionResp types.TransactionResponse
		if err := json.NewDecoder(resp.Body).Decode(&transactionResp); err != nil {
			t.Fatalf("Failed to decode transaction response: %v", err)
		}

		if !transactionResp.Exec {
			t.Error("Expected transaction to be executed")
		}

		if transactionResp.Queued != 2 {
			t.Errorf("Expected 2 queued commands, got %d", transactionResp.Queued)
		}
	})

	t.Run("Authentication", func(t *testing.T) {
		// Test without authentication
		req, _ := http.NewRequest("POST", suite.baseURL+"/v1/command", bytes.NewBufferString(`{"command":"GET","args":["test"]}`))
		req.Header.Set("Content-Type", "application/json")

		resp, err := suite.httpClient.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401 without auth, got %d", resp.StatusCode)
		}

		// Test with invalid authentication (create new request)
		req2, _ := http.NewRequest("POST", suite.baseURL+"/v1/command", bytes.NewBufferString(`{"command":"GET","args":["test"]}`))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", "invalid-key")
		
		resp, err = suite.httpClient.Do(req2)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("Expected status 401 with invalid auth, got %d", resp.StatusCode)
		}

		// Test with valid authentication
		req3, _ := http.NewRequest("POST", suite.baseURL+"/v1/command", bytes.NewBufferString(`{"command":"GET","args":["test"]}`))
		req3.Header.Set("Content-Type", "application/json")
		req3.Header.Set("Authorization", suite.apiKey)
		
		resp, err = suite.httpClient.Do(req3)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200 with valid auth, got %d", resp.StatusCode)
		}
	})

	t.Run("Error Handling", func(t *testing.T) {
		// Test invalid command
		invalidReq := types.CommandRequest{
			Command: "INVALID_COMMAND",
			Args:    []interface{}{"test"},
		}

		resp, err := suite.makeRequest("POST", "/v1/command", invalidReq)
		if err != nil {
			t.Fatalf("Invalid command request failed: %v", err)
		}
		defer resp.Body.Close()

		var cmdResp types.CommandResponse
		if err := json.NewDecoder(resp.Body).Decode(&cmdResp); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if cmdResp.Error == "" {
			t.Error("Expected error for invalid command")
		}
	})
}

// TestE2EPerformance tests performance characteristics end-to-end
func TestE2EPerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E performance tests in short mode")
	}

	if !isRedisAvailable() {
		t.Skip("Redis not available, skipping E2E performance tests")
	}

	suite := NewE2ETestSuite()
	suite.SetupServer(t)
	defer suite.TeardownServer(t)

	t.Run("Response Time", func(t *testing.T) {
		cmdReq := types.CommandRequest{
			Command: "SET",
			Args:    []interface{}{"perf-test", "value"},
		}

		start := time.Now()
		resp, err := suite.makeRequest("POST", "/v1/command", cmdReq)
		responseTime := time.Since(start)

		if err != nil {
			t.Fatalf("Performance test request failed: %v", err)
		}
		defer resp.Body.Close()

		if responseTime > 100*time.Millisecond {
			t.Errorf("Response time too slow: %v", responseTime)
		}

		t.Logf("Response time: %v", responseTime)
	})

	t.Run("Concurrent Requests", func(t *testing.T) {
		concurrency := 10
		requests := 50
		
		results := make(chan time.Duration, concurrency*requests)
		errors := make(chan error, concurrency*requests)

		start := time.Now()

		for i := 0; i < concurrency; i++ {
			go func(workerID int) {
				for j := 0; j < requests; j++ {
					reqStart := time.Now()
					
					cmdReq := types.CommandRequest{
						Command: "SET",
						Args:    []interface{}{fmt.Sprintf("concurrent-%d-%d", workerID, j), "value"},
					}

					resp, err := suite.makeRequest("POST", "/v1/command", cmdReq)
					reqTime := time.Since(reqStart)

					if err != nil {
						errors <- err
						continue
					}
					resp.Body.Close()

					if resp.StatusCode == http.StatusOK {
						results <- reqTime
					} else {
						errors <- fmt.Errorf("HTTP %d", resp.StatusCode)
					}
				}
			}(i)
		}

		// Collect results
		successCount := 0
		errorCount := 0
		var totalTime time.Duration

		for i := 0; i < concurrency*requests; i++ {
			select {
			case duration := <-results:
				successCount++
				totalTime += duration
			case err := <-errors:
				errorCount++
				t.Logf("Request error: %v", err)
			case <-time.After(30 * time.Second):
				t.Fatal("Timeout waiting for concurrent requests")
			}
		}

		totalDuration := time.Since(start)
		avgResponseTime := totalTime / time.Duration(successCount)
		throughput := float64(successCount) / totalDuration.Seconds()

		t.Logf("Concurrent test results:")
		t.Logf("  Total requests: %d", concurrency*requests)
		t.Logf("  Successful: %d", successCount)
		t.Logf("  Errors: %d", errorCount)
		t.Logf("  Average response time: %v", avgResponseTime)
		t.Logf("  Throughput: %.2f req/sec", throughput)

		if successCount < (concurrency*requests)*90/100 {
			t.Errorf("Success rate too low: %d/%d", successCount, concurrency*requests)
		}
	})
}

// TestE2ECompression tests compression functionality
func TestE2ECompression(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E compression tests in short mode")
	}

	if !isRedisAvailable() {
		t.Skip("Redis not available, skipping E2E compression tests")
	}

	suite := NewE2ETestSuite()
	suite.SetupServer(t)
	defer suite.TeardownServer(t)

	t.Run("Gzip Compression", func(t *testing.T) {
		req, _ := http.NewRequest("GET", suite.baseURL+"/health", nil)
		req.Header.Set("Accept-Encoding", "gzip")

		resp, err := suite.httpClient.Do(req)
		if err != nil {
			t.Fatalf("Compression test failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.Header.Get("Content-Encoding") != "gzip" {
			t.Error("Expected gzip compression")
		}

		if resp.Header.Get("Vary") != "Accept-Encoding" {
			t.Error("Expected Vary: Accept-Encoding header")
		}
	})
}

// isRedisAvailable checks if Redis is available for testing
func isRedisAvailable() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "redis-cli", "ping")
	err := cmd.Run()
	return err == nil
}
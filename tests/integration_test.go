package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/scaler/serverless-redis/internal/types"
)

// Integration Tests

func TestCommandEndpoint(t *testing.T) {
	server := NewTestServer()

	tests := []struct {
		name           string
		command        string
		args           []interface{}
		expectedResult interface{}
		expectError    bool
	}{
		{
			name:           "SET command",
			command:        "SET",
			args:           []interface{}{"test-key", "test-value"},
			expectedResult: "OK",
			expectError:    false,
		},
		{
			name:           "GET command",
			command:        "GET",
			args:           []interface{}{"test-key"},
			expectedResult: "test-value",
			expectError:    false,
		},
		{
			name:           "INCR command",
			command:        "INCR",
			args:           []interface{}{"counter"},
			expectedResult: float64(1), // JSON unmarshals numbers as float64
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reqBody := types.CommandRequest{
				Command: tt.command,
				Args:    tt.args,
			}

			body, _ := json.Marshal(reqBody)
			req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "test-api-key")

			w := httptest.NewRecorder()
			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Expected status 200, got %d", w.Code)
			}

			var response types.CommandResponse
			err := json.Unmarshal(w.Body.Bytes(), &response)
			if err != nil {
				t.Fatalf("Failed to unmarshal response: %v", err)
			}

			if tt.expectError && response.Error == "" {
				t.Error("Expected error but got none")
			}

			if !tt.expectError && response.Error != "" {
				t.Errorf("Expected no error but got: %s", response.Error)
			}

			if !tt.expectError && response.Result != tt.expectedResult {
				t.Errorf("Expected result %v, got %v", tt.expectedResult, response.Result)
			}
		})
	}
}

func TestPipelineEndpoint(t *testing.T) {
	server := NewTestServer()

	reqBody := types.PipelineRequest{
		Commands: []types.CommandRequest{
			{Command: "SET", Args: []interface{}{"key1", "value1"}},
			{Command: "SET", Args: []interface{}{"key2", "value2"}},
			{Command: "MGET", Args: []interface{}{"key1", "key2"}},
		},
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/v1/pipeline", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "test-api-key")

	w := httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response types.PipelineResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Count != 3 {
		t.Errorf("Expected count 3, got %d", response.Count)
	}

	if len(response.Results) != 3 {
		t.Errorf("Expected 3 results, got %d", len(response.Results))
	}

	// Check individual results
	if response.Results[0].Result != "OK" {
		t.Errorf("Expected first result 'OK', got %v", response.Results[0].Result)
	}

	if response.Results[1].Result != "OK" {
		t.Errorf("Expected second result 'OK', got %v", response.Results[1].Result)
	}
}

func TestTransactionEndpoint(t *testing.T) {
	server := NewTestServer()

	reqBody := types.TransactionRequest{
		Commands: []types.CommandRequest{
			{Command: "SET", Args: []interface{}{"tx-key", "tx-value"}},
			{Command: "GET", Args: []interface{}{"tx-key"}},
		},
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/v1/transaction", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "test-api-key")

	w := httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response types.TransactionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if !response.Exec {
		t.Error("Expected transaction to be executed")
	}

	if response.Queued != 2 {
		t.Errorf("Expected 2 queued commands, got %d", response.Queued)
	}

	if len(response.Results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(response.Results))
	}
}

func TestHealthEndpoint(t *testing.T) {
	server := NewTestServer()

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response types.HealthResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got %s", response.Status)
	}

	if response.Version != "test-1.0.0" {
		t.Errorf("Expected version 'test-1.0.0', got %s", response.Version)
	}

	if response.Connections["active"] != 5 {
		t.Errorf("Expected 5 active connections, got %d", response.Connections["active"])
	}
}

func TestAuthentication(t *testing.T) {
	server := NewTestServer()

	reqBody := types.CommandRequest{
		Command: "SET",
		Args:    []interface{}{"auth-test", "value"},
	}

	body, _ := json.Marshal(reqBody)

	// Test without authentication
	req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 without auth, got %d", w.Code)
	}

	// Test with invalid API key
	req.Header.Set("Authorization", "invalid-key")
	w = httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401 with invalid auth, got %d", w.Code)
	}

	// Test with valid API key
	req.Header.Set("Authorization", "test-api-key")
	w = httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200 with valid auth, got %d", w.Code)
	}
}

func TestCompressionIntegration(t *testing.T) {
	server := NewTestServer()

	req := httptest.NewRequest("GET", "/health", nil)
	req.Header.Set("Accept-Encoding", "gzip")

	w := httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Error("Expected gzip compression")
	}

	if w.Header().Get("Vary") != "Accept-Encoding" {
		t.Error("Expected Vary header")
	}
}

func TestCachingIntegration(t *testing.T) {
	server := NewTestServer()

	// First request - should miss cache
	req := httptest.NewRequest("GET", "/health", nil)
	w1 := httptest.NewRecorder()
	server.router.ServeHTTP(w1, req)

	if w1.Header().Get("X-Cache") != "MISS" {
		t.Error("Expected cache miss on first request")
	}

	// Second request - should hit cache
	w2 := httptest.NewRecorder()
	server.router.ServeHTTP(w2, req)

	if w2.Header().Get("X-Cache") != "HIT" {
		t.Error("Expected cache hit on second request")
	}

	// Responses should be identical
	if w1.Body.String() != w2.Body.String() {
		t.Error("Expected identical responses from cache")
	}
}

func TestErrorHandling(t *testing.T) {
	server := NewTestServer()

	// Set up mock to return error
	server.redisClient.SetError("INVALID", fmt.Errorf("ERR unknown command 'INVALID'"))

	reqBody := types.CommandRequest{
		Command: "INVALID",
		Args:    []interface{}{"test"},
	}

	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/v1/command", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "test-api-key")

	w := httptest.NewRecorder()
	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response types.CommandResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Error == "" {
		t.Error("Expected error in response")
	}

	if response.Error != "ERR unknown command 'INVALID'" {
		t.Errorf("Expected specific error message, got %s", response.Error)
	}
}
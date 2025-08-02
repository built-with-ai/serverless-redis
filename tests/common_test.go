package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/scaler/serverless-redis/internal/auth"
	"github.com/scaler/serverless-redis/internal/server"
	"github.com/scaler/serverless-redis/internal/types"
)

// MockRedisClient implements a mock Redis client for testing
type MockRedisClient struct {
	mu          sync.RWMutex
	data        map[string]interface{}
	commands    []string
	errorOnCmd  map[string]error
	pipelineRes []types.CommandResponse
}

func NewMockRedisClient() *MockRedisClient {
	return &MockRedisClient{
		data:       make(map[string]interface{}),
		commands:   make([]string, 0),
		errorOnCmd: make(map[string]error),
	}
}

func (m *MockRedisClient) ExecuteCommand(ctx context.Context, req types.CommandRequest) (interface{}, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.commands = append(m.commands, req.Command)
	
	if err, exists := m.errorOnCmd[req.Command]; exists {
		return nil, err
	}

	switch req.Command {
	case "SET":
		if len(req.Args) >= 2 {
			key := req.Args[0].(string)
			value := req.Args[1]
			m.data[key] = value
			return "OK", nil
		}
	case "GET":
		if len(req.Args) >= 1 {
			key := req.Args[0].(string)
			if value, exists := m.data[key]; exists {
				return value, nil
			}
			return nil, nil
		}
	case "INCR":
		if len(req.Args) >= 1 {
			key := req.Args[0].(string)
			if val, exists := m.data[key]; exists {
				if intVal, ok := val.(int); ok {
					m.data[key] = intVal + 1
					return intVal + 1, nil
				}
			}
			m.data[key] = 1
			return 1, nil
		}
	case "MGET":
		results := make([]interface{}, len(req.Args))
		for i, arg := range req.Args {
			key := arg.(string)
			if value, exists := m.data[key]; exists {
				results[i] = value
			} else {
				results[i] = nil
			}
		}
		return results, nil
	}

	return "OK", nil
}

func (m *MockRedisClient) ExecutePipeline(ctx context.Context, req types.PipelineRequest) []types.CommandResponse {
	if m.pipelineRes != nil {
		return m.pipelineRes
	}

	results := make([]types.CommandResponse, len(req.Commands))
	for i, cmdReq := range req.Commands {
		result, err := m.ExecuteCommand(ctx, cmdReq)
		response := types.CommandResponse{
			Time: 1.0,
		}
		
		if err != nil {
			response.Error = err.Error()
		} else {
			response.Result = result
			response.Type = "string"
		}
		
		results[i] = response
	}
	
	return results
}

func (m *MockRedisClient) ExecuteTransaction(ctx context.Context, req types.TransactionRequest) (*types.TransactionResponse, error) {
	results := make([]types.CommandResponse, len(req.Commands))
	for i, cmdReq := range req.Commands {
		result, err := m.ExecuteCommand(ctx, cmdReq)
		response := types.CommandResponse{
			Time: 1.0,
		}
		
		if err != nil {
			response.Error = err.Error()
		} else {
			response.Result = result
			response.Type = "string"
		}
		
		results[i] = response
	}

	return &types.TransactionResponse{
		Results: results,
		Queued:  len(req.Commands),
		Exec:    true,
		Time:    5.0,
	}, nil
}

func (m *MockRedisClient) GetConnectionStats() map[string]int {
	return map[string]int{
		"active": 5,
		"idle":   10,
		"total":  15,
	}
}

func (m *MockRedisClient) Close() error {
	return nil
}

func (m *MockRedisClient) SetError(command string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.errorOnCmd[command] = err
}

func (m *MockRedisClient) SetPipelineResponse(responses []types.CommandResponse) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pipelineRes = responses
}

func (m *MockRedisClient) GetExecutedCommands() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	commands := make([]string, len(m.commands))
	copy(commands, m.commands)
	return commands
}

// MockMetricsCollector is a no-op metrics collector for testing
type MockMetricsCollector struct{}

func (m *MockMetricsCollector) RecordHTTPRequest(method, endpoint, status string, tenant *types.Tenant, duration time.Duration) {}
func (m *MockMetricsCollector) RecordHTTPError(method, endpoint, errorType string, tenant *types.Tenant) {}
func (m *MockMetricsCollector) RecordRedisCommand(command, status string, tenant *types.Tenant, duration time.Duration) {}
func (m *MockMetricsCollector) RecordRedisError(command, errorType string, tenant *types.Tenant) {}
func (m *MockMetricsCollector) UpdatePoolStats(poolName string, stats map[string]int) {}
func (m *MockMetricsCollector) UpdateSystemMetrics() {}
func (m *MockMetricsCollector) GetMemoryStats() types.MemoryStats {
	return types.MemoryStats{
		Alloc:        1024,
		TotalAlloc:   2048,
		Sys:          4096,
		NumGC:        5,
		NumGoroutine: 10,
	}
}
func (m *MockMetricsCollector) GetUptime() int64 { return 3600 }
func (m *MockMetricsCollector) StartPeriodicUpdates(ctx context.Context, interval time.Duration) {}
func (m *MockMetricsCollector) HTTPMetricsMiddleware(next http.Handler) http.Handler { return next }

// Test Server setup
type TestServer struct {
	redisClient *MockRedisClient
	authManager *auth.Manager
	metrics     *MockMetricsCollector
	cache       *server.InMemoryCache
	router      *mux.Router
}

func NewTestServer() *TestServer {
	redisClient := NewMockRedisClient()
	
	authConfig := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
		APIKeys: []types.APIKey{
			{
				Key:         "test-api-key",
				TenantID:    "test-tenant",
				RateLimit:   1000,
				AllowedDBs:  []int{0, 1, 2},
				Permissions: []string{"*"},
			},
		},
	}
	
	authManager := auth.NewManager(authConfig)
	// Use a mock metrics collector to avoid Prometheus registration conflicts in tests
	metricsCollector := &MockMetricsCollector{}
	cache := server.NewInMemoryCache(100)

	ts := &TestServer{
		redisClient: redisClient,
		authManager: authManager,
		metrics:     metricsCollector,
		cache:       cache,
	}

	ts.setupRoutes()
	return ts
}

func (ts *TestServer) setupRoutes() {
	router := mux.NewRouter()

	// Add middleware stack
	router.Use(server.KeepAliveMiddleware)
	router.Use(server.ContentEncodingMiddleware)
	router.Use(server.CachingMiddleware(ts.cache))

	// API routes
	api := router.PathPrefix("/v1").Subrouter()
	api.Use(ts.authManager.AuthMiddleware)

	api.HandleFunc("/command", ts.handleCommand).Methods("POST")
	api.HandleFunc("/pipeline", ts.handlePipeline).Methods("POST")
	api.HandleFunc("/transaction", ts.handleTransaction).Methods("POST")

	// Health endpoint
	router.HandleFunc("/health", ts.handleHealth).Methods("GET")

	ts.router = router
}

func (ts *TestServer) handleCommand(w http.ResponseWriter, r *http.Request) {
	var req types.CommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	result, err := ts.redisClient.ExecuteCommand(r.Context(), req)
	
	response := types.CommandResponse{
		Time: 1.0,
		Type: "string",
	}
	
	if err != nil {
		response.Error = err.Error()
	} else {
		response.Result = result
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (ts *TestServer) handlePipeline(w http.ResponseWriter, r *http.Request) {
	var req types.PipelineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	results := ts.redisClient.ExecutePipeline(r.Context(), req)

	response := types.PipelineResponse{
		Results: results,
		Time:    5.0,
		Count:   len(req.Commands),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (ts *TestServer) handleTransaction(w http.ResponseWriter, r *http.Request) {
	var req types.TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	result, err := ts.redisClient.ExecuteTransaction(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (ts *TestServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	response := types.HealthResponse{
		Status:      "healthy",
		Version:     "test-1.0.0",
		Connections: ts.redisClient.GetConnectionStats(),
		Uptime:      3600,
		Memory: types.MemoryStats{
			Alloc:        1024,
			TotalAlloc:   2048,
			Sys:          4096,
			NumGC:        5,
			NumGoroutine: 10,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
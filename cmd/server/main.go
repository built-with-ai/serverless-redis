package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	
	"github.com/scaler/serverless-redis/internal/auth"
	"github.com/scaler/serverless-redis/internal/config"
	"github.com/scaler/serverless-redis/internal/metrics"
	"github.com/scaler/serverless-redis/internal/redis"
	"github.com/scaler/serverless-redis/internal/server"
	"github.com/scaler/serverless-redis/internal/types"
)

const Version = "1.0.0-optimized"

type Server struct {
	config      *types.Config
	redisClient *redis.Client
	authManager *auth.Manager
	metrics     *metrics.Collector
	cache       *server.InMemoryCache
	startTime   time.Time
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize server
	server, err := NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}
	defer server.Close()

	// Setup routes
	router := server.setupRoutes()

	// Create HTTP server
	httpServer := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start background services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	
	if cfg.Metrics.Enabled {
		go server.metrics.StartPeriodicUpdates(ctx, 30*time.Second)
	}
	
	// Start cache cleanup (simple background cleanup)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				server.cache.ClearExpired()
			}
		}
	}()

	// Start server
	go func() {
		fmt.Printf("🚀 Optimized Serverless Redis Proxy v%s starting on %s\n", Version, httpServer.Addr)
		fmt.Printf("📊 Metrics endpoint: http://%s%s\n", httpServer.Addr, cfg.Metrics.Path)
		fmt.Printf("🔒 Authentication: %v\n", cfg.Auth.Enabled)
		fmt.Printf("🗄️  Redis: %s\n", cfg.Redis.Primary.Addr)
		fmt.Printf("🚀 HTTP/2: %v\n", cfg.Server.HTTP2.Enabled)
		fmt.Printf("🗜️  Compression: enabled\n")
		fmt.Printf("💾 Caching: enabled\n")
		fmt.Printf("📡 Streaming: /v1/stream/pipeline\n")
		if cfg.Redis.Dragonfly.Enabled {
			fmt.Printf("🐲 DragonflyDB: %s\n", cfg.Redis.Dragonfly.Addr)
		}
		
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("\n🛑 Shutting down server...")

	// Graceful shutdown
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	fmt.Println("✅ Server gracefully stopped")
}

func NewServer(cfg *types.Config) (*Server, error) {
	// Initialize Redis client
	redisClient, err := redis.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	// Initialize auth manager
	authManager := auth.NewManager(&cfg.Auth)

	// Initialize metrics collector
	metricsCollector := metrics.NewCollector()

	// Initialize cache
	cache := server.NewInMemoryCache(1000) // Cache up to 1000 entries

	return &Server{
		config:      cfg,
		redisClient: redisClient,
		authManager: authManager,
		metrics:     metricsCollector,
		cache:       cache,
		startTime:   time.Now(),
	}, nil
}

func (s *Server) setupRoutes() *mux.Router {
	router := mux.NewRouter()

	// Apply performance middleware stack (order matters!)
	router.Use(server.KeepAliveMiddleware)
	router.Use(server.HTTP2OptimizationMiddleware)
	router.Use(server.ServerPushMiddleware)
	router.Use(server.ContentEncodingMiddleware) // Compression
	
	// Add caching middleware
	router.Use(server.CachingMiddleware(s.cache))

	// Add metrics middleware if enabled
	if s.config.Metrics.Enabled {
		router.Use(func(next http.Handler) http.Handler {
			return s.metrics.HTTPMetricsMiddleware(next)
		})
	}

	// API routes with authentication
	api := router.PathPrefix("/v1").Subrouter()
	if s.config.Auth.Enabled {
		api.Use(s.authManager.AuthMiddleware)
	}

	api.HandleFunc("/command", s.handleCommand).Methods("POST")
	api.HandleFunc("/pipeline", s.handlePipeline).Methods("POST")
	api.HandleFunc("/transaction", s.handleTransaction).Methods("POST")
	
	// Optimized streaming endpoint (disabled for now)
	// api.HandleFunc("/stream/pipeline", s.handleStreamingPipeline).Methods("POST")

	// Health and metrics endpoints (no auth required)
	router.HandleFunc("/health", s.handleHealth).Methods("GET")
	if s.config.Metrics.Enabled {
		router.Handle(s.config.Metrics.Path, promhttp.Handler()).Methods("GET")
	}

	// CORS middleware for browser requests
	router.Use(corsMiddleware)

	return router
}

func (s *Server) handleCommand(w http.ResponseWriter, r *http.Request) {
	var req types.CommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeErrorResponse(w, "Invalid JSON", http.StatusBadRequest, err)
		return
	}

	// Get tenant from context
	tenant, _ := auth.GetTenantFromContext(r.Context())

	// Validate permissions
	if tenant != nil {
		if err := s.authManager.ValidateCommand(tenant, req.Command); err != nil {
			s.writeErrorResponse(w, "Command not permitted", http.StatusForbidden, err)
			return
		}

		if err := s.authManager.ValidateDatabase(tenant, req.DB); err != nil {
			s.writeErrorResponse(w, "Database not permitted", http.StatusForbidden, err)
			return
		}
	}

	// Execute command
	start := time.Now()
	result, err := s.redisClient.ExecuteCommand(r.Context(), req)
	duration := time.Since(start)

	// Record metrics
	status := "success"
	if err != nil {
		status = "error"
		s.metrics.RecordRedisError(req.Command, getRedisErrorType(err), tenant)
	}
	s.metrics.RecordRedisCommand(req.Command, status, tenant, duration)

	// Build response
	response := types.CommandResponse{
		Result: result,
		Time:   duration.Seconds() * 1000, // Convert to milliseconds
		Type:   string(inferResponseType(result)),
	}

	if err != nil {
		response.Error = err.Error()
	}

	s.writeJSONResponse(w, response)
}

func (s *Server) handlePipeline(w http.ResponseWriter, r *http.Request) {
	var req types.PipelineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeErrorResponse(w, "Invalid JSON", http.StatusBadRequest, err)
		return
	}

	// Get tenant from context
	tenant, _ := auth.GetTenantFromContext(r.Context())

	// Validate all commands
	if tenant != nil {
		for _, cmdReq := range req.Commands {
			if err := s.authManager.ValidateCommand(tenant, cmdReq.Command); err != nil {
				s.writeErrorResponse(w, "Command not permitted", http.StatusForbidden, err)
				return
			}
		}

		if err := s.authManager.ValidateDatabase(tenant, req.DB); err != nil {
			s.writeErrorResponse(w, "Database not permitted", http.StatusForbidden, err)
			return
		}
	}

	// Execute pipeline
	start := time.Now()
	results := s.redisClient.ExecutePipeline(r.Context(), req)
	duration := time.Since(start)

	// Record metrics for each command
	for i, cmdReq := range req.Commands {
		status := "success"
		if results[i].Error != "" {
			status = "error"
			s.metrics.RecordRedisError(cmdReq.Command, getRedisErrorType(fmt.Errorf("%s", results[i].Error)), tenant)
		}
		s.metrics.RecordRedisCommand(cmdReq.Command, status, tenant, duration/time.Duration(len(req.Commands)))
	}

	response := types.PipelineResponse{
		Results: results,
		Time:    duration.Seconds() * 1000, // Convert to milliseconds
		Count:   len(req.Commands),
	}

	s.writeJSONResponse(w, response)
}

func (s *Server) handleTransaction(w http.ResponseWriter, r *http.Request) {
	var req types.TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeErrorResponse(w, "Invalid JSON", http.StatusBadRequest, err)
		return
	}

	// Get tenant from context
	tenant, _ := auth.GetTenantFromContext(r.Context())

	// Validate all commands
	if tenant != nil {
		for _, cmdReq := range req.Commands {
			if err := s.authManager.ValidateCommand(tenant, cmdReq.Command); err != nil {
				s.writeErrorResponse(w, "Command not permitted", http.StatusForbidden, err)
				return
			}
		}

		if err := s.authManager.ValidateDatabase(tenant, req.DB); err != nil {
			s.writeErrorResponse(w, "Database not permitted", http.StatusForbidden, err)
			return
		}
	}

	// Execute transaction
	start := time.Now()
	response, err := s.redisClient.ExecuteTransaction(r.Context(), req)
	duration := time.Since(start)

	if err != nil {
		s.writeErrorResponse(w, "Transaction failed", http.StatusInternalServerError, err)
		return
	}

	// Record metrics
	for _, cmdReq := range req.Commands {
		status := "success"
		if !response.Exec {
			status = "discarded"
		}
		s.metrics.RecordRedisCommand(cmdReq.Command, status, tenant, duration/time.Duration(len(req.Commands)))
	}

	s.writeJSONResponse(w, response)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	connectionStats := s.redisClient.GetConnectionStats()
	
	response := types.HealthResponse{
		Status:      "healthy",
		Version:     Version,
		Connections: connectionStats,
		Uptime:      s.metrics.GetUptime(),
		Memory:      s.metrics.GetMemoryStats(),
	}

	// Add cache statistics
	response.Connections["cache_entries"] = s.cache.Size()

	s.writeJSONResponse(w, response)
}

// Optimized streaming pipeline handler (commented out for now)
// func (s *Server) handleStreamingPipeline(w http.ResponseWriter, r *http.Request) {
// 	// Create a server handler for streaming
// 	serverHandler := &server.ServerHandler{
// 		RedisClient: s.redisClient,
// 		AuthManager: s.authManager,
// 		Metrics:     s.metrics,
// 	}
// 	
// 	serverHandler.StreamingPipelineHandler(w, r)
// }

func (s *Server) writeJSONResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) writeErrorResponse(w http.ResponseWriter, message string, status int, err error) {
	response := types.ErrorResponse{
		Error:   message,
		Code:    http.StatusText(status),
		Details: err.Error(),
		Time:    time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}

func (s *Server) Close() error {
	if s.redisClient != nil {
		return s.redisClient.Close()
	}
	return nil
}

// Helper functions
func inferResponseType(val interface{}) types.ResponseType {
	if val == nil {
		return types.ResponseTypeNil
	}

	switch val.(type) {
	case string:
		return types.ResponseTypeString
	case int, int64, uint64:
		return types.ResponseTypeInteger
	case float64:
		return types.ResponseTypeFloat
	case bool:
		return types.ResponseTypeBool
	case []interface{}:
		return types.ResponseTypeArray
	case map[string]interface{}:
		return types.ResponseTypeHash
	default:
		return types.ResponseTypeString
	}
}

func getRedisErrorType(err error) string {
	errStr := strings.ToUpper(err.Error())
	
	switch {
	case strings.Contains(errStr, "WRONGTYPE"):
		return "wrong_type"
	case strings.Contains(errStr, "NOAUTH"):
		return "no_auth"
	case strings.Contains(errStr, "NOPERM"):
		return "no_permission"
	case strings.Contains(errStr, "READONLY"):
		return "readonly"
	case strings.Contains(errStr, "OOM"):
		return "out_of_memory"
	case strings.Contains(errStr, "EXECABORT"):
		return "exec_abort"
	case strings.Contains(errStr, "TIMEOUT"):
		return "timeout"
	default:
		return "other"
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
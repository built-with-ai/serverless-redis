package metrics

import (
	"context"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/scaler/serverless-redis/internal/auth"
	"github.com/scaler/serverless-redis/internal/types"
)

type Collector struct {
	// HTTP metrics
	httpRequests    *prometheus.CounterVec
	httpDuration    *prometheus.HistogramVec
	httpErrors      *prometheus.CounterVec
	
	// Redis metrics
	redisCommands   *prometheus.CounterVec
	redisLatency    *prometheus.HistogramVec
	redisErrors     *prometheus.CounterVec
	
	// Connection pool metrics
	poolConnections *prometheus.GaugeVec
	poolHits        *prometheus.CounterVec
	poolMisses      *prometheus.CounterVec
	
	// System metrics
	memoryUsage     prometheus.Gauge
	goroutines      prometheus.Gauge
	uptime          prometheus.Gauge
	
	startTime       time.Time
}

func NewCollector() *Collector {
	return &Collector{
		httpRequests: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "endpoint", "status", "tenant"},
		),
		
		httpDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "redis_proxy_http_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "endpoint", "tenant"},
		),
		
		httpErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_http_errors_total",
				Help: "Total number of HTTP errors",
			},
			[]string{"method", "endpoint", "error_type", "tenant"},
		),
		
		redisCommands: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_redis_commands_total",
				Help: "Total number of Redis commands executed",
			},
			[]string{"command", "status", "tenant"},
		),
		
		redisLatency: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "redis_proxy_redis_latency_seconds",
				Help:    "Redis command latency in seconds",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0},
			},
			[]string{"command", "tenant"},
		),
		
		redisErrors: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_redis_errors_total",
				Help: "Total number of Redis errors",
			},
			[]string{"command", "error_type", "tenant"},
		),
		
		poolConnections: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "redis_proxy_pool_connections",
				Help: "Current number of connections in pool",
			},
			[]string{"pool", "state"},
		),
		
		poolHits: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_pool_hits_total",
				Help: "Total number of connection pool hits",
			},
			[]string{"pool"},
		),
		
		poolMisses: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "redis_proxy_pool_misses_total",
				Help: "Total number of connection pool misses",
			},
			[]string{"pool"},
		),
		
		memoryUsage: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "redis_proxy_memory_usage_bytes",
				Help: "Current memory usage in bytes",
			},
		),
		
		goroutines: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "redis_proxy_goroutines",
				Help: "Current number of goroutines",
			},
		),
		
		uptime: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "redis_proxy_uptime_seconds",
				Help: "Server uptime in seconds",
			},
		),
		
		startTime: time.Now(),
	}
}

func (c *Collector) RecordHTTPRequest(method, endpoint, status string, tenant *types.Tenant, duration time.Duration) {
	tenantID := "unknown"
	if tenant != nil {
		tenantID = tenant.ID
	}
	
	c.httpRequests.WithLabelValues(method, endpoint, status, tenantID).Inc()
	c.httpDuration.WithLabelValues(method, endpoint, tenantID).Observe(duration.Seconds())
}

func (c *Collector) RecordHTTPError(method, endpoint, errorType string, tenant *types.Tenant) {
	tenantID := "unknown"
	if tenant != nil {
		tenantID = tenant.ID
	}
	
	c.httpErrors.WithLabelValues(method, endpoint, errorType, tenantID).Inc()
}

func (c *Collector) RecordRedisCommand(command, status string, tenant *types.Tenant, duration time.Duration) {
	tenantID := "unknown"
	if tenant != nil {
		tenantID = tenant.ID
	}
	
	c.redisCommands.WithLabelValues(command, status, tenantID).Inc()
	c.redisLatency.WithLabelValues(command, tenantID).Observe(duration.Seconds())
}

func (c *Collector) RecordRedisError(command, errorType string, tenant *types.Tenant) {
	tenantID := "unknown"
	if tenant != nil {
		tenantID = tenant.ID
	}
	
	c.redisErrors.WithLabelValues(command, errorType, tenantID).Inc()
}

func (c *Collector) UpdatePoolStats(poolName string, stats map[string]int) {
	for statName, value := range stats {
		switch statName {
		case "total_conns":
			c.poolConnections.WithLabelValues(poolName, "total").Set(float64(value))
		case "idle_conns":
			c.poolConnections.WithLabelValues(poolName, "idle").Set(float64(value))
		case "stale_conns":
			c.poolConnections.WithLabelValues(poolName, "stale").Set(float64(value))
		case "hits":
			c.poolHits.WithLabelValues(poolName).Add(float64(value))
		case "misses":
			c.poolMisses.WithLabelValues(poolName).Add(float64(value))
		}
	}
}

func (c *Collector) UpdateSystemMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	c.memoryUsage.Set(float64(m.Alloc))
	c.goroutines.Set(float64(runtime.NumGoroutine()))
	c.uptime.Set(time.Since(c.startTime).Seconds())
}

func (c *Collector) GetMemoryStats() types.MemoryStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return types.MemoryStats{
		Alloc:        m.Alloc,
		TotalAlloc:   m.TotalAlloc,
		Sys:          m.Sys,
		NumGC:        m.NumGC,
		NumGoroutine: runtime.NumGoroutine(),
	}
}

func (c *Collector) GetUptime() int64 {
	return int64(time.Since(c.startTime).Seconds())
}

// Background metrics updater
func (c *Collector) StartPeriodicUpdates(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.UpdateSystemMetrics()
		}
	}
}

// Middleware for automatic HTTP metrics collection
func (c *Collector) HTTPMetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Wrap response writer to capture status code
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		
		// Execute request
		next.ServeHTTP(wrapped, r)
		
		// Record metrics
		duration := time.Since(start)
		tenant, _ := auth.GetTenantFromContext(r.Context())
		endpoint := getEndpointFromPath(r.URL.Path)
		
		c.RecordHTTPRequest(r.Method, endpoint, statusCodeToString(wrapped.statusCode), tenant, duration)
		
		if wrapped.statusCode >= 400 {
			errorType := getErrorTypeFromStatus(wrapped.statusCode)
			c.RecordHTTPError(r.Method, endpoint, errorType, tenant)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func statusCodeToString(code int) string {
	switch {
	case code >= 200 && code < 300:
		return "2xx"
	case code >= 300 && code < 400:
		return "3xx"
	case code >= 400 && code < 500:
		return "4xx"
	case code >= 500:
		return "5xx"
	default:
		return "unknown"
	}
}

func getErrorTypeFromStatus(code int) string {
	switch code {
	case 400:
		return "bad_request"
	case 401:
		return "unauthorized"
	case 403:
		return "forbidden"
	case 404:
		return "not_found"
	case 429:
		return "rate_limited"
	case 500:
		return "internal_error"
	case 502:
		return "bad_gateway"
	case 503:
		return "service_unavailable"
	case 504:
		return "gateway_timeout"
	default:
		return "other"
	}
}

func getEndpointFromPath(path string) string {
	switch {
	case strings.HasPrefix(path, "/v1/command"):
		return "/v1/command"
	case strings.HasPrefix(path, "/v1/pipeline"):
		return "/v1/pipeline"
	case strings.HasPrefix(path, "/v1/transaction"):
		return "/v1/transaction"
	case strings.HasPrefix(path, "/health"):
		return "/health"
	case strings.HasPrefix(path, "/metrics"):
		return "/metrics"
	default:
		return "other"
	}
}
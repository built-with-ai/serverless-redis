package server

import (
	"crypto/tls"
	"net/http"
	"time"
)

// HTTP2Config holds configuration for HTTP/2 server
type HTTP2Config struct {
	Enabled              bool          `yaml:"enabled"`
	MaxConcurrentStreams uint32        `yaml:"max_concurrent_streams"`
	MaxFrameSize         uint32        `yaml:"max_frame_size"`
	MaxHeaderListSize    uint32        `yaml:"max_header_list_size"`
	IdleTimeout          time.Duration `yaml:"idle_timeout"`
	ReadTimeout          time.Duration `yaml:"read_timeout"`
	WriteTimeout         time.Duration `yaml:"write_timeout"`
}

// ConfigureHTTP2Server configures HTTP/2 server with optimized settings
func ConfigureHTTP2Server(server *http.Server, config HTTP2Config) *http.Server {
	if !config.Enabled {
		// Disable HTTP/2 if not enabled
		server.TLSNextProto = make(map[string]func(*http.Server, *tls.Conn, http.Handler))
		return server
	}

	// Configure HTTP/2 specific settings
	if config.MaxConcurrentStreams == 0 {
		config.MaxConcurrentStreams = 1000 // Default for high concurrency
	}
	
	if config.MaxFrameSize == 0 {
		config.MaxFrameSize = 1048576 // 1MB frames for large payloads
	}
	
	if config.MaxHeaderListSize == 0 {
		config.MaxHeaderListSize = 262144 // 256KB headers
	}

	// Set timeouts optimized for serverless
	if config.IdleTimeout > 0 {
		server.IdleTimeout = config.IdleTimeout
	} else {
		server.IdleTimeout = 120 * time.Second
	}

	if config.ReadTimeout > 0 {
		server.ReadTimeout = config.ReadTimeout
	} else {
		server.ReadTimeout = 30 * time.Second
	}

	if config.WriteTimeout > 0 {
		server.WriteTimeout = config.WriteTimeout
	} else {
		server.WriteTimeout = 30 * time.Second
	}

	return server
}

// CreateOptimizedTLSConfig creates TLS config optimized for HTTP/2 and performance
func CreateOptimizedTLSConfig() *tls.Config {
	return &tls.Config{
		// HTTP/2 requires TLS 1.2+
		MinVersion: tls.VersionTLS12,
		
		// Optimize cipher suites for performance and security
		CipherSuites: []uint16{
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
		},
		
		// Enable HTTP/2
		NextProtos: []string{"h2", "http/1.1"},
		
		// Performance optimizations
		PreferServerCipherSuites: true,
		SessionTicketsDisabled:   false, // Enable session resumption
		
		// Curve preferences for ECDHE
		CurvePreferences: []tls.CurveID{
			tls.X25519,
			tls.CurveP256,
			tls.CurveP384,
		},
	}
}

// KeepAliveMiddleware configures connection keep-alive for HTTP/1.1 and HTTP/2
func KeepAliveMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set keep-alive headers for HTTP/1.1
		if r.ProtoMajor == 1 {
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("Keep-Alive", "timeout=60, max=1000")
		}
		
		// HTTP/2 handles connection multiplexing automatically
		
		next.ServeHTTP(w, r)
	})
}

// ServerPushMiddleware implements HTTP/2 server push for related resources
func ServerPushMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is HTTP/2 and supports server push
		if pusher, ok := w.(http.Pusher); ok && r.ProtoMajor == 2 {
			// For health endpoint, preemptively push metrics
			if r.URL.Path == "/health" {
				pushOptions := &http.PushOptions{
					Method: "GET",
					Header: http.Header{
						"Accept": []string{"text/plain"},
					},
				}
				// Push metrics endpoint (non-blocking)
				go func() {
					_ = pusher.Push("/metrics", pushOptions)
				}()
			}
		}
		
		next.ServeHTTP(w, r)
	})
}

// HTTP2OptimizationMiddleware applies HTTP/2 specific optimizations
func HTTP2OptimizationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Add HTTP/2 specific headers
		if r.ProtoMajor == 2 {
			// Enable server timing for performance insights
			w.Header().Set("Server-Timing", "app;desc=\"Serverless Redis Proxy\"")
			
			// Add security headers optimized for HTTP/2
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
		}
		
		next.ServeHTTP(w, r)
	})
}
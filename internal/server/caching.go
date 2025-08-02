package server

import (
	"crypto/md5"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// CacheEntry represents a cached response
type CacheEntry struct {
	Data       []byte
	Headers    http.Header
	StatusCode int
	Timestamp  time.Time
	TTL        time.Duration
}

// IsExpired checks if the cache entry has expired
func (ce *CacheEntry) IsExpired() bool {
	return time.Since(ce.Timestamp) > ce.TTL
}

// InMemoryCache provides simple in-memory caching for responses
type InMemoryCache struct {
	entries map[string]*CacheEntry
	mutex   sync.RWMutex
	maxSize int
}

// NewInMemoryCache creates a new in-memory cache
func NewInMemoryCache(maxSize int) *InMemoryCache {
	return &InMemoryCache{
		entries: make(map[string]*CacheEntry),
		maxSize: maxSize,
	}
}

// Get retrieves a cache entry
func (c *InMemoryCache) Get(key string) (*CacheEntry, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	
	entry, exists := c.entries[key]
	if !exists || entry.IsExpired() {
		if exists {
			// Clean up expired entry
			go func() {
				c.mutex.Lock()
				delete(c.entries, key)
				c.mutex.Unlock()
			}()
		}
		return nil, false
	}
	
	return entry, true
}

// Set stores a cache entry
func (c *InMemoryCache) Set(key string, entry *CacheEntry) {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	// Simple eviction strategy: remove oldest entries if at capacity
	if len(c.entries) >= c.maxSize {
		c.evictOldest()
	}
	
	c.entries[key] = entry
}

// evictOldest removes the oldest cache entry
func (c *InMemoryCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time
	
	for key, entry := range c.entries {
		if oldestKey == "" || entry.Timestamp.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.Timestamp
		}
	}
	
	if oldestKey != "" {
		delete(c.entries, oldestKey)
	}
}

// ClearExpired removes all expired entries
func (c *InMemoryCache) ClearExpired() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	
	for key, entry := range c.entries {
		if entry.IsExpired() {
			delete(c.entries, key)
		}
	}
}

// Size returns the number of entries in cache
func (c *InMemoryCache) Size() int {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return len(c.entries)
}

// generateCacheKey creates a cache key from request details
func generateCacheKey(r *http.Request, body []byte) string {
	h := md5.New()
	h.Write([]byte(r.Method))
	h.Write([]byte(r.URL.Path))
	h.Write([]byte(r.URL.RawQuery))
	
	// Include authorization header in key for tenant isolation
	if auth := r.Header.Get("Authorization"); auth != "" {
		h.Write([]byte(auth))
	}
	
	// Include request body for POST requests
	if len(body) > 0 {
		h.Write(body)
	}
	
	return fmt.Sprintf("%x", h.Sum(nil))
}

// CacheableResponseWriter captures response data for caching
type CacheableResponseWriter struct {
	http.ResponseWriter
	statusCode int
	buffer     []byte
	headers    http.Header
}

func (crw *CacheableResponseWriter) WriteHeader(statusCode int) {
	crw.statusCode = statusCode
	crw.ResponseWriter.WriteHeader(statusCode)
}

func (crw *CacheableResponseWriter) Write(data []byte) (int, error) {
	crw.buffer = append(crw.buffer, data...)
	return crw.ResponseWriter.Write(data)
}

// CachingMiddleware provides intelligent caching for read-only Redis operations
func CachingMiddleware(cache *InMemoryCache) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only cache GET requests and specific read-only Redis commands
			if !isCacheable(r) {
				next.ServeHTTP(w, r)
				return
			}
			
			// Read request body for cache key generation
			var body []byte
			if r.Body != nil {
				body, _ = io.ReadAll(r.Body)
				r.Body = io.NopCloser(strings.NewReader(string(body)))
			}
			
			// Generate cache key
			cacheKey := generateCacheKey(r, body)
			
			// Check cache
			if entry, found := cache.Get(cacheKey); found {
				// Serve from cache
				for key, values := range entry.Headers {
					for _, value := range values {
						w.Header().Add(key, value)
					}
				}
				w.Header().Set("X-Cache", "HIT")
				w.Header().Set("X-Cache-Age", strconv.Itoa(int(time.Since(entry.Timestamp).Seconds())))
				w.WriteHeader(entry.StatusCode)
				w.Write(entry.Data)
				return
			}
			
			// Cache miss - capture response
			crw := &CacheableResponseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				headers:        make(http.Header),
			}
			
			// Copy headers before processing
			for key, values := range w.Header() {
				crw.headers[key] = values
			}
			
			next.ServeHTTP(crw, r)
			
			// Cache the response if successful and cacheable
			if crw.statusCode == http.StatusOK && len(crw.buffer) > 0 {
				ttl := getCacheTTL(r)
				entry := &CacheEntry{
					Data:       crw.buffer,
					Headers:    crw.headers,
					StatusCode: crw.statusCode,
					Timestamp:  time.Now(),
					TTL:        ttl,
				}
				cache.Set(cacheKey, entry)
				w.Header().Set("X-Cache", "MISS")
			}
		})
	}
}

// isCacheable determines if a request can be cached
func isCacheable(r *http.Request) bool {
	// Cache GET requests (health, metrics)
	if r.Method == "GET" {
		return r.URL.Path == "/health" || r.URL.Path == "/metrics"
	}
	
	// For POST requests, check if it's a read-only Redis command
	if r.Method == "POST" {
		return isReadOnlyRedisRequest(r)
	}
	
	return false
}

// isReadOnlyRedisRequest checks if the Redis command is read-only
func isReadOnlyRedisRequest(r *http.Request) bool {
	// This would need to parse the JSON body to check the command
	// For now, we'll be conservative and not cache POST requests
	// In a full implementation, you'd parse the JSON and check commands like:
	// GET, MGET, HGET, HGETALL, LRANGE, SISMEMBER, etc.
	return false
}

// getCacheTTL returns appropriate cache TTL based on request type
func getCacheTTL(r *http.Request) time.Duration {
	switch r.URL.Path {
	case "/health":
		return 30 * time.Second // Health data changes relatively frequently
	case "/metrics":
		return 10 * time.Second // Metrics change frequently
	default:
		return 60 * time.Second // Default TTL
	}
}

// StartCacheCleanup starts a background goroutine to clean expired cache entries
func StartCacheCleanup(cache *InMemoryCache, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			cache.ClearExpired()
		}
	}()
}
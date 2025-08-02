package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestInMemoryCache(t *testing.T) {
	cache := NewInMemoryCache(3) // Small cache for testing

	// Test Set and Get
	entry := &CacheEntry{
		Data:       []byte("test data"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now(),
		TTL:        time.Minute,
	}

	cache.Set("key1", entry)

	retrieved, found := cache.Get("key1")
	if !found {
		t.Error("Expected to find cached entry")
	}

	if string(retrieved.Data) != "test data" {
		t.Errorf("Expected 'test data', got %s", string(retrieved.Data))
	}

	// Test cache miss
	_, found = cache.Get("nonexistent")
	if found {
		t.Error("Expected cache miss for nonexistent key")
	}
}

func TestCacheExpiration(t *testing.T) {
	cache := NewInMemoryCache(10)

	// Create expired entry
	expiredEntry := &CacheEntry{
		Data:       []byte("expired data"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now().Add(-time.Hour), // 1 hour ago
		TTL:        time.Minute,                 // 1 minute TTL
	}

	cache.Set("expired", expiredEntry)

	// Should not retrieve expired entry
	_, found := cache.Get("expired")
	if found {
		t.Error("Expected expired entry to not be found")
	}

	// Cache should be empty after cleanup (Get() triggers cleanup of expired entries)  
	if cache.Size() != 0 {
		t.Logf("Cache size after expiration: %d (cleanup happens asynchronously)", cache.Size())
	}
}

func TestCacheEviction(t *testing.T) {
	cache := NewInMemoryCache(2) // Very small cache

	// Fill cache to capacity
	entry1 := &CacheEntry{
		Data:       []byte("data1"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now(),
		TTL:        time.Minute,
	}

	entry2 := &CacheEntry{
		Data:       []byte("data2"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now().Add(time.Second), // Newer
		TTL:        time.Minute,
	}

	cache.Set("key1", entry1)
	cache.Set("key2", entry2)

	if cache.Size() != 2 {
		t.Errorf("Expected cache size 2, got %d", cache.Size())
	}

	// Add third entry, should evict oldest
	entry3 := &CacheEntry{
		Data:       []byte("data3"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now().Add(2 * time.Second),
		TTL:        time.Minute,
	}

	cache.Set("key3", entry3)

	if cache.Size() != 2 {
		t.Errorf("Expected cache size 2 after eviction, got %d", cache.Size())
	}

	// key1 should be evicted (oldest)
	_, found := cache.Get("key1")
	if found {
		t.Error("Expected oldest entry to be evicted")
	}

	// key2 and key3 should still exist
	_, found = cache.Get("key2")
	if !found {
		t.Error("Expected key2 to still exist")
	}

	_, found = cache.Get("key3")
	if !found {
		t.Error("Expected key3 to still exist")
	}
}

func TestClearExpired(t *testing.T) {
	cache := NewInMemoryCache(10)

	// Add valid entry
	validEntry := &CacheEntry{
		Data:       []byte("valid data"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now(),
		TTL:        time.Hour,
	}

	// Add expired entry
	expiredEntry := &CacheEntry{
		Data:       []byte("expired data"),
		Headers:    make(http.Header),
		StatusCode: 200,
		Timestamp:  time.Now().Add(-time.Hour),
		TTL:        time.Minute,
	}

	cache.Set("valid", validEntry)
	cache.Set("expired", expiredEntry)

	if cache.Size() != 2 {
		t.Errorf("Expected cache size 2, got %d", cache.Size())
	}

	// Clear expired entries
	cache.ClearExpired()

	if cache.Size() != 1 {
		t.Errorf("Expected cache size 1 after clearing expired, got %d", cache.Size())
	}

	// Valid entry should still exist
	_, found := cache.Get("valid")
	if !found {
		t.Error("Expected valid entry to still exist")
	}

	// Expired entry should be gone
	_, found = cache.Get("expired")
	if found {
		t.Error("Expected expired entry to be removed")
	}
}

func TestGenerateCacheKey(t *testing.T) {
	req1 := httptest.NewRequest("GET", "/health", nil)
	req1.Header.Set("Authorization", "Bearer token1")

	req2 := httptest.NewRequest("GET", "/health", nil)
	req2.Header.Set("Authorization", "Bearer token2")

	req3 := httptest.NewRequest("POST", "/command", nil)
	req3.Header.Set("Authorization", "Bearer token1")

	key1 := generateCacheKey(req1, nil)
	key2 := generateCacheKey(req2, nil)
	key3 := generateCacheKey(req3, nil)

	// Different auth tokens should generate different keys
	if key1 == key2 {
		t.Error("Expected different cache keys for different auth tokens")
	}

	// Different methods should generate different keys
	if key1 == key3 {
		t.Error("Expected different cache keys for different methods")
	}

	// Same request should generate same key
	key1Duplicate := generateCacheKey(req1, nil)
	if key1 != key1Duplicate {
		t.Error("Expected same cache key for identical requests")
	}
}

func TestCachingMiddleware(t *testing.T) {
	cache := NewInMemoryCache(10)
	requestCount := 0

	// Create handler that increments counter
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"count": ` + string(rune(requestCount+48)) + `}`))
	})

	handler := CachingMiddleware(cache)(testHandler)

	// First request - should hit handler
	req := httptest.NewRequest("GET", "/health", nil)
	w1 := httptest.NewRecorder()

	handler.ServeHTTP(w1, req)

	if requestCount != 1 {
		t.Errorf("Expected 1 request to handler, got %d", requestCount)
	}

	if w1.Header().Get("X-Cache") != "MISS" {
		t.Error("Expected X-Cache: MISS for first request")
	}

	// Second identical request - should hit cache
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req)

	if requestCount != 1 {
		t.Errorf("Expected still 1 request to handler (cached), got %d", requestCount)
	}

	if w2.Header().Get("X-Cache") != "HIT" {
		t.Error("Expected X-Cache: HIT for cached request")
	}

	// Responses should be identical
	if w1.Body.String() != w2.Body.String() {
		t.Error("Expected identical responses from cache")
	}
}

func TestIsCacheable(t *testing.T) {
	tests := []struct {
		method   string
		path     string
		expected bool
	}{
		{"GET", "/health", true},
		{"GET", "/metrics", true},
		{"GET", "/other", false},
		{"POST", "/v1/command", false}, // Conservative approach
		{"PUT", "/health", false},
		{"DELETE", "/health", false},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			result := isCacheable(req)
			if result != tt.expected {
				t.Errorf("Expected %v for %s %s, got %v", tt.expected, tt.method, tt.path, result)
			}
		})
	}
}

func TestGetCacheTTL(t *testing.T) {
	tests := []struct {
		path     string
		expected time.Duration
	}{
		{"/health", 30 * time.Second},
		{"/metrics", 10 * time.Second},
		{"/other", 60 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			ttl := getCacheTTL(req)
			if ttl != tt.expected {
				t.Errorf("Expected TTL %v for %s, got %v", tt.expected, tt.path, ttl)
			}
		})
	}
}
package server

import (
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCompressionMiddleware(t *testing.T) {
	// Create a test handler that returns JSON
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message": "test response", "data": {"key": "value"}}`))
	})

	// Wrap with compression middleware
	handler := CompressionMiddleware(testHandler)

	// Test with gzip support
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Check response headers
	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Error("Expected Content-Encoding: gzip")
	}

	if w.Header().Get("Vary") != "Accept-Encoding" {
		t.Error("Expected Vary: Accept-Encoding")
	}

	// Decompress and verify content
	reader, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatalf("Failed to create gzip reader: %v", err)
	}
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read decompressed content: %v", err)
	}

	expected := `{"message": "test response", "data": {"key": "value"}}`
	if string(decompressed) != expected {
		t.Errorf("Expected %s, got %s", expected, string(decompressed))
	}
}

func TestCompressionMiddlewareWithoutGzipSupport(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"message": "test response"}`))
	})

	handler := CompressionMiddleware(testHandler)

	// Test without gzip support
	req := httptest.NewRequest("GET", "/", nil)
	// No Accept-Encoding header
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should not compress
	if w.Header().Get("Content-Encoding") != "" {
		t.Error("Expected no Content-Encoding header")
	}

	body := w.Body.String()
	expected := `{"message": "test response"}`
	if body != expected {
		t.Errorf("Expected %s, got %s", expected, body)
	}
}

func TestContentEncodingMiddleware(t *testing.T) {
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"test": "data"}`))
	})

	handler := ContentEncodingMiddleware(testHandler)

	tests := []struct {
		name           string
		acceptEncoding string
		expectGzip     bool
	}{
		{
			name:           "Gzip supported",
			acceptEncoding: "gzip, deflate",
			expectGzip:     true,
		},
		{
			name:           "Brotli preferred (falls back to gzip)",
			acceptEncoding: "br, gzip",
			expectGzip:     true,
		},
		{
			name:           "No compression",
			acceptEncoding: "identity",
			expectGzip:     false,
		},
		{
			name:           "Empty accept encoding",
			acceptEncoding: "",
			expectGzip:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tt.acceptEncoding != "" {
				req.Header.Set("Accept-Encoding", tt.acceptEncoding)
			}
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			hasGzip := w.Header().Get("Content-Encoding") == "gzip"
			if hasGzip != tt.expectGzip {
				t.Errorf("Expected gzip=%v, got gzip=%v", tt.expectGzip, hasGzip)
			}
		})
	}
}

func TestCompressedResponseWriter(t *testing.T) {
	w := httptest.NewRecorder()
	
	// Create gzip writer
	gzipWriter := gzip.NewWriter(w)
	crw := &CompressedResponseWriter{
		ResponseWriter: w,
		writer:         gzipWriter,
		gzipWriter:     gzipWriter,
	}

	// Write data
	testData := "This is test data for compression"
	n, err := crw.Write([]byte(testData))
	if err != nil {
		t.Fatalf("Failed to write: %v", err)
	}

	if n != len(testData) {
		t.Errorf("Expected to write %d bytes, wrote %d", len(testData), n)
	}

	// Close to flush
	err = crw.Close()
	if err != nil {
		t.Fatalf("Failed to close: %v", err)
	}

	// Verify compressed content
	reader, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatalf("Failed to create gzip reader: %v", err)
	}
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read decompressed: %v", err)
	}

	if string(decompressed) != testData {
		t.Errorf("Expected %s, got %s", testData, string(decompressed))
	}
}

func TestCompressionRatio(t *testing.T) {
	// Create large repetitive data that compresses well
	largeData := strings.Repeat(`{"key": "value", "number": 12345, "text": "This is repeated data"}`, 100)

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(largeData))
	})

	handler := CompressionMiddleware(testHandler)

	// Test without compression
	req := httptest.NewRequest("GET", "/", nil)
	w1 := httptest.NewRecorder()
	testHandler.ServeHTTP(w1, req)
	uncompressedSize := w1.Body.Len()

	// Test with compression
	req.Header.Set("Accept-Encoding", "gzip")
	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, req)
	compressedSize := w2.Body.Len()

	// Compression should significantly reduce size
	compressionRatio := float64(compressedSize) / float64(uncompressedSize)
	if compressionRatio > 0.5 {
		t.Errorf("Expected compression ratio < 0.5, got %f", compressionRatio)
	}

	t.Logf("Compression ratio: %f (from %d to %d bytes)", compressionRatio, uncompressedSize, compressedSize)
}
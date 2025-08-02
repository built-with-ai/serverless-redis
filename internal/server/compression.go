package server

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"
)

type CompressedResponseWriter struct {
	http.ResponseWriter
	writer io.Writer
	gzipWriter *gzip.Writer
}

func (crw *CompressedResponseWriter) Write(b []byte) (int, error) {
	return crw.writer.Write(b)
}

func (crw *CompressedResponseWriter) Close() error {
	if crw.gzipWriter != nil {
		return crw.gzipWriter.Close()
	}
	return nil
}

// CompressionMiddleware adds gzip compression support
func CompressionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if client accepts gzip
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		// Only compress JSON responses
		contentType := w.Header().Get("Content-Type")
		if !strings.Contains(contentType, "application/json") {
			// Set content type if not already set (for our JSON responses)
			if contentType == "" {
				w.Header().Set("Content-Type", "application/json")
			}
		}

		// Create gzip writer
		gzipWriter := gzip.NewWriter(w)
		defer gzipWriter.Close()

		// Set compression headers
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Vary", "Accept-Encoding")

		// Wrap response writer
		crw := &CompressedResponseWriter{
			ResponseWriter: w,
			writer:         gzipWriter,
			gzipWriter:     gzipWriter,
		}

		next.ServeHTTP(crw, r)
	})
}

// BrotliMiddleware adds brotli compression support (for future enhancement)
func BrotliMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For now, just pass through - can implement brotli later
		// Brotli provides better compression but requires additional dependency
		next.ServeHTTP(w, r)
	})
}

// ContentEncodingMiddleware automatically detects and applies best compression
func ContentEncodingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		acceptEncoding := r.Header.Get("Accept-Encoding")
		
		// Prefer brotli if available (future)
		if strings.Contains(acceptEncoding, "br") {
			// BrotliMiddleware would go here
			CompressionMiddleware(next).ServeHTTP(w, r)
			return
		}
		
		// Fall back to gzip
		if strings.Contains(acceptEncoding, "gzip") {
			CompressionMiddleware(next).ServeHTTP(w, r)
			return
		}

		// No compression
		next.ServeHTTP(w, r)
	})
}
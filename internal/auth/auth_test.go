package auth

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/scaler/serverless-redis/internal/types"
)

func TestNewManager(t *testing.T) {
	config := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
		APIKeys: []types.APIKey{
			{
				Key:         "test-key",
				TenantID:    "tenant1",
				RateLimit:   1000,
				AllowedDBs:  []int{0, 1, 2},
				Permissions: []string{"GET", "SET"},
			},
		},
	}

	manager := NewManager(config)

	if manager.config != config {
		t.Error("Expected config to be set")
	}

	if len(manager.apiKeys) != 1 {
		t.Errorf("Expected 1 API key, got %d", len(manager.apiKeys))
	}

	tenant, exists := manager.apiKeys["test-key"]
	if !exists {
		t.Error("Expected API key to exist")
	}

	if tenant.ID != "tenant1" {
		t.Errorf("Expected tenant ID tenant1, got %s", tenant.ID)
	}
}

func TestValidateRequestWithAPIKey(t *testing.T) {
	config := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
		APIKeys: []types.APIKey{
			{
				Key:         "valid-key",
				TenantID:    "tenant1",
				RateLimit:   1000,
				AllowedDBs:  []int{0, 1, 2},
				Permissions: []string{"GET", "SET"},
			},
		},
	}

	manager := NewManager(config)

	// Test with valid API key
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "valid-key")

	tenant, err := manager.ValidateRequest(req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if tenant.ID != "tenant1" {
		t.Errorf("Expected tenant ID tenant1, got %s", tenant.ID)
	}

	// Test with invalid API key
	req.Header.Set("Authorization", "invalid-key")
	_, err = manager.ValidateRequest(req)
	if err == nil {
		t.Error("Expected error for invalid API key")
	}

	// Test with missing authorization header
	req.Header.Del("Authorization")
	_, err = manager.ValidateRequest(req)
	if err == nil {
		t.Error("Expected error for missing authorization header")
	}
}

func TestValidateRequestWithBasicAuth(t *testing.T) {
	config := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
		APIKeys: []types.APIKey{
			{
				Key:         "secret-key",
				TenantID:    "tenant1",
				RateLimit:   1000,
				AllowedDBs:  []int{0, 1, 2},
				Permissions: []string{"GET", "SET"},
			},
		},
	}

	manager := NewManager(config)

	// Test with valid basic auth
	credentials := base64.StdEncoding.EncodeToString([]byte("tenant1:secret-key"))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Basic "+credentials)

	tenant, err := manager.ValidateRequest(req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if tenant.ID != "tenant1" {
		t.Errorf("Expected tenant ID tenant1, got %s", tenant.ID)
	}

	// Test with invalid basic auth
	invalidCredentials := base64.StdEncoding.EncodeToString([]byte("wrong:credentials"))
	req.Header.Set("Authorization", "Basic "+invalidCredentials)
	_, err = manager.ValidateRequest(req)
	if err == nil {
		t.Error("Expected error for invalid basic auth")
	}
}

func TestValidateRequestWithJWT(t *testing.T) {
	config := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
	}

	manager := NewManager(config)

	// Generate valid JWT
	validToken, err := manager.GenerateJWT("tenant1", 1000, []int{0, 1, 2}, []string{"GET", "SET"}, time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate JWT: %v", err)
	}

	// Test with valid JWT
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)

	tenant, err := manager.ValidateRequest(req)
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if tenant.ID != "tenant1" {
		t.Errorf("Expected tenant ID tenant1, got %s", tenant.ID)
	}

	// Test with expired JWT
	expiredToken, err := manager.GenerateJWT("tenant1", 1000, []int{0, 1, 2}, []string{"GET", "SET"}, -time.Hour)
	if err != nil {
		t.Fatalf("Failed to generate expired JWT: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+expiredToken)
	_, err = manager.ValidateRequest(req)
	if err == nil {
		t.Error("Expected error for expired JWT")
	}

	// Test with invalid JWT
	req.Header.Set("Authorization", "Bearer invalid-token")
	_, err = manager.ValidateRequest(req)
	if err == nil {
		t.Error("Expected error for invalid JWT")
	}
}

func TestValidateCommand(t *testing.T) {
	tenant := &types.Tenant{
		ID:          "tenant1",
		Permissions: []string{"GET", "SET", "HGET*"},
	}

	manager := &Manager{}

	tests := []struct {
		command string
		wantErr bool
	}{
		{"GET", false},
		{"SET", false},
		{"HGET", false},
		{"HGETALL", false}, // Should match HGET* pattern
		{"DELETE", true},
		{"FLUSHDB", true},
	}

	for _, tt := range tests {
		t.Run(tt.command, func(t *testing.T) {
			err := manager.ValidateCommand(tenant, tt.command)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCommand(%s) error = %v, wantErr %v", tt.command, err, tt.wantErr)
			}
		})
	}

	// Test wildcard permission
	wildcardTenant := &types.Tenant{
		ID:          "tenant2",
		Permissions: []string{"*"},
	}

	err := manager.ValidateCommand(wildcardTenant, "FLUSHDB")
	if err != nil {
		t.Errorf("Expected no error for wildcard permission, got %v", err)
	}
}

func TestValidateDatabase(t *testing.T) {
	tenant := &types.Tenant{
		ID:         "tenant1",
		AllowedDBs: []int{0, 1, 2},
	}

	manager := &Manager{}

	tests := []struct {
		db      int
		wantErr bool
	}{
		{0, false},
		{1, false},
		{2, false},
		{3, true},
		{-1, true},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			err := manager.ValidateDatabase(tenant, tt.db)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateDatabase(%d) error = %v, wantErr %v", tt.db, err, tt.wantErr)
			}
		})
	}
}

func TestAuthMiddleware(t *testing.T) {
	config := &types.AuthConfig{
		Enabled:   true,
		JWTSecret: "test-secret",
		APIKeys: []types.APIKey{
			{
				Key:         "valid-key",
				TenantID:    "tenant1",
				RateLimit:   1000,
				AllowedDBs:  []int{0, 1, 2},
				Permissions: []string{"GET", "SET"},
			},
		},
	}

	manager := NewManager(config)

	// Create a test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant, ok := GetTenantFromContext(r.Context())
		if !ok {
			t.Error("Expected tenant in context")
		}
		if tenant.ID != "tenant1" {
			t.Errorf("Expected tenant ID tenant1, got %s", tenant.ID)
		}
		w.WriteHeader(http.StatusOK)
	})

	// Wrap with auth middleware
	handler := manager.AuthMiddleware(testHandler)

	// Test with valid API key
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "valid-key")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Test with invalid API key
	req.Header.Set("Authorization", "invalid-key")
	w = httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestAuthDisabled(t *testing.T) {
	config := &types.AuthConfig{
		Enabled: false,
	}

	manager := NewManager(config)

	req := httptest.NewRequest("GET", "/", nil)
	// No authorization header

	tenant, err := manager.ValidateRequest(req)
	if err != nil {
		t.Errorf("Expected no error when auth disabled, got %v", err)
	}

	if tenant.ID != "default" {
		t.Errorf("Expected default tenant, got %s", tenant.ID)
	}

	if len(tenant.AllowedDBs) != 16 {
		t.Errorf("Expected 16 allowed DBs for default tenant, got %d", len(tenant.AllowedDBs))
	}
}

func TestTenantContext(t *testing.T) {
	tenant := &types.Tenant{
		ID: "test-tenant",
	}

	ctx := context.Background()
	ctx = setTenantInContext(ctx, tenant)

	retrievedTenant, ok := GetTenantFromContext(ctx)
	if !ok {
		t.Error("Expected tenant to be found in context")
	}

	if retrievedTenant.ID != "test-tenant" {
		t.Errorf("Expected tenant ID test-tenant, got %s", retrievedTenant.ID)
	}

	// Test with empty context
	emptyCtx := context.Background()
	_, ok = GetTenantFromContext(emptyCtx)
	if ok {
		t.Error("Expected no tenant in empty context")
	}
}
package auth

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/scaler/serverless-redis/internal/types"
)

type Manager struct {
	config  *types.AuthConfig
	apiKeys map[string]*types.Tenant
	jwtKey  []byte
}

type JWTClaims struct {
	TenantID    string   `json:"tenant_id"`
	RateLimit   int      `json:"rate_limit"`
	AllowedDBs  []int    `json:"allowed_dbs"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

func NewManager(config *types.AuthConfig) *Manager {
	apiKeys := make(map[string]*types.Tenant)
	
	// Build API key lookup map
	for _, key := range config.APIKeys {
		apiKeys[key.Key] = &types.Tenant{
			ID:          key.TenantID,
			RateLimit:   key.RateLimit,
			AllowedDBs:  key.AllowedDBs,
			Permissions: key.Permissions,
		}
	}
	
	return &Manager{
		config:  config,
		apiKeys: apiKeys,
		jwtKey:  []byte(config.JWTSecret),
	}
}

func (m *Manager) ValidateRequest(r *http.Request) (*types.Tenant, error) {
	if !m.config.Enabled {
		// Return default tenant when auth is disabled
		return &types.Tenant{
			ID:          "default",
			RateLimit:   1000,
			AllowedDBs:  []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
			Permissions: []string{"*"},
		}, nil
	}
	
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return nil, errors.New("missing authorization header")
	}
	
	if strings.HasPrefix(auth, "Bearer ") {
		return m.validateJWT(auth[7:])
	}
	
	if strings.HasPrefix(auth, "Basic ") {
		return m.validateBasicAuth(auth[6:])
	}
	
	// Try direct API key
	if tenant, exists := m.apiKeys[auth]; exists {
		return tenant, nil
	}
	
	return nil, errors.New("invalid authentication method")
}

func (m *Manager) validateJWT(tokenString string) (*types.Tenant, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.jwtKey, nil
	})
	
	if err != nil {
		return nil, fmt.Errorf("invalid JWT token: %w", err)
	}
	
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid JWT claims")
	}
	
	// Check token expiration
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return nil, errors.New("JWT token expired")
	}
	
	return &types.Tenant{
		ID:          claims.TenantID,
		RateLimit:   claims.RateLimit,
		AllowedDBs:  claims.AllowedDBs,
		Permissions: claims.Permissions,
	}, nil
}

func (m *Manager) validateBasicAuth(encoded string) (*types.Tenant, error) {
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("invalid base64 encoding")
	}
	
	parts := strings.SplitN(string(decoded), ":", 2)
	if len(parts) != 2 {
		return nil, errors.New("invalid basic auth format")
	}
	
	username, password := parts[0], parts[1]
	
	// For basic auth, we use the username as tenant ID and password as API key
	if tenant, exists := m.apiKeys[password]; exists {
		// Verify the username matches tenant ID for additional security
		if subtle.ConstantTimeCompare([]byte(username), []byte(tenant.ID)) == 1 {
			return tenant, nil
		}
	}
	
	return nil, errors.New("invalid credentials")
}

func (m *Manager) ValidateCommand(tenant *types.Tenant, command string) error {
	// Check if tenant has permission for this command
	for _, perm := range tenant.Permissions {
		if perm == "*" {
			return nil // Wildcard permission
		}
		
		if strings.EqualFold(perm, command) {
			return nil
		}
		
		// Check command patterns (e.g., "GET*" matches "GET", "GETBIT", etc.)
		if strings.HasSuffix(perm, "*") {
			prefix := strings.TrimSuffix(perm, "*")
			if strings.HasPrefix(strings.ToUpper(command), strings.ToUpper(prefix)) {
				return nil
			}
		}
	}
	
	return fmt.Errorf("command '%s' not permitted for tenant '%s'", command, tenant.ID)
}

func (m *Manager) ValidateDatabase(tenant *types.Tenant, db int) error {
	for _, allowedDB := range tenant.AllowedDBs {
		if allowedDB == db {
			return nil
		}
	}
	
	return fmt.Errorf("database %d not allowed for tenant '%s'", db, tenant.ID)
}

func (m *Manager) GenerateJWT(tenantID string, rateLimit int, allowedDBs []int, permissions []string, duration time.Duration) (string, error) {
	claims := &JWTClaims{
		TenantID:    tenantID,
		RateLimit:   rateLimit,
		AllowedDBs:  allowedDBs,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "serverless-redis",
		},
	}
	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.jwtKey)
}

// Middleware for HTTP authentication
func (m *Manager) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant, err := m.ValidateRequest(r)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error": "Authentication failed", "details": "%s"}`, err.Error()), http.StatusUnauthorized)
			return
		}
		
		// Add tenant to request context
		ctx := r.Context()
		ctx = setTenantInContext(ctx, tenant)
		r = r.WithContext(ctx)
		
		next.ServeHTTP(w, r)
	})
}

// Context helpers
type contextKey string

const tenantContextKey contextKey = "tenant"

func setTenantInContext(ctx context.Context, tenant *types.Tenant) context.Context {
	return context.WithValue(ctx, tenantContextKey, tenant)
}

func GetTenantFromContext(ctx context.Context) (*types.Tenant, bool) {
	tenant, ok := ctx.Value(tenantContextKey).(*types.Tenant)
	return tenant, ok
}
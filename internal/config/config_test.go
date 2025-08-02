package config

import (
	"os"
	"testing"

	"github.com/scaler/serverless-redis/internal/types"
)

func TestLoadConfigWithDefaults(t *testing.T) {
	// Clear environment variables
	os.Unsetenv("PORT")
	os.Unsetenv("REDIS_URL")
	os.Unsetenv("JWT_SECRET")

	config, err := LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Test defaults
	if config.Server.Port != 8080 {
		t.Errorf("Expected default port 8080, got %d", config.Server.Port)
	}

	if config.Server.Host != "0.0.0.0" {
		t.Errorf("Expected default host 0.0.0.0, got %s", config.Server.Host)
	}

	if config.Redis.Primary.Addr != "localhost:6379" {
		t.Errorf("Expected default Redis addr localhost:6379, got %s", config.Redis.Primary.Addr)
	}

	if config.Pool.MinIdleConns != 5 {
		t.Errorf("Expected default MinIdleConns 5, got %d", config.Pool.MinIdleConns)
	}

	if config.Pool.MaxIdleConns != 100 {
		t.Errorf("Expected default MaxIdleConns 100, got %d", config.Pool.MaxIdleConns)
	}

	if config.Pool.MaxActiveConns != 1000 {
		t.Errorf("Expected default MaxActiveConns 1000, got %d", config.Pool.MaxActiveConns)
	}
}

func TestLoadConfigWithEnvironmentVariables(t *testing.T) {
	// Set environment variables
	os.Setenv("PORT", "9000")
	os.Setenv("HOST", "127.0.0.1")
	os.Setenv("REDIS_URL", "redis://test-redis:6380")
	os.Setenv("REDIS_PASSWORD", "test-password")
	os.Setenv("JWT_SECRET", "test-jwt-secret")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("HOST") 
		os.Unsetenv("REDIS_URL")
		os.Unsetenv("REDIS_PASSWORD")
		os.Unsetenv("JWT_SECRET")
	}()

	config, err := LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if config.Server.Port != 9000 {
		t.Errorf("Expected port 9000 from env, got %d", config.Server.Port)
	}

	if config.Server.Host != "127.0.0.1" {
		t.Errorf("Expected host 127.0.0.1 from env, got %s", config.Server.Host)
	}

	if config.Redis.Primary.Addr != "redis://test-redis:6380" {
		t.Errorf("Expected Redis addr from env, got %s", config.Redis.Primary.Addr)
	}

	if config.Redis.Primary.Password != "test-password" {
		t.Errorf("Expected Redis password from env, got %s", config.Redis.Primary.Password)
	}

	if config.Auth.JWTSecret != "test-jwt-secret" {
		t.Errorf("Expected JWT secret from env, got %s", config.Auth.JWTSecret)
	}
}

func TestValidateConfig(t *testing.T) {
	tests := []struct {
		name    string
		config  *types.Config
		wantErr bool
	}{
		{
			name: "Valid config",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 8080,
				},
				Redis: types.RedisConfig{
					Primary: types.RedisInstanceConfig{
						Addr: "localhost:6379",
					},
				},
				Pool: types.PoolConfig{
					MinIdleConns:   5,
					MaxIdleConns:   100,
					MaxActiveConns: 1000,
				},
				Auth: types.AuthConfig{
					Enabled:   true,
					JWTSecret: "valid-secret",
				},
			},
			wantErr: false,
		},
		{
			name: "Invalid port - too low",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 0,
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid port - too high",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 70000,
				},
			},
			wantErr: true,
		},
		{
			name: "Missing Redis address",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 8080,
				},
				Redis: types.RedisConfig{
					Primary: types.RedisInstanceConfig{
						Addr: "",
					},
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid pool config - negative min connections",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 8080,
				},
				Redis: types.RedisConfig{
					Primary: types.RedisInstanceConfig{
						Addr: "localhost:6379",
					},
				},
				Pool: types.PoolConfig{
					MinIdleConns:   -1,
					MaxIdleConns:   100,
					MaxActiveConns: 1000,
				},
			},
			wantErr: true,
		},
		{
			name: "Invalid pool config - max idle < min idle",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 8080,
				},
				Redis: types.RedisConfig{
					Primary: types.RedisInstanceConfig{
						Addr: "localhost:6379",
					},
				},
				Pool: types.PoolConfig{
					MinIdleConns:   100,
					MaxIdleConns:   50,
					MaxActiveConns: 1000,
				},
			},
			wantErr: true,
		},
		{
			name: "Insecure JWT secret in production",
			config: &types.Config{
				Server: types.ServerConfig{
					Port: 8080,
				},
				Redis: types.RedisConfig{
					Primary: types.RedisInstanceConfig{
						Addr: "localhost:6379",
					},
				},
				Pool: types.PoolConfig{
					MinIdleConns:   5,
					MaxIdleConns:   100,
					MaxActiveConns: 1000,
				},
				Auth: types.AuthConfig{
					Enabled:   true,
					JWTSecret: "change-this-secret-key",
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateConfig(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSetDefaults(t *testing.T) {
	config := &types.Config{}
	setDefaults(config)

	if config.Server.Port != 8080 {
		t.Errorf("Expected default port 8080, got %d", config.Server.Port)
	}

	if config.Server.Host != "0.0.0.0" {
		t.Errorf("Expected default host 0.0.0.0, got %s", config.Server.Host)
	}

	if config.Redis.Primary.Addr != "localhost:6379" {
		t.Errorf("Expected default Redis addr localhost:6379, got %s", config.Redis.Primary.Addr)
	}

	if config.Metrics.Path != "/metrics" {
		t.Errorf("Expected default metrics path /metrics, got %s", config.Metrics.Path)
	}

	if config.Logging.Level != "info" {
		t.Errorf("Expected default log level info, got %s", config.Logging.Level)
	}

	if config.Logging.Format != "json" {
		t.Errorf("Expected default log format json, got %s", config.Logging.Format)
	}
}
package config

import (
	"fmt"
	"os"
	"gopkg.in/yaml.v3"
	"github.com/scaler/serverless-redis/internal/types"
)

// LoadConfig loads configuration from file or environment variables
func LoadConfig() (*types.Config, error) {
	config := &types.Config{}
	
	// Try to load from config file first
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config.yaml"
	}
	
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
		
		if err := yaml.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
	}
	
	// Override with environment variables
	overrideWithEnv(config)
	
	// Set defaults
	setDefaults(config)
	
	// Validate configuration
	if err := validateConfig(config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}
	
	return config, nil
}

func overrideWithEnv(config *types.Config) {
	if port := os.Getenv("PORT"); port != "" {
		fmt.Sscanf(port, "%d", &config.Server.Port)
	}
	
	if host := os.Getenv("HOST"); host != "" {
		config.Server.Host = host
	}
	
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		config.Redis.Primary.Addr = redisURL
	}
	
	if redisPassword := os.Getenv("REDIS_PASSWORD"); redisPassword != "" {
		config.Redis.Primary.Password = redisPassword
	}
	
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		config.Auth.JWTSecret = jwtSecret
	}
	
	if dragonflyURL := os.Getenv("DRAGONFLY_URL"); dragonflyURL != "" {
		config.Redis.Dragonfly.Enabled = true
		config.Redis.Dragonfly.Addr = dragonflyURL
	}
}

func setDefaults(config *types.Config) {
	if config.Server.Port == 0 {
		config.Server.Port = 8080
	}
	
	if config.Server.Host == "" {
		config.Server.Host = "0.0.0.0"
	}
	
	if config.Redis.Primary.Addr == "" {
		config.Redis.Primary.Addr = "localhost:6379"
	}
	
	if config.Pool.MinIdleConns == 0 {
		config.Pool.MinIdleConns = 5
	}
	
	if config.Pool.MaxIdleConns == 0 {
		config.Pool.MaxIdleConns = 100
	}
	
	if config.Pool.MaxActiveConns == 0 {
		config.Pool.MaxActiveConns = 1000
	}
	
	if config.Auth.JWTSecret == "" {
		config.Auth.JWTSecret = "change-this-secret-key"
	}
	
	if config.Metrics.Path == "" {
		config.Metrics.Path = "/metrics"
	}
	
	if config.Logging.Level == "" {
		config.Logging.Level = "info"
	}
	
	if config.Logging.Format == "" {
		config.Logging.Format = "json"
	}
}

func validateConfig(config *types.Config) error {
	if config.Server.Port <= 0 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}
	
	if config.Redis.Primary.Addr == "" {
		return fmt.Errorf("redis primary address is required")
	}
	
	if config.Pool.MaxActiveConns <= 0 {
		return fmt.Errorf("max_active_conns must be positive")
	}
	
	if config.Pool.MinIdleConns < 0 {
		return fmt.Errorf("min_idle_conns must be non-negative")
	}
	
	if config.Pool.MaxIdleConns < config.Pool.MinIdleConns {
		return fmt.Errorf("max_idle_conns must be >= min_idle_conns")
	}
	
	if config.Auth.Enabled && config.Auth.JWTSecret == "change-this-secret-key" {
		return fmt.Errorf("JWT secret must be changed in production")
	}
	
	return nil
}
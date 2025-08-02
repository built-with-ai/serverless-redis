package types

import "time"

// API Request/Response Types
type CommandRequest struct {
	Command string        `json:"command"`
	Args    []interface{} `json:"args,omitempty"`
	DB      int           `json:"db,omitempty"`
}

type CommandResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
	Type   string      `json:"type"`
	Time   float64     `json:"time"`
}

type PipelineRequest struct {
	Commands []CommandRequest `json:"commands"`
	DB       int              `json:"db,omitempty"`
}

type PipelineResponse struct {
	Results []CommandResponse `json:"results"`
	Time    float64           `json:"time"`
	Count   int               `json:"count"`
}

type TransactionRequest struct {
	Commands []CommandRequest `json:"commands"`
	Watch    []string         `json:"watch,omitempty"`
	DB       int              `json:"db,omitempty"`
}

type TransactionResponse struct {
	Results []CommandResponse `json:"results,omitempty"`
	Queued  int               `json:"queued"`
	Exec    bool              `json:"exec"`
	Time    float64           `json:"time"`
}

type HealthResponse struct {
	Status      string         `json:"status"`
	Version     string         `json:"version"`
	Connections map[string]int `json:"connections"`
	Uptime      int64          `json:"uptime"`
	Memory      MemoryStats    `json:"memory"`
}

type MemoryStats struct {
	Alloc        uint64 `json:"alloc"`
	TotalAlloc   uint64 `json:"total_alloc"`
	Sys          uint64 `json:"sys"`
	NumGC        uint32 `json:"num_gc"`
	NumGoroutine int    `json:"num_goroutine"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Details string `json:"details,omitempty"`
	Time    int64  `json:"time"`
}

// Configuration Types
type Config struct {
	Server  ServerConfig  `yaml:"server"`
	Redis   RedisConfig   `yaml:"redis"`
	Pool    PoolConfig    `yaml:"pool"`
	Auth    AuthConfig    `yaml:"auth"`
	Metrics MetricsConfig `yaml:"metrics"`
	Logging LoggingConfig `yaml:"logging"`
}

type ServerConfig struct {
	Port         int           `yaml:"port"`
	Host         string        `yaml:"host"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
	IdleTimeout  time.Duration `yaml:"idle_timeout"`
	HTTP2        HTTP2Config   `yaml:"http2"`
	TLS          TLSConfig     `yaml:"tls"`
}

type HTTP2Config struct {
	Enabled              bool          `yaml:"enabled"`
	MaxConcurrentStreams uint32        `yaml:"max_concurrent_streams"`
	MaxFrameSize         uint32        `yaml:"max_frame_size"`
	MaxHeaderListSize    uint32        `yaml:"max_header_list_size"`
	IdleTimeout          time.Duration `yaml:"idle_timeout"`
	ReadTimeout          time.Duration `yaml:"read_timeout"`
	WriteTimeout         time.Duration `yaml:"write_timeout"`
}

type TLSConfig struct {
	Enabled  bool   `yaml:"enabled"`
	CertFile string `yaml:"cert_file"`
	KeyFile  string `yaml:"key_file"`
}

type RedisConfig struct {
	Primary   RedisInstanceConfig `yaml:"primary"`
	Dragonfly DragonflyConfig     `yaml:"dragonfly"`
}

type RedisInstanceConfig struct {
	Addr         string        `yaml:"addr"`
	Password     string        `yaml:"password"`
	DB           int           `yaml:"db"`
	MaxRetries   int           `yaml:"max_retries"`
	DialTimeout  time.Duration `yaml:"dial_timeout"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
}

type DragonflyConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type PoolConfig struct {
	MinIdleConns   int           `yaml:"min_idle_conns"`
	MaxIdleConns   int           `yaml:"max_idle_conns"`
	MaxActiveConns int           `yaml:"max_active_conns"`
	IdleTimeout    time.Duration `yaml:"idle_timeout"`
	MaxConnAge     time.Duration `yaml:"max_conn_age"`
	PoolTimeout    time.Duration `yaml:"pool_timeout"`
}

type AuthConfig struct {
	Enabled   bool      `yaml:"enabled"`
	JWTSecret string    `yaml:"jwt_secret"`
	APIKeys   []APIKey  `yaml:"api_keys"`
}

type APIKey struct {
	Key         string   `yaml:"key"`
	TenantID    string   `yaml:"tenant_id"`
	RateLimit   int      `yaml:"rate_limit"`
	AllowedDBs  []int    `yaml:"allowed_dbs"`
	Permissions []string `yaml:"permissions"`
}

type MetricsConfig struct {
	Enabled bool   `yaml:"enabled"`
	Path    string `yaml:"path"`
}

type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
}

// Internal Types
type Tenant struct {
	ID          string
	RateLimit   int
	AllowedDBs  []int
	Permissions []string
}

type ResponseType string

const (
	ResponseTypeString  ResponseType = "string"
	ResponseTypeInteger ResponseType = "integer"
	ResponseTypeFloat   ResponseType = "float"
	ResponseTypeArray   ResponseType = "array"
	ResponseTypeNil     ResponseType = "nil"
	ResponseTypeBool    ResponseType = "boolean"
	ResponseTypeHash    ResponseType = "hash"
)
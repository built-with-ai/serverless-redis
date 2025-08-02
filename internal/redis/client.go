package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/scaler/serverless-redis/internal/types"
)

type Client struct {
	primary   *redis.Client
	dragonfly *redis.Client
	config    *types.Config
}

func NewClient(config *types.Config) (*Client, error) {
	// Initialize primary Redis client
	primaryOpts := &redis.Options{
		Addr:         config.Redis.Primary.Addr,
		Password:     config.Redis.Primary.Password,
		DB:           config.Redis.Primary.DB,
		MaxRetries:   config.Redis.Primary.MaxRetries,
		DialTimeout:  config.Redis.Primary.DialTimeout,
		ReadTimeout:  config.Redis.Primary.ReadTimeout,
		WriteTimeout: config.Redis.Primary.WriteTimeout,
		
		// Connection pool settings
		MinIdleConns:    config.Pool.MinIdleConns,
		MaxIdleConns:    config.Pool.MaxIdleConns,
		MaxActiveConns:  config.Pool.MaxActiveConns,
		ConnMaxIdleTime: config.Pool.IdleTimeout,
		ConnMaxLifetime: config.Pool.MaxConnAge,
		PoolTimeout:     config.Pool.PoolTimeout,
	}
	
	primary := redis.NewClient(primaryOpts)
	
	// Test primary connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := primary.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to primary Redis: %w", err)
	}
	
	client := &Client{
		primary: primary,
		config:  config,
	}
	
	// Initialize DragonflyDB client if enabled
	if config.Redis.Dragonfly.Enabled {
		dragonflyOpts := &redis.Options{
			Addr:     config.Redis.Dragonfly.Addr,
			Password: config.Redis.Dragonfly.Password,
			DB:       config.Redis.Dragonfly.DB,
			
			// Use same pool settings
			MinIdleConns:    config.Pool.MinIdleConns,
			MaxIdleConns:    config.Pool.MaxIdleConns,
			MaxActiveConns:  config.Pool.MaxActiveConns,
			ConnMaxIdleTime: config.Pool.IdleTimeout,
			ConnMaxLifetime: config.Pool.MaxConnAge,
			PoolTimeout:     config.Pool.PoolTimeout,
		}
		
		dragonfly := redis.NewClient(dragonflyOpts)
		
		// Test DragonflyDB connection
		if err := dragonfly.Ping(ctx).Err(); err != nil {
			return nil, fmt.Errorf("failed to connect to DragonflyDB: %w", err)
		}
		
		client.dragonfly = dragonfly
	}
	
	return client, nil
}

func (c *Client) ExecuteCommand(ctx context.Context, req types.CommandRequest) (interface{}, error) {
	// Select the appropriate client (DragonflyDB for performance, Redis for compatibility)
	redisClient := c.selectClient(req.Command)
	
	// Switch to the correct database if specified
	if req.DB != 0 {
		if err := redisClient.Do(ctx, "SELECT", req.DB).Err(); err != nil {
			return nil, fmt.Errorf("failed to select database %d: %w", req.DB, err)
		}
	}
	
	// Prepare command arguments
	args := make([]interface{}, len(req.Args)+1)
	args[0] = req.Command
	copy(args[1:], req.Args)
	
	// Execute the command
	result := redisClient.Do(ctx, args...)
	if result.Err() != nil {
		return nil, result.Err()
	}
	
	return result.Val(), nil
}

func (c *Client) ExecutePipeline(ctx context.Context, req types.PipelineRequest) []types.CommandResponse {
	redisClient := c.selectClient("")
	
	// Create pipeline
	pipe := redisClient.Pipeline()
	
	// Switch to correct database if specified
	if req.DB != 0 {
		pipe.Do(ctx, "SELECT", req.DB)
	}
	
	// Add all commands to pipeline
	cmds := make([]*redis.Cmd, len(req.Commands))
	for i, cmdReq := range req.Commands {
		args := make([]interface{}, len(cmdReq.Args)+1)
		args[0] = cmdReq.Command
		copy(args[1:], cmdReq.Args)
		cmds[i] = pipe.Do(ctx, args...)
	}
	
	// Execute pipeline
	start := time.Now()
	_, err := pipe.Exec(ctx)
	duration := time.Since(start).Seconds() * 1000
	
	// Collect results
	results := make([]types.CommandResponse, len(req.Commands))
	for i, cmd := range cmds {
		response := types.CommandResponse{
			Time: duration / float64(len(req.Commands)), // Distribute time across commands
		}
		
		if cmd.Err() != nil {
			response.Error = cmd.Err().Error()
		} else {
			response.Result = cmd.Val()
			response.Type = string(inferResponseType(cmd.Val()))
		}
		
		results[i] = response
	}
	
	// Handle pipeline error
	if err != nil && err != redis.Nil {
		// If pipeline failed, mark all commands as failed
		for i := range results {
			if results[i].Error == "" {
				results[i].Error = err.Error()
			}
		}
	}
	
	return results
}

func (c *Client) ExecuteTransaction(ctx context.Context, req types.TransactionRequest) (*types.TransactionResponse, error) {
	redisClient := c.selectClient("")
	
	start := time.Now()
	
	// Handle WATCH keys if specified
	if len(req.Watch) > 0 {
		watchArgs := make([]interface{}, len(req.Watch))
		for i, key := range req.Watch {
			watchArgs[i] = key
		}
		if err := redisClient.Do(ctx, append([]interface{}{"WATCH"}, watchArgs...)...).Err(); err != nil {
			return nil, fmt.Errorf("WATCH failed: %w", err)
		}
	}
	
	// Execute transaction
	results, err := redisClient.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		// Switch to correct database if specified
		if req.DB != 0 {
			pipe.Do(ctx, "SELECT", req.DB)
		}
		
		// Add all commands to transaction
		for _, cmdReq := range req.Commands {
			args := make([]interface{}, len(cmdReq.Args)+1)
			args[0] = cmdReq.Command
			copy(args[1:], cmdReq.Args)
			pipe.Do(ctx, args...)
		}
		
		return nil
	})
	
	duration := time.Since(start).Seconds() * 1000
	
	response := &types.TransactionResponse{
		Queued: len(req.Commands),
		Time:   duration,
	}
	
	if err != nil {
		// Transaction was discarded (WATCH key modified)
		response.Exec = false
		return response, nil
	}
	
	// Transaction executed successfully
	response.Exec = true
	response.Results = make([]types.CommandResponse, len(results))
	
	for i, result := range results {
		cmdResponse := types.CommandResponse{
			Time: duration / float64(len(results)),
		}
		
		if result.Err() != nil {
			cmdResponse.Error = result.Err().Error()
		} else {
			// Handle different Redis result types
			switch cmd := result.(type) {
			case *redis.StringCmd:
				val, _ := cmd.Result()
				cmdResponse.Result = val
			case *redis.IntCmd:
				val, _ := cmd.Result()
				cmdResponse.Result = val
			case *redis.SliceCmd:
				val, _ := cmd.Result()
				cmdResponse.Result = val
			case *redis.StatusCmd:
				val, _ := cmd.Result()
				cmdResponse.Result = val
			default:
				// Fallback for other command types
				cmdResponse.Result = "OK"
			}
			cmdResponse.Type = string(inferResponseType(cmdResponse.Result))
		}
		
		response.Results[i] = cmdResponse
	}
	
	return response, nil
}

func (c *Client) GetConnectionStats() map[string]int {
	stats := make(map[string]int)
	
	if c.primary != nil {
		poolStats := c.primary.PoolStats()
		stats["primary_hits"] = int(poolStats.Hits)
		stats["primary_misses"] = int(poolStats.Misses)
		stats["primary_timeouts"] = int(poolStats.Timeouts)
		stats["primary_total_conns"] = int(poolStats.TotalConns)
		stats["primary_idle_conns"] = int(poolStats.IdleConns)
		stats["primary_stale_conns"] = int(poolStats.StaleConns)
	}
	
	if c.dragonfly != nil {
		poolStats := c.dragonfly.PoolStats()
		stats["dragonfly_hits"] = int(poolStats.Hits)
		stats["dragonfly_misses"] = int(poolStats.Misses)
		stats["dragonfly_timeouts"] = int(poolStats.Timeouts)
		stats["dragonfly_total_conns"] = int(poolStats.TotalConns)
		stats["dragonfly_idle_conns"] = int(poolStats.IdleConns)
		stats["dragonfly_stale_conns"] = int(poolStats.StaleConns)
	}
	
	return stats
}

func (c *Client) Close() error {
	var err error
	
	if c.primary != nil {
		if closeErr := c.primary.Close(); closeErr != nil {
			err = closeErr
		}
	}
	
	if c.dragonfly != nil {
		if closeErr := c.dragonfly.Close(); closeErr != nil {
			err = closeErr
		}
	}
	
	return err
}

// selectClient chooses between DragonflyDB and Redis based on command type
func (c *Client) selectClient(command string) *redis.Client {
	// Use DragonflyDB for high-performance operations if available
	if c.dragonfly != nil {
		// Commands that benefit from DragonflyDB's multi-threading
		switch command {
		case "MGET", "MSET", "HMGET", "HMSET", "ZADD", "ZRANGE", "ZRANGEBYSCORE":
			return c.dragonfly
		}
	}
	
	// Default to Redis for maximum compatibility
	return c.primary
}

// inferResponseType determines the response type for JSON serialization
func inferResponseType(val interface{}) types.ResponseType {
	if val == nil {
		return types.ResponseTypeNil
	}
	
	switch val.(type) {
	case string:
		return types.ResponseTypeString
	case int, int64, uint64:
		return types.ResponseTypeInteger
	case float64:
		return types.ResponseTypeFloat
	case bool:
		return types.ResponseTypeBool
	case []interface{}:
		return types.ResponseTypeArray
	case map[string]interface{}:
		return types.ResponseTypeHash
	default:
		return types.ResponseTypeString
	}
}
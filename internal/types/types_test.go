package types

import (
	"testing"
	"time"
)

func TestCommandRequest(t *testing.T) {
	req := CommandRequest{
		Command: "SET",
		Args:    []interface{}{"key", "value"},
		DB:      0,
	}

	if req.Command != "SET" {
		t.Errorf("Expected command SET, got %s", req.Command)
	}

	if len(req.Args) != 2 {
		t.Errorf("Expected 2 args, got %d", len(req.Args))
	}

	if req.DB != 0 {
		t.Errorf("Expected DB 0, got %d", req.DB)
	}
}

func TestCommandResponse(t *testing.T) {
	resp := CommandResponse{
		Result: "OK",
		Type:   "string",
		Time:   1.5,
	}

	if resp.Result != "OK" {
		t.Errorf("Expected result OK, got %v", resp.Result)
	}

	if resp.Type != "string" {
		t.Errorf("Expected type string, got %s", resp.Type)
	}

	if resp.Time != 1.5 {
		t.Errorf("Expected time 1.5, got %f", resp.Time)
	}
}

func TestPipelineRequest(t *testing.T) {
	commands := []CommandRequest{
		{Command: "SET", Args: []interface{}{"key1", "value1"}},
		{Command: "GET", Args: []interface{}{"key1"}},
	}

	req := PipelineRequest{
		Commands: commands,
		DB:       1,
	}

	if len(req.Commands) != 2 {
		t.Errorf("Expected 2 commands, got %d", len(req.Commands))
	}

	if req.DB != 1 {
		t.Errorf("Expected DB 1, got %d", req.DB)
	}
}

func TestHealthResponse(t *testing.T) {
	connections := map[string]int{
		"active": 5,
		"idle":   10,
	}

	memory := MemoryStats{
		Alloc:        1024,
		TotalAlloc:   2048,
		Sys:          4096,
		NumGC:        3,
		NumGoroutine: 8,
	}

	resp := HealthResponse{
		Status:      "healthy",
		Version:     "1.0.0",
		Connections: connections,
		Uptime:      3600,
		Memory:      memory,
	}

	if resp.Status != "healthy" {
		t.Errorf("Expected status healthy, got %s", resp.Status)
	}

	if resp.Connections["active"] != 5 {
		t.Errorf("Expected 5 active connections, got %d", resp.Connections["active"])
	}

	if resp.Memory.Alloc != 1024 {
		t.Errorf("Expected 1024 memory alloc, got %d", resp.Memory.Alloc)
	}
}

func TestErrorResponse(t *testing.T) {
	now := time.Now().Unix()
	resp := ErrorResponse{
		Error:   "Invalid command",
		Code:    "400",
		Details: "Command not found",
		Time:    now,
	}

	if resp.Error != "Invalid command" {
		t.Errorf("Expected error 'Invalid command', got %s", resp.Error)
	}

	if resp.Code != "400" {
		t.Errorf("Expected code 400, got %s", resp.Code)
	}

	if resp.Time != now {
		t.Errorf("Expected time %d, got %d", now, resp.Time)
	}
}

func TestResponseTypes(t *testing.T) {
	tests := []struct {
		name     string
		respType ResponseType
		expected string
	}{
		{"String", ResponseTypeString, "string"},
		{"Integer", ResponseTypeInteger, "integer"},
		{"Float", ResponseTypeFloat, "float"},
		{"Array", ResponseTypeArray, "array"},
		{"Nil", ResponseTypeNil, "nil"},
		{"Boolean", ResponseTypeBool, "boolean"},
		{"Hash", ResponseTypeHash, "hash"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.respType) != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, string(tt.respType))
			}
		})
	}
}
.PHONY: build run test clean deps lint fmt docker

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=gofmt

# Binary info
BINARY_NAME=serverless-redis
BINARY_UNIX=$(BINARY_NAME)_unix
MAIN_PATH=./cmd/server
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS=-ldflags "-X main.Version=$(VERSION)"

# Build the binary
build:
	$(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME) -v $(MAIN_PATH)

# Run the application  
run: build
	./$(BINARY_NAME)

# Run with development config
dev:
	$(GOCMD) run $(MAIN_PATH)/main.go

# Test all packages
test:
	$(GOTEST) -v ./...

# Test with coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out

# Clean build artifacts
clean:
	$(GOCLEAN)
	rm -f $(BINARY_NAME)
	rm -f $(BINARY_UNIX)
	rm -f coverage.out

# Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Lint code
lint:
	golangci-lint run

# Format code
fmt:
	$(GOFMT) -s -w .

# Build for Linux
build-linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_UNIX) -v $(MAIN_PATH)

# Build for multiple platforms
build-all:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-linux-amd64 $(MAIN_PATH)
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-darwin-amd64 $(MAIN_PATH)
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-darwin-arm64 $(MAIN_PATH)
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME)-windows-amd64.exe $(MAIN_PATH)

# Docker build
docker:
	docker build -t serverless-redis:$(VERSION) .
	docker build -t serverless-redis:latest .

# Docker run
docker-run:
	docker run -p 8080:8080 -v $(PWD)/config.yaml:/config.yaml serverless-redis:latest

# Install development tools
install-tools:
	$(GOGET) -u github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Generate benchmarks
bench:
	$(GOTEST) -bench=. -benchmem ./...

# Load test (requires redis-server running)
load-test:
	@echo "Starting load test..."
	@curl -X POST http://localhost:8080/v1/pipeline \
		-H "Authorization: Bearer test-api-key-12345" \
		-H "Content-Type: application/json" \
		-d '{"commands":[{"command":"SET","args":["test","value"]},{"command":"GET","args":["test"]}]}'

# Health check
health:
	curl -s http://localhost:8080/health | jq .

# Show metrics
metrics:
	curl -s http://localhost:8080/metrics

# Setup development environment
setup: deps install-tools
	@echo "Development environment ready!"

# Production build (optimized)
build-prod:
	CGO_ENABLED=0 $(GOBUILD) $(LDFLAGS) -a -installsuffix cgo -o $(BINARY_NAME) $(MAIN_PATH)

# Help
help:
	@echo "Available targets:"
	@echo "  build        - Build the binary"
	@echo "  run          - Build and run the application"
	@echo "  dev          - Run with go run (development)"
	@echo "  test         - Run tests"
	@echo "  test-coverage- Run tests with coverage"
	@echo "  clean        - Clean build artifacts"
	@echo "  deps         - Download dependencies"
	@echo "  lint         - Lint code"
	@echo "  fmt          - Format code"
	@echo "  build-linux  - Build for Linux"
	@echo "  build-all    - Build for multiple platforms"
	@echo "  docker       - Build Docker image"
	@echo "  docker-run   - Run Docker container"
	@echo "  bench        - Run benchmarks"
	@echo "  load-test    - Simple load test"
	@echo "  health       - Check health endpoint"
	@echo "  metrics      - Show metrics"
	@echo "  setup        - Setup development environment"
	@echo "  help         - Show this help"
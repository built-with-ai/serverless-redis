#!/bin/bash

# Serverless Redis SDK Publishing Script
set -e

echo "🚀 Starting SDK publishing process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    print_error "This script must be run from the client-sdks directory"
    exit 1
fi

# Check if we're on the main branch (for production releases)
if [ "$1" != "--force" ]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [ "$CURRENT_BRANCH" != "main" ]; then
        print_warning "You're not on the main branch. Use --force to publish from $CURRENT_BRANCH"
        exit 1
    fi
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run tests
print_status "Running tests..."
npm run test

# Run linting
print_status "Running linter..."
npm run lint

# Run type checking
print_status "Running type checking..."
npm run type-check

# Build packages
print_status "Building packages..."
npm run build

# Verify all packages have dist directories
print_status "Verifying build artifacts..."
for package_dir in packages/*/; do
    if [ -d "$package_dir/dist" ]; then
        print_success "$package_dir built successfully"
    else
        print_error "$package_dir build failed - no dist directory found"
        exit 1
    fi
done

# Check npm authentication
print_status "Checking NPM authentication..."
if ! npm whoami > /dev/null 2>&1; then
    print_error "Not logged in to NPM. Run 'npm login' first."
    exit 1
fi

NPM_USER=$(npm whoami)
print_success "Logged in as: $NPM_USER"

# Define packages in dependency order
PACKAGES=(
    "packages/core"
    "packages/nextjs"
    "packages/vercel"
    "packages/cloudflare"
    "packages/aws-lambda"
)

# Check versions and prepare for publishing
print_status "Checking package versions..."
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        CURRENT_VERSION=$(jq -r '.version' "$package_dir/package.json")
        
        # Check if this version is already published
        PUBLISHED_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "none")
        
        if [ "$PUBLISHED_VERSION" = "$CURRENT_VERSION" ]; then
            print_warning "$PACKAGE_NAME@$CURRENT_VERSION is already published"
        else
            print_status "$PACKAGE_NAME: $PUBLISHED_VERSION -> $CURRENT_VERSION"
        fi
    fi
done

# Confirm publication
if [ "$1" != "--yes" ] && [ "$1" != "-y" ]; then
    echo ""
    read -p "Proceed with publishing? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Publishing cancelled"
        exit 0
    fi
fi

# Publish packages in order
print_status "Publishing packages..."
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        CURRENT_VERSION=$(jq -r '.version' "$package_dir/package.json")
        
        print_status "Publishing $PACKAGE_NAME@$CURRENT_VERSION..."
        
        cd "$package_dir"
        
        # Publish with retry logic
        RETRY_COUNT=0
        MAX_RETRIES=3
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if npm publish --access public; then
                print_success "Published $PACKAGE_NAME@$CURRENT_VERSION"
                break
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                    print_warning "Publish failed, retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
                    sleep 5
                else
                    print_error "Failed to publish $PACKAGE_NAME after $MAX_RETRIES attempts"
                    exit 1
                fi
            fi
        done
        
        cd - > /dev/null
    fi
done

# Verify publications
print_status "Verifying publications..."
sleep 10 # Wait for NPM registry to update

for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        EXPECTED_VERSION=$(jq -r '.version' "$package_dir/package.json")
        
        PUBLISHED_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "none")
        
        if [ "$PUBLISHED_VERSION" = "$EXPECTED_VERSION" ]; then
            print_success "$PACKAGE_NAME@$EXPECTED_VERSION verified on NPM"
        else
            print_error "$PACKAGE_NAME verification failed. Expected: $EXPECTED_VERSION, Found: $PUBLISHED_VERSION"
        fi
    fi
done

print_success "🎉 All packages published successfully!"

# Create git tag
CORE_VERSION=$(jq -r '.version' "packages/core/package.json")
GIT_TAG="sdk-v$CORE_VERSION"

if git tag -l | grep -q "^$GIT_TAG$"; then
    print_warning "Git tag $GIT_TAG already exists"
else
    print_status "Creating git tag: $GIT_TAG"
    git tag "$GIT_TAG"
    git push origin "$GIT_TAG"
    print_success "Git tag created and pushed"
fi

echo ""
print_success "✅ Publication complete!"
echo ""
echo "Published packages:"
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        PACKAGE_VERSION=$(jq -r '.version' "$package_dir/package.json")
        echo "  📦 $PACKAGE_NAME@$PACKAGE_VERSION"
    fi
done
echo ""
echo "Install with:"
echo "  npm install @builtwithai/serverless-redis-client"
echo "  npm install @builtwithai/serverless-redis-nextjs"
echo "  npm install @builtwithai/serverless-redis-vercel"
echo "  npm install @builtwithai/serverless-redis-cloudflare"
echo "  npm install @builtwithai/serverless-redis-aws-lambda"
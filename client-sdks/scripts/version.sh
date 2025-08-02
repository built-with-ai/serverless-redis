#!/bin/bash

# Serverless Redis SDK Version Management Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

show_usage() {
    echo "Usage: $0 <version_type> [--dry-run]"
    echo ""
    echo "Version types:"
    echo "  patch     Increment patch version (1.0.0 -> 1.0.1)"  
    echo "  minor     Increment minor version (1.0.0 -> 1.1.0)"
    echo "  major     Increment major version (1.0.0 -> 2.0.0)"
    echo "  <version> Set specific version (e.g., 1.2.3)"
    echo ""
    echo "Options:"
    echo "  --dry-run Show what would be changed without making changes"
    echo ""
    echo "Examples:"
    echo "  $0 patch"
    echo "  $0 minor --dry-run"
    echo "  $0 1.2.3"
}

# Parse arguments
VERSION_TYPE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            if [ -z "$VERSION_TYPE" ]; then
                VERSION_TYPE="$1"
            else
                print_error "Unknown argument: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

if [ -z "$VERSION_TYPE" ]; then
    print_error "Version type is required"
    show_usage
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    print_error "This script must be run from the client-sdks directory"
    exit 1
fi

# Define packages
PACKAGES=(
    "packages/core"
    "packages/nextjs"
    "packages/vercel"
    "packages/cloudflare"
    "packages/aws-lambda"
)

# Get current version from core package
CURRENT_VERSION=$(jq -r '.version' "packages/core/package.json")
print_status "Current version: $CURRENT_VERSION"

# Calculate new version
calculate_new_version() {
    local current="$1"
    local type="$2"
    
    # If it's a specific version, validate and return it
    if [[ "$type" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "$type"
        return
    fi
    
    # Parse current version
    IFS='.' read -ra VERSION_PARTS <<< "$current"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}
    
    case "$type" in
        patch)
            echo "$MAJOR.$MINOR.$((PATCH + 1))"
            ;;
        minor)
            echo "$MAJOR.$((MINOR + 1)).0"
            ;;
        major)
            echo "$((MAJOR + 1)).0.0"
            ;;
        *)
            print_error "Invalid version type: $type"
            exit 1
            ;;
    esac
}

NEW_VERSION=$(calculate_new_version "$CURRENT_VERSION" "$VERSION_TYPE")
print_status "New version: $NEW_VERSION"

# Validate new version
if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
    print_warning "New version is the same as current version"
    exit 0
fi

# Show what will be changed
echo ""
print_status "The following packages will be updated:"
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        echo "  📦 $PACKAGE_NAME: $CURRENT_VERSION -> $NEW_VERSION"
    fi
done

if [ "$DRY_RUN" = true ]; then
    print_warning "Dry run mode - no changes will be made"
    exit 0
fi

# Confirm changes
echo ""
read -p "Proceed with version update? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Version update cancelled"
    exit 0
fi

# Update package versions
print_status "Updating package versions..."
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_NAME=$(jq -r '.name' "$package_dir/package.json")
        
        # Update version in package.json
        jq --arg version "$NEW_VERSION" '.version = $version' "$package_dir/package.json" > "$package_dir/package.json.tmp"
        mv "$package_dir/package.json.tmp" "$package_dir/package.json"
        
        print_success "Updated $PACKAGE_NAME to $NEW_VERSION"
    fi
done

# Update internal dependencies
print_status "Updating internal dependencies..."
for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        PACKAGE_JSON="$package_dir/package.json"
        
        # Update dependencies that reference other packages in this monorepo
        if jq -e '.dependencies["@builtwithai/serverless-redis-client"]' "$PACKAGE_JSON" > /dev/null; then
            jq --arg version "^$NEW_VERSION" '.dependencies["@builtwithai/serverless-redis-client"] = $version' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
            mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
        fi
        
        # Update peerDependencies if they reference our packages
        if jq -e '.peerDependencies' "$PACKAGE_JSON" > /dev/null; then
            for peer_dep in $(jq -r '.peerDependencies | keys[]' "$PACKAGE_JSON"); do
                if [[ "$peer_dep" == @builtwithai/serverless-redis-* ]]; then
                    jq --arg dep "$peer_dep" --arg version "^$NEW_VERSION" '.peerDependencies[$dep] = $version' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
                    mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
                fi
            done
        fi
    fi
done

# Update root package.json version
print_status "Updating root package version..."
jq --arg version "$NEW_VERSION" '.version = $version' "package.json" > "package.json.tmp"
mv "package.json.tmp" "package.json"

# Create changeset entry
print_status "Creating changeset entry..."
CHANGESET_FILE=".changeset/version-$NEW_VERSION.md"

cat > "$CHANGESET_FILE" << EOF
---
"@builtwithai/serverless-redis-client": $VERSION_TYPE
"@builtwithai/serverless-redis-nextjs": $VERSION_TYPE
"@builtwithai/serverless-redis-vercel": $VERSION_TYPE
"@builtwithai/serverless-redis-cloudflare": $VERSION_TYPE
"@builtwithai/serverless-redis-aws-lambda": $VERSION_TYPE
---

Version bump to $NEW_VERSION
EOF

print_success "Created changeset: $CHANGESET_FILE"

# Show git status
print_status "Git status:"
git status --porcelain

echo ""
print_success "✅ Version update complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit the changes: git add . && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "3. Create a pull request or merge to main"
echo "4. Run the publish script: ./scripts/publish.sh"
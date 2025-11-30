#!/bin/bash

# Security Verification Script
# This script checks if sensitive files are properly protected

echo "Security Verification Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env files are in .gitignore
echo "📋 Checking .gitignore configuration..."
if grep -q "\.env" .gitignore; then
    echo -e "${GREEN}✓${NC} .env patterns found in .gitignore"
else
    echo -e "${RED}✗${NC} .env patterns NOT found in .gitignore"
    exit 1
fi

# Check if .env files are tracked by git
echo ""
echo "🔍 Checking for tracked .env files..."
TRACKED_ENV=$(git ls-files | grep -E '\.env$|\.env\.local$|\.env\.development$|\.env\.production$' || true)

if [ -z "$TRACKED_ENV" ]; then
    echo -e "${GREEN}✓${NC} No .env files are tracked by Git"
else
    echo -e "${RED}✗${NC} WARNING: The following .env files are tracked:"
    echo "$TRACKED_ENV"
    echo ""
    echo "Run the following to remove them:"
    echo "  git rm --cached <file>"
    exit 1
fi

# Check if .env.example files exist
echo ""
echo "📄 Checking for .env.example templates..."
if [ -f "server/.env.example" ]; then
    echo -e "${GREEN}✓${NC} server/.env.example exists"
else
    echo -e "${YELLOW}⚠${NC}  server/.env.example not found"
fi

if [ -f "client/.env.example" ]; then
    echo -e "${GREEN}✓${NC} client/.env.example exists"
else
    echo -e "${YELLOW}⚠${NC}  client/.env.example not found"
fi

# Check if actual .env files are ignored
echo ""
echo "🛡️  Verifying .env files are ignored..."

if [ -f "server/.env" ]; then
    if git check-ignore -q server/.env; then
        echo -e "${GREEN}✓${NC} server/.env is properly ignored"
    else
        echo -e "${RED}✗${NC} server/.env is NOT ignored!"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC}  server/.env does not exist (create from .env.example)"
fi

if [ -f "client/.env" ]; then
    if git check-ignore -q client/.env; then
        echo -e "${GREEN}✓${NC} client/.env is properly ignored"
    else
        echo -e "${RED}✗${NC} client/.env is NOT ignored!"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC}  client/.env does not exist (create from .env.example)"
fi

# Check for common sensitive files
echo ""
echo "🔐 Checking for other sensitive files..."
SENSITIVE_PATTERNS=("*.pem" "*.key" "credentials.json" "serviceAccountKey.json" "secrets.json")

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    FOUND=$(find . -name "$pattern" -not -path "*/node_modules/*" 2>/dev/null || true)
    if [ -n "$FOUND" ]; then
        echo -e "${YELLOW}⚠${NC}  Found files matching $pattern:"
        echo "$FOUND"
        echo "   Make sure these are in .gitignore!"
    fi
done

echo ""
echo "================================"
echo -e "${GREEN}✓ Security verification complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Copy .env.example files to .env and add your secrets"
echo "2. Never commit .env files to Git"
echo "3. Review SECURITY.md for best practices"

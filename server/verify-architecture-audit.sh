#!/bin/bash
# Architecture Audit Verification Script
# Purpose: Verify orphan controller detection and active route usage
# Run from: /server directory

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Backend Architecture Audit - Verification Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Change to server directory
cd "$(dirname "$0")" || exit 1

echo "📁 Working directory: $(pwd)"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. VERIFY ORPHAN CONTROLLERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━ 1. CHECKING FOR ORPHAN CONTROLLERS ━━━"
echo ""

# Check if channelController.js in controllers/ is still used
echo "🔎 Searching for: controllers/channelController imports..."
CHANNEL_REFS=$(grep -r "require.*controllers/channelController" routes/ 2>/dev/null || echo "")

if [ -z "$CHANNEL_REFS" ]; then
  echo "✅ CONFIRMED ORPHAN: controllers/channelController.js"
  echo "   → NOT referenced in any route file"
  echo "   → Safe to deprecate"
else
  echo "⚠️  STILL USED: controllers/channelController.js"
  echo "$CHANNEL_REFS"
fi
echo ""

# Check if pollController.js in controllers/ is still used
echo "🔎 Searching for: controllers/pollController imports..."
POLL_REFS=$(grep -r "require.*controllers/pollController" routes/ 2>/dev/null || echo "")

if [ -z "$POLL_REFS" ]; then
  echo "✅ CONFIRMED ORPHAN: controllers/pollController.js"
  echo "   → NOT referenced in any route file"
  echo "   → Safe to deprecate"
else
  echo "⚠️  STILL USED: controllers/pollController.js"
  echo "$POLL_REFS"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. VERIFY MIGRATED ROUTES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━ 2. VERIFYING MIGRATED ROUTES ━━━"
echo ""

echo "🔎 Routes using NEW architecture (src/features/ or src/modules/)..."
grep -h "require.*src/features" routes/*.js 2>/dev/null | sed 's/^/   → /'
grep -h "require.*src/modules" routes/*.js 2>/dev/null | sed 's/^/   → /'
echo ""

echo "🔎 Routes still using LEGACY architecture (controllers/)..."
grep -h "require.*controllers/" routes/*.js 2>/dev/null | sed 's/^/   → /' || echo "   ✅ None found"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. COUNT ACTIVE vs MIGRATED
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━ 3. MIGRATION STATISTICS ━━━"
echo ""

TOTAL_CONTROLLERS=$(find controllers/ -name "*.js" -type f | wc -l | tr -d ' ')
TOTAL_ROUTES=$(find routes/ -name "*.js" -type f | wc -l | tr -d ' ')
LEGACY_IMPORTS=$(grep -r "require.*controllers/" routes/ 2>/dev/null | wc -l | tr -d ' ')
MODULAR_IMPORTS=$(grep -r "require.*src/features\|require.*src/modules" routes/ 2>/dev/null | wc -l | tr -d ' ')

echo "📊 Legacy Architecture (controllers/):"
echo "   ├─ Total controller files: $TOTAL_CONTROLLERS"
echo "   └─ Active imports from routes: $LEGACY_IMPORTS"
echo ""

echo "📊 Modular Architecture (src/):"
echo "   ├─ Active imports from routes: $MODULAR_IMPORTS"
echo "   └─ Migration progress: ~$(( MODULAR_IMPORTS * 100 / (LEGACY_IMPORTS + MODULAR_IMPORTS) ))%"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. CHECK FOR DYNAMIC REQUIRES (RISK)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━ 4. CHECKING FOR DYNAMIC REQUIRES (RISK) ━━━"
echo ""

echo "🔎 Searching for dynamic require() patterns..."
DYNAMIC_REQUIRES=$(grep -r 'require(\`' . --include="*.js" --exclude-dir=node_modules 2>/dev/null || echo "")
DYNAMIC_REQUIRES+=$(grep -r 'require(.*+.*Controller' . --include="*.js" --exclude-dir=node_modules 2>/dev/null || echo "")

if [ -z "$DYNAMIC_REQUIRES" ]; then
  echo "✅ No dynamic requires found"
  echo "   → Safe to delete orphan controllers"
else
  echo "⚠️  DYNAMIC REQUIRES DETECTED:"
  echo "$DYNAMIC_REQUIRES"
  echo "   → Review these before deletion"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. SUMMARY & RECOMMENDATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 AUDIT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Architecture Status:"
echo "  • Legacy MVC: $LEGACY_IMPORTS active routes"
echo "  • Modular DDD: $MODULAR_IMPORTS active routes"
echo ""
echo "Next Steps:"
echo "  1. Create .deprecated/ folder"
echo "  2. Move orphan controllers to .deprecated/"
echo "  3. Deploy to staging and monitor for 48 hours"
echo "  4. If no errors, proceed with Phase 3 migration"
echo ""
echo "✅ Audit verification complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

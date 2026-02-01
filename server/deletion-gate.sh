#!/bin/bash
# Deletion Safety Gate Validator
# Run this before deleting ANY legacy file
# Exit code 0 = SAFE, Exit code 1 = UNSAFE

set -e

FILE_TO_DELETE="$1"

if [ -z "$FILE_TO_DELETE" ]; then
  echo "Usage: ./deletion-gate.sh <file-to-delete>"
  echo "Example: ./deletion-gate.sh controllers/companyController.js"
  exit 1
fi

cd "$(dirname "$0")" || exit 1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 DELETION SAFETY GATE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $FILE_TO_DELETE"
echo ""

# Extract filename
BASENAME=$(basename "$FILE_TO_DELETE")
FILENAME="${BASENAME%.*}"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GATE 1: File exists
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if [ ! -f "$FILE_TO_DELETE" ]; then
  echo "✅ GATE 1: File already deleted"
else
  echo "⚠️  GATE 1: File exists, proceeding with checks..."
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GATE 2: Zero direct imports
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━ GATE 2: Checking Direct Imports ━━━"
IMPORT_COUNT=$(grep -r "require.*$FILENAME" routes/ 2>/dev/null | wc -l | tr -d ' ')

if [ "$IMPORT_COUNT" -eq 0 ]; then
  echo "✅ GATE 2 PASSED: Zero direct imports found"
else
  echo "❌ GATE 2 FAILED: $IMPORT_COUNT imports found:"
  grep -r "require.*$FILENAME" routes/ 2>/dev/null | head -5
  echo ""
  echo "🚨 UNSAFE TO DELETE - File still in use"
  exit 1
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GATE 3: Zero cross-references
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━ GATE 3: Checking Cross-References ━━━"
XREF_COUNT=$(grep -r "$FILENAME" src/ 2>/dev/null | grep -v ".test.js" | wc -l | tr -d ' ')

if [ "$XREF_COUNT" -eq 0 ]; then
  echo "✅ GATE 3 PASSED: Zero cross-references in src/"
else
  echo "⚠️  GATE 3 WARNING: $XREF_COUNT references in src/"
  grep -r "$FILENAME" src/ 2>/dev/null | grep -v ".test.js" | head -3
  read -p "   Continue anyway? (yes/NO): " CONTINUE
  if [ "$CONTINUE" != "yes" ]; then
    echo "❌ GATE 3 ABORTED"
    exit 1
  fi
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GATE 4: Replacement exists (if controller)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if [[ "$FILE_TO_DELETE" == controllers/* ]]; then
  echo "━━━ GATE 4: Checking Replacement ━━━"
  
  # Try to find replacement in src/features/
  FEATURE_NAME=$(echo "$FILENAME" | sed 's/Controller$//')
  REPLACEMENT_PATH="src/features/${FEATURE_NAME}/${FEATURE_NAME}.controller.js"
  
  if [ -f "$REPLACEMENT_PATH" ]; then
    echo "✅ GATE 4 PASSED: Replacement found at $REPLACEMENT_PATH"
  else
    echo "⚠️  GATE 4 WARNING: No replacement found at $REPLACEMENT_PATH"
    read -p "   Is this file an orphan? (yes/NO): " IS_ORPHAN
    if [ "$IS_ORPHAN" != "yes" ]; then
      echo "❌ GATE 4 FAILED - Migration not complete"
      exit 1
    fi
  fi
  echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GATE 5: Production uptime check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━ GATE 5: Production Stability ━━━"
echo "⚠️  MANUAL CHECK REQUIRED:"
echo "   1. Has production been stable for 72+ hours?"
echo "   2. Are there zero errors in logs?"
echo "   3. Have you created a backup?"
echo ""
read -p "Confirm all checks passed (yes/NO): " PROD_STABLE

if [ "$PROD_STABLE" != "yes" ]; then
  echo "❌ GATE 5 FAILED - Production not stable"
  exit 1
fi
echo "✅ GATE 5 PASSED: Manual confirmation received"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FINAL VERDICT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL GATES PASSED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🗑️  SAFE TO DELETE: $FILE_TO_DELETE"
echo ""
echo "Recommended command:"
echo "  git rm $FILE_TO_DELETE"
echo "  git commit -m \"chore: delete $FILENAME (migration complete)\""
echo ""

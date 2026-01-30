#!/bin/bash

# Script to update the structure.txt file with the current directory tree
# Usage: ./update-structure.sh

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script directory
cd "$SCRIPT_DIR"

# Generate the tree structure
# -L 7: maximum depth of 7 levels
# -I: exclude patterns (node_modules, .git, build, dist, coverage)
tree -L 7 -I 'node_modules|.git|build|dist|coverage' > structure.txt

echo "✅ structure.txt has been updated successfully!"

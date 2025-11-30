#!/bin/bash

# File Migration Script for Restructuring
# Run this from the client directory

echo "🚀 Starting file migration..."

# Home widgets
echo "📁 Moving home widgets..."
cp -r src/components/homewidgets/* src/components/home/widgets/

# Blog/Updates
echo "📁 Moving updates..."
cp -r src/components/blogsComp/* src/components/updates/

# Tasks
echo "📁 Moving tasks..."
cp -r src/components/tasksComp/* src/components/tasks/

# AI components
echo "📁 Moving AI components..."
cp -r src/components/chttrixAIComp/* src/components/ai/ChttrixAIChat/

# Common UI
echo "📁 Moving UI components..."
cp -r src/components/ui/* src/components/common/ui/

# Modals
echo "📁 Moving modals..."
cp -r src/components/modals/* src/components/common/modals/

echo "✅ File migration complete!"
echo "⚠️  Note: Original files preserved in old locations"
echo "📝 Next: Update import paths and test the application"

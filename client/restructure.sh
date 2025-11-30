#!/bin/bash

# Chttrix Client Restructuring Script
# This script automates the reorganization of the client-side codebase

set -e

echo "🚀 Starting Chttrix Client Restructuring..."

# Navigate to client directory
cd "$(dirname "$0")"

# Phase 1: Move existing files that don't need breaking down

echo "📁 Phase 1: Moving existing files to new structure..."

# Move home widgets
echo "  → Moving home widgets..."
mv src/components/homewidgets/* src/components/home/widgets/ 2>/dev/null || true

# Move blog components
echo "  → Moving blog/updates components..."
mv src/components/blogsComp/* src/components/updates/ 2>/dev/null || true

# Move task components
echo "  → Moving task components..."
mv src/components/tasksComp/* src/components/tasks/ 2>/dev/null || true

# Move existing chat window subcomponents
echo "  → Moving chat window components..."
cp -r src/components/messagesComp/chatWindowComp/header src/components/messages/chat/header/ 2>/dev/null || true
cp -r src/components/messagesComp/chatWindowComp/messages src/components/messages/chat/messages/ 2>/dev/null || true
cp -r src/components/messagesComp/chatWindowComp/footer src/components/messages/chat/footer/ 2>/dev/null || true
cp -r src/components/messagesComp/chatWindowComp/pinned src/components/messages/chat/pinned/ 2>/dev/null || true
cp -r src/components/messagesComp/chatWindowComp/helpers src/components/messages/chat/helpers/ 2>/dev/null || true

# Move thread panel
cp src/components/messagesComp/chatWindowComp/ThreadPanel.jsx src/components/messages/chat/thread/ 2>/dev/null || true

# Move modals
echo "  → Moving message modals..."
mv src/components/messagesComp/CreateChannelModal.jsx src/components/messages/modals/ 2>/dev/null || true
mv src/components/messagesComp/JoinChannelModal.jsx src/components/messages/modals/ 2>/dev/null || true
mv src/components/messagesComp/NewDMModal.jsx src/components/messages/modals/ 2>/dev/null || true
mv src/components/messagesComp/BroadcastModal.jsx src/components/messages/modals/ 2>/dev/null || true

# Move broadcast components
echo "  → Moving broadcast components..."
mv src/components/messagesComp/BroadcastView.jsx src/components/messages/broadcast/ 2>/dev/null || true
mv src/components/messagesComp/BroadcastChatWindow.jsx src/components/messages/broadcast/ 2>/dev/null || true

# Move panels
echo "  → Moving panel components..."
cp src/components/layout/panels/MessagesPanel.jsx src/components/messages/panels/ 2>/dev/null || true
cp -r src/components/layout/panels src/components/layout/ 2>/dev/null || true

# Move profile components
echo "  → Moving profile components..."
mv src/components/SidebarComp/Sidebar.jsx src/components/profile/ 2>/dev/null || true

# Move common/shared components
echo "  → Moving common components..."
mv src/components/RequireAuth.jsx src/components/common/ 2>/dev/null || true
mv src/components/modals/* src/components/common/modals/ 2>/dev/null || true
mv src/components/ui/* src/components/common/ui/ 2>/dev/null || true

# Move pages
echo "  → Moving page components..."
mv src/pages/LoginPageComp/* src/pages/auth/ 2>/dev/null || true
mv src/pages/VerifyEmail.jsx src/pages/auth/ 2>/dev/null || true
mv src/pages/SidebarComp/Home.jsx src/pages/workspace/ 2>/dev/null || true
mv src/pages/SidebarComp/Messages.jsx src/pages/workspace/ 2>/dev/null || true
mv src/pages/SidebarComp/Blogs.jsx src/pages/workspace/ 2>/dev/null || true
mv src/pages/SidebarComp/Notes.jsx src/pages/workspace/ 2>/dev/null || true

echo "✅ Phase 1 Complete: Files moved to new structure"

echo ""
echo "⚠️  Next Steps (Manual):"
echo "   1. Break down large components (HomePanel, ChatWindow, ProfileSidebar, etc.)"
echo "   2. Update all import paths throughout the codebase"
echo "   3. Remove old empty directories"
echo "   4. Test the application"

echo ""
echo "🎯 Restructuring foundation complete!"

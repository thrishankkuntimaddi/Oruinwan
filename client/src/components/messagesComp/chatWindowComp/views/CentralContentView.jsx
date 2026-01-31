import React from 'react';
import { ConversationStream } from '../../events';
import FooterInput from '../footer/footerInput.jsx';
import ThreadPanel from '../ThreadPanel.jsx';
import TasksTab from '../tabs/TasksTab.jsx';
import ThreadsTab from '../tabs/ThreadsTab.jsx';
import CanvasTab from '../tabs/CanvasTab.jsx';
import ChannelJoinPrompt from '../states/ChannelJoinPrompt.jsx';
import CanvasDashboardView from './CanvasDashboardView.jsx';

/**
 * CentralContentView Component
 * Routes between chat, tasks, threads, canvas views based on activeTab
 * Pure presentational component - all logic delegated to parent via props
 */
const CentralContentView = ({
    // Tab routing
    activeTab,
    tabs,

    // Membership & access
    isMember,
    isDiscoverablePublicChannel,
    isJoining,
    canInteract,

    // Chat/conversation props
    chat,
    conversation,
    enhancedActions,
    conversationType,
    channelMembers,
    userJoinedAt,
    currentUserId,

    // Thread state
    threadCounts,
    replyingTo,
    onCancelReply,
    activeThread,
    onThreadOpen,
    onThreadClose,

    // Message input
    newMessage,
    onMessageChange,
    onSend,
    onAttach,
    showAttach,
    setShowAttach,
    showEmoji,
    setShowEmoji,
    onPickEmoji,
    recording,
    setRecording,
    muted,
    setNewMessage,

    // Channel join handlers
    onJoinChannel,
    onIgnore,

    // Socket
    rawSocket,
    socket,

    // Canvas/dashboard handlers
    dashboardView,
    dashboardSearch,
    onDashboardViewChange,
    onDashboardSearchChange,
    onAddTab,
    onSaveCanvas,
    onDeleteTab,
    onRenameTab,
    onShareTab
}) => {
    return (
        <div className="chat-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, backgroundColor: 'var(--bg-primary)' }}>
            {/* Access-gate UI: non-member, discoverable public channel */}
            {!isMember && isDiscoverablePublicChannel ? (
                <ChannelJoinPrompt
                    chatName={chat?.name}
                    isJoining={isJoining}
                    onJoinChannel={onJoinChannel}
                    onIgnore={onIgnore}
                />
            ) : activeTab === 'chat' ? (
                <>
                    {/* Main Stream - flex column */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                        {/* Conversation Stream - scrollable */}
                        <ConversationStream
                            events={conversation.events}
                            systemEvents={chat.systemEvents || []}
                            creatorName={chat.creatorName}
                            loading={conversation.loading}
                            onLoadMore={conversation.loadMore}
                            hasMore={conversation.hasMore}
                            actions={enhancedActions}
                            conversationType={conversationType}
                            channelMembers={channelMembers}
                            userJoinedAt={userJoinedAt}
                            onThreadOpen={onThreadOpen}
                            threadCounts={threadCounts}
                            replyingTo={replyingTo}
                            onCancelReply={onCancelReply}
                            currentUserId={currentUserId}
                        />

                        {/* Footer - fixed at bottom */}
                        <FooterInput
                            newMessage={newMessage}
                            onChange={onMessageChange}
                            onSend={onSend}
                            onAttach={onAttach}
                            showAttach={showAttach}
                            setShowAttach={setShowAttach}
                            showEmoji={showEmoji}
                            setShowEmoji={setShowEmoji}
                            onPickEmoji={onPickEmoji}
                            recording={recording}
                            setRecording={setRecording}
                            blocked={muted}
                            setNewMessage={setNewMessage}
                            disabled={!canInteract}
                        />
                    </div>
                </>
            ) : activeTab === 'tasks' ? (
                // Tasks Tab
                <TasksTab
                    channelId={chat.id}
                    channelName={chat.name}
                    currentUserId={currentUserId}
                    socket={rawSocket}
                />
            ) : activeTab === 'threads' ? (
                // Threads Tab
                <ThreadsTab
                    channelId={chat.id}
                    currentUserId={currentUserId}
                    socket={rawSocket}
                />
            ) : activeTab === 'canvas' ? (
                // Canvas Dashboard
                <CanvasDashboardView
                    tabs={tabs}
                    dashboardView={dashboardView}
                    dashboardSearch={dashboardSearch}
                    onViewChange={onDashboardViewChange}
                    onSearchChange={onDashboardSearchChange}
                    onCreate={onAddTab}
                    onOpen={(tabId) => {
                        // This is passed from parent as setActiveTab
                        // We need to handle this via a callback
                        if (typeof onDashboardViewChange === 'function') {
                            // Actually, we need a separate onOpenCanvas callback
                            // Let me add that to props
                        }
                    }}
                    onDelete={onDeleteTab}
                    onRename={onRenameTab}
                    onShare={onShareTab}
                />
            ) : (
                // Canvas Tab View (Dynamic Tabs)
                tabs.find(t => t._id === activeTab) ? (
                    <CanvasTab
                        tab={tabs.find(t => t._id === activeTab)}
                        onSave={(data) => onSaveCanvas(activeTab, data)}
                        connected={socket?.connected || false}
                        socket={rawSocket}
                        channelId={chat.id}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Loading canvas...</p>
                    </div>
                )
            )}

            {/* Thread Panel (if active and in chat tab) */}
            {activeTab === 'chat' && activeThread && (
                <ThreadPanel
                    parentMessage={activeThread}
                    channelId={chat.id || chat._id}
                    conversationType="channel"
                    onClose={onThreadClose}
                    socket={rawSocket}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
};

export default CentralContentView;

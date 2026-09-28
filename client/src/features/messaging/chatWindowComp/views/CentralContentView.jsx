import React from 'react';
import { ConversationStream } from '../../events';
import FooterInput from '../footer/footerInput.jsx';
import TypingIndicator from '../TypingIndicator.jsx';
import { AILiveReplies } from '../../../../components/ai/AILiveReply';
import ThreadPanel from '../ThreadPanel.jsx';
import BookmarksPanel from '../panels/BookmarksPanel.jsx';
import TasksTab from '../tabs/TasksTab.jsx';
import ThreadsTab from '../tabs/ThreadsTab.jsx';
import CanvasTab from '../tabs/CanvasTab.jsx';
import ChannelJoinPrompt from '../states/ChannelJoinPrompt.jsx';
import CanvasDashboardView from './CanvasDashboardView.jsx';

const CentralContentView = ({
    typingUsers = [],
    aiLiveReplies = [],
    // Pinned messages / reminders, shown as a side column like the thread panel.
    sidePanel = null,
    aiFollowUp = null,
    
    activeTab,
    tabs,

    
    isMember,
    isDiscoverablePublicChannel,
    isJoining,
    canInteract,

    
    chat,
    conversation,
    enhancedActions,
    conversationType,
    channelMembers,
    userJoinedAt,
    currentUserId,

    
    threadCounts,
    replyingTo,
    onCancelReply,
    activeThread,
    onThreadOpen,
    onThreadClose,

    
    newMessage,
    onMessageChange,
    onSend,
    onAttach,
    onSendAttachment,
    onSlashCommand,
    onCreatePoll,          
    onCreateChecklist,
    features,
    
    linkPreview,
    linkPreviewLoading,
    onDismissPreview,
    conversationId,
    showAttach,
    setShowAttach,
    showEmoji,
    setShowEmoji,
    onPickEmoji,
    recording,
    setRecording,
    blocked,
    blockedNotice = null,
    setNewMessage,

    
    onJoinChannel,
    onIgnore,

    
    rawSocket,
    socket,
    workspaceId,
    showThreadsOnly = false,
    searchQuery = '',

    
    dashboardView,
    dashboardSearch,
    onDashboardViewChange,
    onDashboardSearchChange,
    onAddTab,
    onSaveCanvas,
    onDeleteTab,
    onRenameTab,
    onShareTab,
    onOpenCanvas,

    
    onReply,

    
    showBookmarks = false,
    onCloseBookmarks,

    
    showScreenRecord = false,
    showSmartReply = false,
}) => {
    return (
        <div className="chat-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, backgroundColor: 'var(--bg-primary)' }}>
            {}
            {!isMember && isDiscoverablePublicChannel ? (
                <ChannelJoinPrompt
                    chatName={chat?.name}
                    isJoining={isJoining}
                    onJoinChannel={onJoinChannel}
                    onIgnore={onIgnore}
                />
            ) : activeTab === 'chat' ? (
                <>
                    {}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
                        {}
                        <ConversationStream
                            events={conversation.events}
                            systemEvents={chat.systemEvents || []}
                            creatorName={chat.creatorName}
                            channelCreatedAt={chat.createdAt}
                            channelName={chat.name}
                            channelCreatedById={chat.createdBy?._id || chat.createdBy}
                            loading={conversation.loading}
                            onLoadMore={conversation.loadMore}
                            hasMore={conversation.hasMore}
                            onLoadNewer={conversation.loadNewer}
                            hasMoreNewer={conversation.hasMoreNewer}
                            onJumpToDate={conversation.jumpToDate}
                            actions={enhancedActions}
                            conversationType={conversationType}
                            channelMembers={channelMembers}
                            userJoinedAt={userJoinedAt}
                            onThreadOpen={onThreadOpen}
                            onReply={onReply}
                            threadCounts={threadCounts}
                            replyingTo={replyingTo}
                            onCancelReply={onCancelReply}
                            currentUserId={currentUserId}
                            conversationId={chat?.id}
                            showThreadsOnly={showThreadsOnly}
                            searchQuery={searchQuery}
                            isPrivate={chat?.isPrivate || false}
                        />

                        <TypingIndicator users={typingUsers} />
                        <AILiveReplies replies={aiLiveReplies} />

                        <FooterInput
                            aiFollowUp={aiFollowUp}
                            newMessage={newMessage}
                            onChange={onMessageChange}
                            onSend={onSend}
                            onAttach={onAttach}
                            onSendAttachment={onSendAttachment}
                            onSlashCommand={onSlashCommand}
                            onCreatePoll={onCreatePoll}
                            onCreateChecklist={onCreateChecklist}
                            features={features}
                            conversationId={conversationId}
                            conversationType={conversationType}
                            showAttach={showAttach}
                            setShowAttach={setShowAttach}
                            showEmoji={showEmoji}
                            setShowEmoji={setShowEmoji}
                            onPickEmoji={onPickEmoji}
                            recording={recording}
                            setRecording={setRecording}
                            blocked={blocked}
                            blockedNotice={blockedNotice}
                            setNewMessage={setNewMessage}
                            disabled={!canInteract}
                            replyingTo={replyingTo}
                            onCancelReply={onCancelReply}
                            linkPreview={linkPreview}
                            linkPreviewLoading={linkPreviewLoading}
                            onDismissPreview={onDismissPreview}
                            members={channelMembers || []}
                            showSmartReply={showSmartReply}
                            showScreenRecord={showScreenRecord}
                            workspaceId={workspaceId}
                            recentMessages={
                                // Decrypted tail of the conversation for smart replies (E2EE text
                                // lives in decryptedContent; payload.text is empty on the wire).
                                (conversation.events || []).slice(-8).map(e => ({
                                    id: e.id,
                                    sender: e.sender?.username || (typeof e.sender === 'string' ? e.sender : 'User'),
                                    text: e.decryptedContent || e.text || e.payload?.text || '',
                                    isMe: String(e.sender?._id || e.sender) === String(currentUserId),
                                })).filter(e => e.text)
                            }
                        />

                    </div>
                </>
            ) : activeTab === 'tasks' ? (
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    <TasksTab
                        channelId={chat.id}
                        channelName={chat.name}
                        workspaceId={workspaceId || chat.workspaceId}
                        currentUserId={currentUserId}
                        socket={rawSocket}
                    />
                </div>
            ) : activeTab === 'threads' ? (
                
                <ThreadsTab
                    channelId={chat.id}
                    currentUserId={currentUserId}
                    socket={rawSocket}
                />
            ) : activeTab === 'canvas' ? (
                
                <CanvasDashboardView
                    tabs={tabs}
                    dashboardView={dashboardView}
                    dashboardSearch={dashboardSearch}
                    onViewChange={onDashboardViewChange}
                    onSearchChange={onDashboardSearchChange}
                    onCreate={onAddTab}
                    onOpen={onOpenCanvas}
                    onDelete={onDeleteTab}
                    onRename={onRenameTab}
                    onShare={onShareTab}
                    channelName={chat?.name}
                />
            ) : (
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
                    {tabs.find(t => t._id === activeTab) ? (
                        <CanvasTab
                            tab={tabs.find(t => t._id === activeTab)}
                            onSave={(data) => onSaveCanvas(activeTab, data)}
                            connected={socket?.connected || false}
                            socket={rawSocket}
                            channelId={chat.id}
                            currentUserId={currentUserId}
                            channelMembers={channelMembers}
                        />
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                            <p style={{ color: 'var(--text-muted)' }}>Loading canvas...</p>
                        </div>
                    )}
                </div>
            )}

            {}
            {activeTab === 'chat' && activeThread && (
                <ThreadPanel
                    parentMessage={activeThread}
                    channelId={chat.id || chat._id}
                    conversationType={conversationType === 'dm' ? 'dm' : 'channel'}
                    onClose={onThreadClose}
                    socket={rawSocket}
                    currentUserId={currentUserId}
                    style={{ width: 'clamp(280px, 35vw, 400px)', flexShrink: 0 }}
                />
            )}

            {}
            {activeTab === 'chat' && showBookmarks && (
                <BookmarksPanel
                    open={showBookmarks}
                    onClose={onCloseBookmarks}
                    inline
                />
            )}

            {activeTab === 'chat' && sidePanel}
        </div>
    );
};

export default CentralContentView;

// src/components/messageComp/chatWindow/messages/messagesContainer.jsx

import React, { useEffect, useRef } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { groupByDate } from "../helpers/helpers";
import MessageGroup from "./messageGroup";
import JoinMarker from "./JoinMarker";
import MessageErrorBoundary from "./MessageErrorBoundary";
import { useTranslation } from "../../../../hooks/useTranslation";

export default function MessagesContainer({
  messages,
  searchQuery,

  setOpenMsgMenuId,
  openMsgMenuId,
  toggleMsgMenu,

  selectMode,
  selectedIds,
  toggleSelect,

  formatTime,
  addReaction,
  pinMessage,
  replyToMessage,
  forwardMessage,
  copyMessage,
  deleteMessage,
  infoMessage,

  currentUserId,
  onOpenThread,
  threadCounts,
  chatType,
  userJoinedAt,
  channelMembersWithJoinDates = [],
  isAdmin = false,

  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  conversationId,
}) {
  const messagesRef = useRef(null);
  const { getTranslation, requestTranslation, clearTranslation } = useTranslation();
  const prevMessagesInfoRef = useRef({ length: 0, lastId: null });

  useEffect(() => {
    prevMessagesInfoRef.current = { length: 0, lastId: null };
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const currentLen = messages.length;
    const currentLastId = currentLen > 0 ? messages[currentLen - 1].id : null;
    const prevInfo = prevMessagesInfoRef.current;

    const isNewMessageAtEnd = currentLen > prevInfo.length && currentLastId !== prevInfo.lastId;
    const isInitialLoad = prevInfo.length === 0 && currentLen > 0;

    if (isInitialLoad || isNewMessageAtEnd) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = messagesRef.current;
          if (!container) return;
          container.scrollTop = container.scrollHeight;
        });
      });
    }

    prevMessagesInfoRef.current = { length: currentLen, lastId: currentLastId };
  }, [messages]);

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const grouped = groupByDate(filteredMessages);

  return (
    <div
      ref={messagesRef}
      className="flex-1 overflow-y-auto p-4 chat-scroll-smooth"
      style={{ overflowX: "hidden" }}
    >
      {/* Load More */}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', fontSize: '13px', fontWeight: 400,
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-active)',
              border: '1px solid var(--border-default)',
              borderRadius: '2px', cursor: isLoadingMore ? 'not-allowed' : 'pointer',
              opacity: isLoadingMore ? 0.6 : 1,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={e => { if (!isLoadingMore) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Loading older messages...
              </>
            ) : (
              <>
                <ChevronUp size={14} />
                Load more messages
              </>
            )}
          </button>
        </div>
      )}

      {grouped.map((grp) => (
        <div key={grp.label} style={{ marginBottom: '16px' }}>
          {/* Date Header */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)',
              padding: '3px 12px',
              backgroundColor: 'var(--bg-active)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '2px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              letterSpacing: '0.02em',
            }}>
              {grp.label}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3">
            {grp.items.map((msg) => {
              let memberWhoJoined = null;

              if (chatType === 'channel' && channelMembersWithJoinDates.length > 0 && messages.length > 0) {
                const currentMsgSenderId = msg.senderId;
                const isFirstMessageFromSender = messages.findIndex(m =>
                  String(m.senderId) === String(currentMsgSenderId)
                ) === messages.findIndex(m => m.id === msg.id);

                if (isFirstMessageFromSender) {
                  memberWhoJoined = channelMembersWithJoinDates.find(member =>
                    String(member.userId) === String(currentMsgSenderId)
                  );
                }
              }

              return (
                <React.Fragment key={msg.id}>
                  {memberWhoJoined && (
                    <JoinMarker
                      date={memberWhoJoined.joinedAt}
                      memberInfo={memberWhoJoined}
                      currentUserId={currentUserId}
                    />
                  )}
                  <MessageErrorBoundary>
                    <MessageGroup
                      msg={msg}

                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      toggleSelect={toggleSelect}

                      openMsgMenuId={openMsgMenuId}
                      toggleMsgMenu={toggleMsgMenu}
                      setOpenMsgMenuId={setOpenMsgMenuId}

                      formatTime={formatTime}
                      addReaction={addReaction}
                      pinMessage={pinMessage}
                      replyToMessage={replyToMessage}
                      forwardMessage={forwardMessage}
                      copyMessage={copyMessage}
                      deleteMessage={deleteMessage}
                      infoMessage={infoMessage}

                      currentUserId={currentUserId}
                      onOpenThread={onOpenThread}
                      threadCounts={threadCounts}
                      chatType={chatType}
                      channelMembers={channelMembersWithJoinDates}
                      isAdmin={isAdmin}
                      translationState={getTranslation(msg._id || msg.id)}
                      onTranslate={requestTranslation}
                      onClearTranslation={clearTranslation}
                    />
                  </MessageErrorBoundary>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

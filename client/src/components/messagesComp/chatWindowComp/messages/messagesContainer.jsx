// src/components/messageComp/chatWindow/messages/messagesContainer.jsx

import React, { useEffect, useRef } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { groupByDate } from "../helpers/helpers";
import MessageGroup from "./messageGroup";
import JoinMarker from "./JoinMarker";
import MessageErrorBoundary from "./MessageErrorBoundary";

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

  currentUserId, // ★ ADD THIS FOR READ RECEIPTS
  onOpenThread, // ★ THREAD PANEL
  threadCounts, // ★ THREAD COUNTS
  chatType,
  userJoinedAt, // For channel join timeline marker
  channelMembersWithJoinDates = [], // All members with join dates
  isAdmin = false, // NEW: admin check for pin permissions

  // Pagination props
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}) {
  const messagesRef = useRef(null);
  const shownJoinMarkersRef = useRef(new Set()); // Track which members already had join marker shown

  /* ---------------------------------------------------------
     AUTO SCROLL TO BOTTOM ON NEW MESSAGES (even optimistic)
  --------------------------------------------------------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---------------------------------------------------------
     RESET JOIN MARKERS TRACKING ON CHAT CHANGE ONLY
  --------------------------------------------------------- */
  const firstMessageIdRef = useRef(null);

  useEffect(() => {
    // Only reset when we switch to a different chat (first message ID changes)
    // Don't reset on minor updates like typing or new messages
    const currentFirstMsgId = messages.length > 0 ? messages[0]?.backend?._id || messages[0]?.id : null;

    if (currentFirstMsgId && currentFirstMsgId !== firstMessageIdRef.current) {
      // Chat has changed, reset join markers tracking
      console.log('🔄 Chat changed, resetting join markers');
      shownJoinMarkersRef.current = new Set();
      firstMessageIdRef.current = currentFirstMsgId;
    }
  }, [messages]);

  /* ---------------------------------------------------------
     FILTER & GROUP BY DATE
  --------------------------------------------------------- */
  const filteredMessages = messages.filter((m) => {
    // Only filter if searchQuery has actual content (not empty/whitespace)
    if (!searchQuery || !searchQuery.trim()) {
      return true; // Show all messages when no search
    }
    // Filter by search query when it exists
    return m.text?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const grouped = groupByDate(filteredMessages);

  return (
    <div
      ref={messagesRef}
      className="flex-1 overflow-y-auto p-4 chat-scroll-smooth"
      style={{ overflowX: "hidden" }}
    >
      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading older messages...
              </>
            ) : (
              <>
                <ChevronUp size={16} />
                Load more messages
              </>
            )}
          </button>
        </div>
      )}

      {grouped.map((grp) => (
        <div key={grp.label} className="mb-4">
          {/* --- Date Header --- */}
          <div className="flex justify-center mb-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
              {grp.label}
            </div>
          </div>

          {/* --- Messages in Group --- */}
          <div className="space-y-3">
            {grp.items
              .map((msg, idx) => {
                const prevMsg = grp.items[idx - 1];

                // Determine if we should show a join marker before this message
                // Find members who joined between the previous message and current message
                let memberWhoJoined = null;

                if (chatType === 'channel' && channelMembersWithJoinDates.length > 0) {
                  const currentMsgTime = new Date(msg.ts);
                  const prevMsgTime = prevMsg ? new Date(prevMsg.ts) : new Date(0);

                  // Find a member whose join date is between prevMsg and currentMsg
                  // AND who hasn't been shown yet
                  memberWhoJoined = channelMembersWithJoinDates.find(member => {
                    const joinTime = new Date(member.joinedAt);
                    const memberKey = String(member.userId); // Use userId as unique key

                    // Check if:
                    // 1. Join time is between previous and current message
                    // 2. We haven't shown this member's join marker yet
                    return (
                      joinTime > prevMsgTime &&
                      joinTime <= currentMsgTime &&
                      !shownJoinMarkersRef.current.has(memberKey)
                    );
                  });

                  // If we found a member to show, mark them as shown
                  if (memberWhoJoined) {
                    const memberKey = String(memberWhoJoined.userId);
                    shownJoinMarkersRef.current.add(memberKey);
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

                        currentUserId={currentUserId} // ★ PASS DOWN FOR READ RECEIPTS
                        onOpenThread={onOpenThread} // ★ THREAD PANEL
                        threadCounts={threadCounts} // ★ THREAD COUNTS
                        chatType={chatType}
                        isAdmin={isAdmin} // ★ PASS DOWN FOR PIN PERMISSIONS
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

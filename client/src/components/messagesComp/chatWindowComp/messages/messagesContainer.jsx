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

  /* ---------------------------------------------------------
     AUTO SCROLL TO BOTTOM ON NEW MESSAGES (even optimistic)
  --------------------------------------------------------- */
  const prevMessagesInfoRef = useRef({ length: 0, lastId: null });

  /* ---------------------------------------------------------
     AUTO SCROLL TO BOTTOM ON NEW MESSAGES
     Only scroll if:
     1. Initial load
     2. New message added to the bottom
     Avoid scrolling on updates (reactions, pins) or history load
  --------------------------------------------------------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;

    const currentLen = messages.length;
    const currentLastId = currentLen > 0 ? messages[currentLen - 1].id : null;
    const prevInfo = prevMessagesInfoRef.current;

    // Check if new message added at the end (length increased AND last ID changed)
    const isNewMessageAtEnd =
      currentLen > prevInfo.length &&
      currentLastId !== prevInfo.lastId;

    // Check if initial load (from 0 to N)
    const isInitialLoad = prevInfo.length === 0 && currentLen > 0;

    if (isNewMessageAtEnd || isInitialLoad) {
      el.scrollTop = el.scrollHeight;
    }

    prevMessagesInfoRef.current = {
      length: currentLen,
      lastId: currentLastId
    };
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

                // Determine if we should show a join marker before this message
                // Show marker at the position of a member's FIRST message
                let memberWhoJoined = null;

                if (chatType === 'channel' && channelMembersWithJoinDates.length > 0 && messages.length > 0) {
                  const currentMsgSenderId = msg.senderId;

                  // Check if this is the first message from this sender in the entire chat
                  const isFirstMessageFromSender = messages.findIndex(m =>
                    String(m.senderId) === String(currentMsgSenderId)
                  ) === messages.findIndex(m => m.id === msg.id);

                  if (isFirstMessageFromSender) {
                    // Find the member info for this sender
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

                        currentUserId={currentUserId} // ★ PASS DOWN FOR READ RECEIPTS
                        onOpenThread={onOpenThread} // ★ THREAD PANEL
                        threadCounts={threadCounts} // ★ THREAD COUNTS
                        chatType={chatType}
                        channelMembers={channelMembersWithJoinDates} // ★ PASS MEMBERS FOR REACTIONS
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

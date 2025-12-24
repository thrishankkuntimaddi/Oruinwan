// src/components/messageComp/chatWindow/messages/messagesContainer.jsx

import React, { useEffect, useRef } from "react";
import { groupByDate } from "../helpers/helpers";
import MessageGroup from "./messageGroup";
import JoinMarker from "./JoinMarker";

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
}) {
  const messagesRef = useRef(null);

  /* ---------------------------------------------------------
     AUTO SCROLL TO BOTTOM ON NEW MESSAGES (even optimistic)
  --------------------------------------------------------- */
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---------------------------------------------------------
     FILTER & GROUP BY DATE
  --------------------------------------------------------- */
  const filteredMessages = messages.filter((m) =>
    searchQuery
      ? m.text?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const grouped = groupByDate(filteredMessages);

  return (
    <div
      ref={messagesRef}
      className="flex-1 overflow-y-auto p-4 chat-scroll-smooth"
      style={{ overflowX: "hidden" }}
    >
      {grouped.map((grp) => (
        <div key={grp.label} className="mb-4">
          {/* --- Date Header --- */}
          <div className="flex justify-center mb-3">
            <div className="text-xs text-gray-500 px-3 py-1 bg-gray-100 rounded-full">
              {grp.label}
            </div>
          </div>

          {/* --- Messages in Group --- */}
          <div className="space-y-3">
            {grp.items
              .map((msg, idx) => {
                const prevMsg = grp.items[idx - 1];
                const shouldShowJoinMarker =
                  userJoinedAt &&
                  chatType === 'channel' &&
                  !prevMsg && // First message in group
                  new Date(msg.ts) > new Date(userJoinedAt);

                return (
                  <React.Fragment key={msg.id}>
                    {shouldShowJoinMarker && <JoinMarker date={userJoinedAt} />}
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
                    />
                  </React.Fragment>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

import React from "react";
import MessageItem from "./messageItem";

export default function MessageGroup({
  msg,
  selectMode,
  selectedIds,
  toggleSelect,
  openMsgMenuId,
  toggleMsgMenu,
  setOpenMsgMenuId,
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
  channelMembers,
  isAdmin = false, 
  
  translationState,
  onTranslate,
  onClearTranslation,
}) {
  
  return (
    <MessageItem
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
      channelMembers={channelMembers}
      isAdmin={isAdmin} 
      translationState={translationState}
      onTranslate={onTranslate}
      onClearTranslation={onClearTranslation}
    />
  );
}

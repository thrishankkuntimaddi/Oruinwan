import React from "react";
import ChannelMessageItem from "./ChannelMessageItem";
import DMMessageItem from "./DMMessageItem";
import PollMessage from "./types/PollMessage";

export default function MessageItem(props) {
  const { chatType, msg, currentUserId } = props;

  // Check if this is a poll message — use the new types/PollMessage component
  if (msg.type === 'poll' || msg.poll) {
    return <PollMessage msg={msg} currentUserId={currentUserId} />;
  }

  if (chatType === "channel") {
    return <ChannelMessageItem {...props} />;
  }

  // Default to DM style
  return <DMMessageItem {...props} />;
}

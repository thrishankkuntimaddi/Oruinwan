import React from "react";
import ChannelMessageItem from "./ChannelMessageItem";
import DMMessageItem from "./DMMessageItem";
import PollMessage from "./types/PollMessage";

export default function MessageItem(props) {
  const { chatType, msg, currentUserId } = props;

  
  if (msg.type === 'poll' || msg.poll) {
    return <PollMessage msg={msg} currentUserId={currentUserId} />;
  }

  if (chatType === "channel") {
    
    return <ChannelMessageItem {...props} />;
  }

  
  return <DMMessageItem {...props} />;
}

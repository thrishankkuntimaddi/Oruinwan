import React from "react";
import ChannelMessageItem from "./ChannelMessageItem";
import DMMessageItem from "./DMMessageItem";
import PollMessage from "./PollMessage";

export default function MessageItem(props) {
  const { chatType, msg } = props;

  // Check if this is a poll message
  if (msg.type === 'poll' || msg.poll) {
    return <PollMessage poll={msg.poll || msg} {...props} />;
  }

  if (chatType === "channel") {
    return <ChannelMessageItem {...props} />;
  }

  // Default to DM style
  return <DMMessageItem {...props} />;
}

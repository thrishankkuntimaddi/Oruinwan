import React from "react";
import ChannelMessageItem from "./ChannelMessageItem";
import DMMessageItem from "./DMMessageItem";

export default function MessageItem(props) {
  const { chatType } = props;

  if (chatType === "channel") {
    return <ChannelMessageItem {...props} />;
  }

  // Default to DM style
  return <DMMessageItem {...props} />;
}

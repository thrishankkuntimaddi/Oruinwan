import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { fetchWorkspaceChannels, fetchChannelMessages } from '../services/api';
import {
  connectSocket, joinChannel, leaveChannel,
  socketSendMessage, markRead, sendTyping, addReaction,
} from '../services/socket';
import { cacheGet, cacheSet } from '../services/storage';
import { useApp } from '../context/AppContext';

const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function ChannelsScreen() {
  const { workspace, user } = useApp();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [typingUser, setTypingUser] = useState(null);

  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  const activeChannelRef = useRef(null);
  const typingTimerRef = useRef(null);

  
  useEffect(() => {
    if (!workspace?._id) return;
    setChannels([]);
    setLoadingChannels(true);
    loadChannels();
  }, [workspace?._id]);

  
  useEffect(() => {
    if (!activeChannel) return;
    activeChannelRef.current = activeChannel;
    setMessages([]);
    loadChannelMessages(activeChannel._id);
    setupChannelSocket(activeChannel._id);
    return () => teardownChannelSocket(activeChannel._id);
  }, [activeChannel?._id]);

  
  async function loadChannels() {
    try {
      const cacheKey = `channels_${workspace._id}`;
      const cached = await cacheGet(cacheKey);
      if (cached) setChannels(cached);
      const { data } = await fetchWorkspaceChannels(workspace._id);
      const list = data.channels || data || [];
      setChannels(list);
      await cacheSet(cacheKey, list);
    } catch (err) {
      console.warn('[ChannelsScreen] loadChannels:', err.message);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function loadChannelMessages(channelId) {
    try {
      const cacheKey = `ch_msgs_${channelId}`;
      const cached = await cacheGet(cacheKey);
      if (cached) setMessages(cached);
      const { data } = await fetchChannelMessages(channelId);
      const msgs = data.messages || data || [];
      setMessages(msgs);
      await cacheSet(cacheKey, msgs);
    } catch (err) {
      console.warn('[ChannelsScreen] loadMessages:', err.message);
    }
  }

  async function setupChannelSocket(channelId) {
    try {
      const s = await connectSocket();
      socketRef.current = s;

      
      joinChannel(channelId, (ack) => {
        if (ack?.error) {
          console.warn('[ChannelsScreen] chat:join rejected:', ack.error);
        }
      });

      
      markRead('channel', channelId);

      s.on('new-message', handleNewMessage);
      s.on('message-sent', handleMessageSent);
      s.on('message-deleted', handleMessageDeleted);
      s.on('typing', handleTyping);
      s.on('reaction-added', handleReactionAdded);
      s.on('reaction-removed', handleReactionRemoved);
    } catch (err) {
      console.warn('[ChannelsScreen] socket setup:', err.message);
    }
  }

  function teardownChannelSocket(channelId) {
    const s = socketRef.current;
    if (s) {
      s.off('new-message', handleNewMessage);
      s.off('message-sent', handleMessageSent);
      s.off('message-deleted', handleMessageDeleted);
      s.off('typing', handleTyping);
      s.off('reaction-added', handleReactionAdded);
      s.off('reaction-removed', handleReactionRemoved);
      leaveChannel(channelId);
    }
  }

  

  
  const handleNewMessage = useCallback(({ message }) => {
    if (!message) return;
    const chId = message.channel?._id || message.channel;
    if (chId && chId !== activeChannelRef.current?._id) return;
    setMessages((prev) => {
      
      if (prev.some((m) => m._id === message._id && !m._tempId)) return prev;
      
      return [...prev.filter((m) => m._id !== message._id), message];
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  
  const handleMessageSent = useCallback(({ message, clientTempId }) => {
    if (!message) return;
    setMessages((prev) => {
      const alreadyReal = prev.some((m) => m._id === message._id && !m._tempId);
      if (alreadyReal) {
        
        return prev.filter((m) => m._tempId !== clientTempId);
      }
      return prev.map((m) => (m._tempId === clientTempId ? message : m));
    });
  }, []);

  const handleMessageDeleted = useCallback(({ messageId, isLocal, isUniversal, deletedByName }) => {
    if (isLocal) {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } else if (isUniversal) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDeletedUniversally: true, deletedByName, text: `Deleted by ${deletedByName}` }
            : m
        )
      );
    }
  }, []);

  const handleTyping = useCallback(({ from, fromName }) => {
    if (from === user?._id) return;
    setTypingUser(fromName || 'Someone');
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTypingUser(null), 3000);
  }, [user?._id]);

  const handleReactionAdded = useCallback(({ messageId, reactions }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
    );
  }, []);

  const handleReactionRemoved = useCallback(({ messageId, reactions }) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
    );
  }, []);

  
  function handleSend() {
    if (!text.trim() || !activeChannel || !workspace?._id) return;
    const draft = text.trim();
    const clientTempId = tempId();
    setText('');

    
    const optimistic = {
      _id: clientTempId,
      _tempId: clientTempId,
      text: draft,
      sender: { _id: user?._id, username: user?.username },
      channel: activeChannel._id,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    socketSendMessage({
      channelId: activeChannel._id,
      workspaceId: workspace._id,
      text: draft,
      clientTempId,
    });
  }

  function handleTypingInput(val) {
    setText(val);
    if (val && activeChannel) {
      sendTyping({ channelId: activeChannel._id });
    }
  }

  function handleBackToList() {
    setActiveChannel(null);
    setMessages([]);
    setText('');
    setTypingUser(null);
  }

  
  if (!workspace) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyIcon}>🏢</Text>
        <Text style={styles.emptyTitle}>No workspace selected</Text>
        <Text style={styles.emptyBody}>Go to Home to select a workspace.</Text>
      </View>
    );
  }

  
  if (!activeChannel) {
    return (
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <Text style={styles.heading}>Channels</Text>
          <View style={styles.wsBadge}>
            <Text style={styles.wsBadgeText}>{workspace.name}</Text>
          </View>
        </View>

        {loadingChannels ? (
          <ActivityIndicator color="#6366f1" size="large" style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={channels}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.channelItem}
                onPress={() => setActiveChannel(item)}
              >
                <View style={[
                  styles.channelIconWrap,
                  item.type === 'private' && styles.channelIconWrapPrivate,
                ]}>
                  <Text style={styles.channelIconHash}>#</Text>
                </View>
                <View style={styles.channelInfo}>
                  <View style={styles.channelNameRow}>
                    <Text style={styles.channelName}>{item.name}</Text>
                    {item.type === 'private' && <Text style={styles.lockBadge}>🔒</Text>}
                  </View>
                  {!!item.description && (
                    <Text style={styles.channelDesc} numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📢</Text>
                <Text style={styles.emptyTitle}>No channels yet</Text>
                <Text style={styles.emptyBody}>
                  Create channels from the web app to get started.
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {}
      <TouchableOpacity onPress={handleBackToList} style={styles.backBar}>
        <Text style={styles.backText}>←</Text>
        <Text style={styles.chatHeader}>#{activeChannel.name}</Text>
        {activeChannel.type === 'private' && (
          <Text style={styles.chatHeaderLock}> 🔒</Text>
        )}
      </TouchableOpacity>

      {}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id?.toString() || String(Math.random())}
        renderItem={({ item }) => {
          if (item.isDeletedUniversally) {
            return (
              <View style={styles.msgRowDeleted}>
                <Text style={styles.msgDeletedText}>🗑 {item.text}</Text>
              </View>
            );
          }
          const senderId = item.sender?._id || item.sender;
          const isOwn = senderId === user?._id;
          const senderName = item.sender?.username || 'User';
          const timeStr = item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          const reactions = item.reactions || [];

          return (
            <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
              {!isOwn && (
                <View style={styles.msgAvatar}>
                  <Text style={styles.msgAvatarText}>{senderName[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.msgCol}>
                <View style={[styles.msgBubble, isOwn && styles.msgBubbleOwn, item.pending && styles.msgBubblePending]}>
                  {!isOwn && <Text style={styles.msgSender}>{senderName}</Text>}
                  <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>
                    {item.text || item.content || ''}
                  </Text>
                  {!!timeStr && (
                    <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{timeStr}</Text>
                  )}
                </View>
                {reactions.length > 0 && (
                  <View style={[styles.reactionsRow, isOwn && styles.reactionsRowOwn]}>
                    {reactions.slice(0, 5).map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.reactionChip}
                        onPress={() => addReaction(item._id, r.emoji)}
                      >
                        <Text style={styles.reactionText}>{r.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyBody}>Be the first to post in #{activeChannel.name}</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {}
      {!!typingUser && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingUser} is typing…</Text>
        </View>
      )}

      {}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder={`Message #${activeChannel.name}`}
          placeholderTextColor="#94a3b8"
          value={text}
          onChangeText={handleTypingInput}
          multiline
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  heading: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  wsBadge: {
    backgroundColor: '#1e293b', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#334155',
  },
  wsBadgeText: { color: '#6366f1', fontSize: 11, fontWeight: '700' },
  channelItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  channelIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#1e293b', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: '#334155',
  },
  channelIconWrapPrivate: { borderColor: '#7c3aed' },
  channelIconHash: { color: '#6366f1', fontSize: 18, fontWeight: '800' },
  channelInfo: { flex: 1 },
  channelNameRow: { flexDirection: 'row', alignItems: 'center' },
  channelName: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
  lockBadge: { fontSize: 12, marginLeft: 6 },
  channelDesc: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  arrow: { color: '#475569', fontSize: 22 },
  backBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backText: { color: '#6366f1', fontSize: 18, marginRight: 10 },
  chatHeader: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  chatHeaderLock: { color: '#94a3b8', fontSize: 14 },
  msgRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowDeleted: { paddingHorizontal: 20, paddingVertical: 6 },
  msgDeletedText: { color: '#475569', fontSize: 13, fontStyle: 'italic' },
  msgAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#334155', alignItems: 'center',
    justifyContent: 'center', marginRight: 8, alignSelf: 'flex-end',
  },
  msgAvatarText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  msgCol: { maxWidth: '75%' },
  msgBubble: {
    backgroundColor: '#1e293b', borderRadius: 16,
    borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10,
  },
  msgBubbleOwn: {
    backgroundColor: '#4f46e5',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 4,
  },
  msgBubblePending: { opacity: 0.6 },
  msgSender: { color: '#6366f1', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { color: '#e2e8f0', fontSize: 15, lineHeight: 21 },
  msgTextOwn: { color: '#fff' },
  msgTime: { color: '#64748b', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeOwn: { color: '#a5b4fc' },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  reactionsRowOwn: { justifyContent: 'flex-end' },
  reactionChip: {
    backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1,
    borderColor: '#334155', paddingHorizontal: 8, paddingVertical: 3, marginRight: 4, marginTop: 2,
  },
  reactionText: { fontSize: 14 },
  typingBar: { paddingHorizontal: 16, paddingVertical: 4 },
  typingText: { color: '#6366f1', fontSize: 12, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row', padding: 10,
    borderTopWidth: 1, borderTopColor: '#1e293b', alignItems: 'flex-end',
  },
  textInput: {
    flex: 1, backgroundColor: '#1e293b', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#f1f5f9', fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    marginLeft: 8, backgroundColor: '#6366f1',
    borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendIcon: { color: '#fff', fontSize: 16 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { fetchDMSessions, fetchDMMessages } from '../services/api';
import {
  connectSocket, joinDM, leaveDM,
  socketSendMessage, markRead, sendTyping,
} from '../services/socket';
import { cacheGet, cacheSet } from '../services/storage';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useApp } from '../context/AppContext';

const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function MessagesScreen() {
  const { workspace, user } = useApp();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState(null);

  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  const selectedSessionRef = useRef(null);
  const typingTimerRef = useRef(null);
  const loadSessionsRef = useRef(null); 
  const { isOnline } = useOfflineQueue();

  
  useEffect(() => {
    setSessions([]);
    setLoading(true);
    loadSessions();
  }, [workspace?._id]);

  
  useEffect(() => {
    if (!selectedSession) return;
    selectedSessionRef.current = selectedSession;
    setMessages([]);
    setText('');
    loadMessages(selectedSession._id);
    setupSocket(selectedSession._id);
    return () => teardownSocket(selectedSession._id);
  }, [selectedSession?._id]);

  
  async function loadSessions() {
    try {
      const cached = await cacheGet('dm_sessions');
      if (cached) setSessions(cached);
      const { data } = await fetchDMSessions(workspace?._id);
      const list = data.sessions || data || [];
      setSessions(list);
      await cacheSet('dm_sessions', list);
    } catch (err) {
      console.warn('[MessagesScreen] loadSessions:', err.message);
    } finally {
      setLoading(false);
    }
  }
  
  loadSessionsRef.current = loadSessions;

  async function loadMessages(dmSessionId) {
    try {
      const cacheKey = `dm_msgs_${dmSessionId}`;
      const cached = await cacheGet(cacheKey);
      if (cached) setMessages(cached);
      const { data } = await fetchDMMessages(dmSessionId);
      const msgs = data.messages || data || [];
      setMessages(msgs);
      await cacheSet(cacheKey, msgs);
    } catch (err) {
      console.warn('[MessagesScreen] loadMessages:', err.message);
    }
  }

  async function setupSocket(dmSessionId) {
    try {
      const s = await connectSocket();
      socketRef.current = s;
      joinDM(dmSessionId);
      markRead('dm', dmSessionId);

      s.on('new-message', handleNewMessage);
      s.on('message-sent', handleMessageSent);
      s.on('message-deleted', handleMessageDeleted);
      s.on('typing', handleTyping);
      s.on('read-update', handleReadUpdate);
      s.on('new-dm-session', handleNewDMSession);
    } catch (err) {
      console.warn('[MessagesScreen] socket setup:', err.message);
    }
  }

  function teardownSocket(dmSessionId) {
    const s = socketRef.current;
    if (s) {
      s.off('new-message', handleNewMessage);
      s.off('message-sent', handleMessageSent);
      s.off('message-deleted', handleMessageDeleted);
      s.off('typing', handleTyping);
      s.off('read-update', handleReadUpdate);
      s.off('new-dm-session', handleNewDMSession);
      leaveDM(dmSessionId);
    }
  }

  

  
  const handleNewMessage = useCallback(({ message }) => {
    if (!message) return;
    const msgDM = message.dm?._id || message.dm;
    const curSession = selectedSessionRef.current?._id;
    if (msgDM && msgDM !== curSession) return;

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
            ? { ...m, isDeletedUniversally: true, text: `Deleted by ${deletedByName || 'Admin'}` }
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

  const handleReadUpdate = useCallback(({ readerId }) => {
    
  }, []);

  
  const handleNewDMSession = useCallback(() => {
    loadSessionsRef.current?.();
  }, []); 

  
  function handleSend() {
    if (!text.trim() || !selectedSession || !workspace?._id) return;
    const draft = text.trim();
    const clientTempId = tempId();
    setText('');

    const optimistic = {
      _id: clientTempId,
      _tempId: clientTempId,
      text: draft,
      sender: { _id: user?._id, username: user?.username },
      dm: selectedSession._id,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    if (isOnline) {
      socketSendMessage({
        dmSessionId: selectedSession._id,
        workspaceId: workspace._id,
        text: draft,
        clientTempId,
      });
    } else {
      
      console.warn('[MessagesScreen] Offline — message queued');
    }
  }

  function handleTypingInput(val) {
    setText(val);
    if (val && selectedSession) {
      sendTyping({ dmSessionId: selectedSession._id });
    }
  }

  
  if (!selectedSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Direct Messages</Text>

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 Offline</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const other = item.otherUser ||
                item.participants?.find((p) => (p._id || p) !== user?._id) || {};
              const initial = (other.username || '?')[0].toUpperCase();
              return (
                <TouchableOpacity
                  style={styles.sessionItem}
                  onPress={() => setSelectedSession(item)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>
                      {other.username || 'Direct Message'}
                    </Text>
                    <Text style={styles.sessionPreview} numberOfLines={1}>
                      {item.lastMessage?.text || 'No messages yet'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyBody}>
                  Start a direct message from the web app.
                </Text>
              </View>
            }
          />
        )}
      </View>
    );
  }

  
  const other = selectedSession.otherUser || {};
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {}
      <TouchableOpacity onPress={() => setSelectedSession(null)} style={styles.backBar}>
        <Text style={styles.backText}>←</Text>
        <View style={styles.backAvatarSmall}>
          <Text style={styles.backAvatarText}>
            {(other.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.chatHeader}>{other.username || 'Chat'}</Text>
      </TouchableOpacity>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 Offline — messages will sync when reconnected
          </Text>
        </View>
      )}

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
          return (
            <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
              {!isOwn && (
                <View style={styles.msgAvatar}>
                  <Text style={styles.msgAvatarText}>{senderName[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={[
                styles.msgBubble,
                isOwn && styles.msgBubbleOwn,
                item.pending && styles.msgBubblePending,
              ]}>
                {!isOwn && <Text style={styles.msgSender}>{senderName}</Text>}
                <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>
                  {item.text}
                </Text>
                {!!timeStr && (
                  <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{timeStr}</Text>
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Say hi!</Text>
            <Text style={styles.emptyBody}>No messages in this conversation yet.</Text>
          </View>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {!!typingUser && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{typingUser} is typing…</Text>
        </View>
      )}

      {}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message…"
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
  heading: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', padding: 16 },
  offlineBanner: { backgroundColor: '#7c3aed', padding: 8, alignItems: 'center' },
  offlineText: { color: '#e9d5ff', fontSize: 12 },
  backBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  backText: { color: '#6366f1', fontSize: 18, marginRight: 10 },
  backAvatarSmall: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#6366f1', alignItems: 'center',
    justifyContent: 'center', marginRight: 8,
  },
  backAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chatHeader: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  sessionItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b',
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#6366f1', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  sessionInfo: { flex: 1 },
  sessionName: { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
  sessionPreview: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  unreadBadge: {
    backgroundColor: '#6366f1', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  msgBubble: {
    maxWidth: '75%', backgroundColor: '#1e293b',
    borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
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

/**
 * Chttrix Mobile — Messages Screen
 * Displays DM sessions and real-time messages with quick-reply support.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { fetchDMSessions, fetchMessages } from '../services/api';
import { connectSocket, joinDM } from '../services/socket';
import { cacheGet, cacheSet } from '../services/storage';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

export default function MessagesScreen() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);
  const { isOnline, dispatch } = useOfflineQueue();

  // Load DM sessions
  useEffect(() => {
    loadSessions();
  }, []);

  // Load messages when a session is selected
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession._id);
      setupSocket(selectedSession._id);
    }
  }, [selectedSession]);

  async function loadSessions() {
    try {
      const cached = await cacheGet('dm_sessions');
      if (cached) setSessions(cached);
      const { data } = await fetchDMSessions();
      const list = data.sessions || data || [];
      setSessions(list);
      await cacheSet('dm_sessions', list);
    } catch (err) {
      console.warn('[MessagesScreen] Failed to load sessions:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(dmSessionId) {
    try {
      const cachedKey = `messages_${dmSessionId}`;
      const cached = await cacheGet(cachedKey);
      if (cached) setMessages(cached);
      const { data } = await fetchMessages(dmSessionId);
      const msgs = data.messages || data || [];
      setMessages(msgs);
      await cacheSet(cachedKey, msgs);
    } catch (err) {
      console.warn('[MessagesScreen] Failed to load messages:', err.message);
    }
  }

  async function setupSocket(dmSessionId) {
    const s = await connectSocket();
    joinDM(dmSessionId);
    s.on('new-message', ({ message }) => {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }

  async function handleSend() {
    if (!text.trim() || !selectedSession) return;
    const payload = { dmSessionId: selectedSession._id, text: text.trim() };
    setText('');
    await dispatch({ type: 'SEND_MESSAGE', payload });
  }

  // ── Render: Session list ──────────────────────────────────────────────────
  if (!selectedSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Messages</Text>
        {loading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const otherUser = item.otherUser || {};
              return (
                <TouchableOpacity
                  style={styles.sessionItem}
                  onPress={() => setSelectedSession(item)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(otherUser.username || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>{otherUser.username || 'Direct Message'}</Text>
                    <Text style={styles.sessionPreview} numberOfLines={1}>
                      {item.lastMessage?.text || 'No messages yet'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>No conversations yet</Text>
            }
          />
        )}
      </View>
    );
  }

  // ── Render: Chat view ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <TouchableOpacity onPress={() => setSelectedSession(null)} style={styles.backBar}>
        <Text style={styles.backText}>← Back</Text>
        <Text style={styles.heading}>
          {selectedSession.otherUser?.username || 'Chat'}
        </Text>
      </TouchableOpacity>

      {/* Offline badge */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 Offline — messages will be sent when reconnected</Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id?.toString() || Math.random().toString()}
        renderItem={({ item }) => (
          <View style={styles.messageRow}>
            <Text style={styles.messageSender}>{item.sender?.username || 'User'}</Text>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Say hi! 👋</Text>
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message…"
          placeholderTextColor="#94a3b8"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  heading: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', padding: 16 },
  backBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backText: { color: '#6366f1', fontSize: 15, paddingLeft: 16, paddingVertical: 12 },
  sessionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sessionInfo: { flex: 1 },
  sessionName: { color: '#f1f5f9', fontWeight: '600', fontSize: 15 },
  sessionPreview: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
  offlineBanner: { backgroundColor: '#7c3aed', padding: 8, alignItems: 'center' },
  offlineText: { color: '#e9d5ff', fontSize: 12 },
  messageRow: { paddingHorizontal: 16, paddingVertical: 8 },
  messageSender: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  messageText: { color: '#e2e8f0', fontSize: 15 },
  inputRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#1e293b', alignItems: 'flex-end' },
  textInput: { flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#f1f5f9', fontSize: 15, maxHeight: 120 },
  sendBtn: { marginLeft: 8, backgroundColor: '#6366f1', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 16 },
});

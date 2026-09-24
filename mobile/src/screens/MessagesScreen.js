import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchDMSessions } from '../services/api/messages';
import { fetchWorkspaceMembers } from '../services/api/workspaces';
import { cacheGet, cacheSet } from '../services/storage';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import { useSocketEvent } from '../hooks/useSocketEvent';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import { T } from '../theme';

const idOf = (v) => (v == null ? null : String(v._id ?? v.id ?? v));

function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const SessionRow = memo(function SessionRow({ item, onPress }) {
  const name = item.otherUser?.username || 'Unknown';
  const online = item.otherUser?.isOnline;
  return (
    <TouchableOpacity style={s.item} onPress={() => onPress(item)}>
      <View>
        <Avatar name={name} uri={item.otherUser?.profilePicture} size={40} />
        {online ? <View style={s.onlineDot} /> : null}
      </View>
      <View style={s.info}>
        <View style={s.topRow}>
          <Text style={[s.name, item.unreadCount > 0 && s.bold]} numberOfLines={1}>{name}</Text>
          <Text style={s.time}>{timeLabel(item.lastMessageAt)}</Text>
        </View>
        <View style={s.topRow}>
          <Text style={s.preview} numberOfLines={1}>{typeof item.lastMessage === 'string' ? item.lastMessage : ''}</Text>
          {item.unreadCount > 0 ? <View style={s.badge}><Text style={s.badgeText}>{item.unreadCount}</Text></View> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function MessagesScreen({ navigation }) {
  const { workspace, user } = useApp();
  const wsId = workspace?._id;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await fetchDMSessions(wsId);
      const list = (data?.sessions || []).map((x) => ({ ...x, id: String(x.id ?? x._id) }));
      list.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      setSessions(list);
      cacheSet(`dm_sessions_${wsId}`, list).catch(() => {});
    } catch (err) {
      toast(errorMessage(err, 'Could not load conversations'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    let cancelled = false;
    setSessions([]);
    setLoading(true);
    if (wsId) cacheGet(`dm_sessions_${wsId}`).then((c) => { if (!cancelled && c) setSessions(c); });
    return () => { cancelled = true; };
  }, [wsId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useSocketEvent('new-dm-session', () => load());
  useSocketEvent('new-message', (payload) => {
    const m = payload?.message && payload.message._id ? payload.message : payload;
    const dm = idOf(m?.dm);
    if (!dm || m.parentId) return;
    setSessions((prev) => {
      const i = prev.findIndex((x) => x.id === dm);
      if (i < 0) { load(); return prev; }
      const fromMe = idOf(m.sender) === String(user?._id);
      const updated = {
        ...prev[i],
        lastMessage: '🔒 Encrypted message',
        lastMessageAt: m.createdAt || new Date().toISOString(),
        unreadCount: fromMe ? prev[i].unreadCount : (prev[i].unreadCount || 0) + 1,
      };
      return [updated, ...prev.filter((_, j) => j !== i)];
    });
  });

  const openSession = useCallback((item) => {
    setSessions((prev) => prev.map((x) => (x.id === item.id ? { ...x, unreadCount: 0 } : x)));
    navigation.navigate('DMChat', { dmId: item.id, otherUser: item.otherUser, otherUserId: item.otherUserId || idOf(item.otherUser) });
  }, [navigation]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    try {
      const { data } = await fetchWorkspaceMembers(wsId);
      setMembers(data?.members || []);
    } catch (err) {
      toast(errorMessage(err, 'Could not load members'), 'error');
    }
  }, [wsId]);

  const startDM = useCallback((member) => {
    setPickerOpen(false);
    setQuery('');
    const existing = sessions.find((x) => String(x.otherUserId || idOf(x.otherUser)) === String(member._id));
    if (existing) return openSession(existing);
    navigation.navigate('DMChat', { dmId: String(member._id), otherUser: member, otherUserId: String(member._id) });
    return undefined;
  }, [sessions, openSession, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = useCallback(({ item }) => <SessionRow item={item} onPress={openSession} />, [openSession]);

  if (!workspace) {
    return <View style={s.root}><EmptyState icon="🏢" title="No workspace selected" body="Go to Home to select a workspace." /></View>;
  }

  const filtered = query.trim()
    ? members.filter((m) => m.username?.toLowerCase().includes(query.trim().toLowerCase()))
    : members;

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Direct Messages"
        subtitle={workspace.name}
        right={<TouchableOpacity style={s.newBtn} onPress={openPicker}><Text style={s.newText}>＋ New</Text></TouchableOpacity>}
      />
      {loading && !sessions.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="💬" title="No conversations yet" body="Start a direct message with a teammate." actionLabel="New message" onAction={openPicker} />}
        />
      )}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>New message</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}><Text style={s.close}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={s.search} placeholder="Search people" placeholderTextColor={T.textMuted} value={query} onChangeText={setQuery} />
            <FlatList
              data={filtered}
              keyExtractor={(m) => String(m._id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.member} onPress={() => startDM(item)}>
                  <Avatar name={item.username} uri={item.profilePicture} size={32} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={s.name}>{item.username}</Text>
                    <Text style={s.preview}>{item.email}</Text>
                  </View>
                  {item.status === 'online' ? <View style={s.inlineDot} /> : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<ActivityIndicator color={T.accent} style={{ margin: 24 }} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  onlineDot: {
    position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6,
    backgroundColor: T.success, borderWidth: 2, borderColor: T.bgBase,
  },
  info: { flex: 1, marginLeft: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: T.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  bold: { fontWeight: '800' },
  time: { color: T.textMuted, fontSize: 11, marginLeft: 8 },
  preview: { color: T.textSecondary, fontSize: 12, marginTop: 3, flex: 1 },
  badge: { backgroundColor: T.accent, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: 'center', marginLeft: 8 },
  badgeText: { color: T.bgBase, fontSize: 11, fontWeight: '800' },
  newBtn: { borderWidth: 1, borderColor: T.accent, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  newText: { color: T.accent, fontSize: 12, fontWeight: '700' },
  sheetWrap: { flex: 1, backgroundColor: T.overlay, justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', minHeight: '50%', backgroundColor: T.bgSurface, borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sheetTitle: { color: T.textPrimary, fontSize: 16, fontWeight: '700' },
  close: { color: T.textSecondary, fontSize: 16 },
  search: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 12,
    paddingVertical: 9, color: T.textPrimary, borderWidth: 1, borderColor: T.borderDefault,
  },
  member: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  inlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.success },
});

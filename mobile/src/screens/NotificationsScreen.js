import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
} from '../services/api/notifications';
import { errorMessage } from '../services/http';
import { emit, toast } from '../services/events';
import { useSocketEvent } from '../hooks/useSocketEvent';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

const TYPE_ICON = {
  mention: '@', dm: '💬', task_assigned: '📋', task_comment: '📝', task_due_soon: '⏰',
  member_joined: '👋', channel_pinned: '📌', huddle_started: '🎧', schedule_created: '📅',
  meeting_reminder: '📅', reaction: '😊', thread_reply: '↩️', integration_alert: '🔌',
  ai_suggestion: '✨', digest: '📰',
};

function ago(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const Row = memo(function Row({ item, onPress }) {
  return (
    <TouchableOpacity style={[s.item, !item.read && s.unread]} onPress={() => onPress(item)}>
      <View style={s.icon}><Text style={s.iconText}>{TYPE_ICON[item.type] || '🔔'}</Text></View>
      <View style={s.body}>
        <Text style={[s.title, !item.read && s.bold]} numberOfLines={1}>{item.title || 'Notification'}</Text>
        {item.body ? <Text style={s.text} numberOfLines={2}>{item.body}</Text> : null}
      </View>
      <Text style={s.time}>{item.createdAt ? ago(item.createdAt) : ''}</Text>
    </TouchableOpacity>
  );
});

export default function NotificationsScreen({ navigation }) {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const moreInFlight = useRef(false);

  const load = useCallback(async (p = 1) => {
    if (!wsId) return;
    try {
      const { data } = await fetchNotifications(wsId, { page: p, limit: 30, unreadOnly });
      const list = data?.notifications || [];
      setItems((prev) => {
        if (p === 1) return list;
        const seen = new Set(prev.map((n) => n._id));
        return [...prev, ...list.filter((n) => !seen.has(n._id))];
      });
      setPage(data?.page || p);
      setPages(data?.pages || 1);
      emit('notifications:count', data?.unreadCount);
    } catch (err) {
      toast(errorMessage(err, 'Could not load notifications'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId, unreadOnly]);

  useEffect(() => { setLoading(true); setItems([]); }, [wsId, unreadOnly]);
  useFocusEffect(useCallback(() => { load(1); }, [load]));

  useSocketEvent('notification:new', ({ notification } = {}) => {
    if (!notification || (notification.workspaceId && String(notification.workspaceId) !== String(wsId))) return;
    setItems((prev) => (prev.some((n) => n._id === notification._id) ? prev : [notification, ...prev]));
  });

  // Foreground push → refresh the list (subscription.remove() is the 0.32 API).
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => load(1));
    return () => sub.remove();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (moreInFlight.current || page >= pages) return;
    moreInFlight.current = true;
    await load(page + 1);
    moreInFlight.current = false;
  }, [page, pages, load]);

  const open = useCallback(async (item) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
      markNotificationRead(item._id).then(() => emit('notifications:changed')).catch(() => {});
    }
    const link = item.link || '';
    const ch = link.match(/\/channels?\/([a-f0-9]{24})/i);
    if (ch) navigation.navigate('ChannelChat', { channel: { _id: ch[1], name: item.meta?.channelName || 'channel' } });
    else if (item.type === 'dm' || /\/dm|\/messages/.test(link)) navigation.navigate('DMs');
    else if (/^task/.test(item.type || '') || /\/tasks/.test(link)) navigation.navigate('Tasks');
  }, [navigation]);

  const markAll = useCallback(async () => {
    try {
      await markAllNotificationsRead(wsId);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      emit('notifications:changed');
    } catch (err) {
      toast(errorMessage(err, 'Could not mark as read'), 'error');
    }
  }, [wsId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  }, [load]);

  const renderItem = useCallback(({ item }) => <Row item={item} onPress={open} />, [open]);

  if (!workspace) {
    return <View style={s.root}><EmptyState icon="🏢" title="No workspace selected" body="Go to Home to select a workspace." /></View>;
  }

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Notifications"
        subtitle={workspace.name}
        right={<TouchableOpacity onPress={markAll}><Text style={s.action}>Mark all read</Text></TouchableOpacity>}
      />
      <View style={s.tabs}>
        {[[false, 'All'], [true, 'Unread']].map(([k, label]) => (
          <TouchableOpacity key={label} style={[s.tab, unreadOnly === k && s.tabOn]} onPress={() => setUnreadOnly(k)}>
            <Text style={[s.tabText, unreadOnly === k && s.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading && !items.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n._id)}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="🔔" title="You're all caught up" body="Mentions, DMs and task updates will appear here." />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: T.borderDefault },
  tabOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  tabText: { color: T.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextOn: { color: T.accent },
  action: { color: T.accent, fontSize: 12, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  unread: { backgroundColor: T.bgSurface, borderLeftWidth: 2, borderLeftColor: T.accent },
  icon: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: T.bgActive, alignItems: 'center',
    justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: T.borderDefault,
  },
  iconText: { fontSize: 14, color: T.accent, fontWeight: '800' },
  body: { flex: 1 },
  title: { color: T.textPrimary, fontSize: 14 },
  bold: { fontWeight: '700' },
  text: { color: T.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 17 },
  time: { color: T.textMuted, fontSize: 11, marginLeft: 8 },
});

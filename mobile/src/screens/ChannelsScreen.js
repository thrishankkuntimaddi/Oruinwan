import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchWorkspaceChannels, joinChannelApi } from '../services/api/workspaces';
import { cacheGet, cacheSet } from '../services/storage';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

const ChannelRow = memo(function ChannelRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.item} onPress={() => onPress(item)}>
      <View style={[s.icon, item.isPrivate && s.iconPrivate]}>
        <Text style={s.hash}>#</Text>
      </View>
      <View style={s.info}>
        <View style={s.nameRow}>
          <Text style={[s.name, !item.isMember && s.nameMuted]}>{item.name}</Text>
          {item.isPrivate ? <Text style={s.lock}>🔒</Text> : null}
          {item.isDefault ? <Text style={s.badge}>default</Text> : null}
        </View>
        {item.description ? <Text style={s.desc} numberOfLines={1}>{item.description}</Text> : null}
      </View>
      {item.isMember ? <Text style={s.arrow}>›</Text> : <Text style={s.join}>Join</Text>}
    </TouchableOpacity>
  );
});

export default function ChannelsScreen({ navigation }) {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await fetchWorkspaceChannels(wsId);
      const list = data?.channels || [];
      setChannels(list);
      cacheSet(`channels_${wsId}`, list).catch(() => {});
    } catch (err) {
      toast(errorMessage(err, 'Could not load channels'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useEffect(() => {
    let cancelled = false;
    setChannels([]);
    setLoading(true);
    if (wsId) cacheGet(`channels_${wsId}`).then((c) => { if (!cancelled && c) setChannels(c); });
    load();
    return () => { cancelled = true; };
  }, [wsId, load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = useCallback((item) => {
    if (item.isMember) {
      navigation.navigate('ChannelChat', { channel: item });
      return;
    }
    Alert.alert(`Join #${item.name}?`, item.description || 'You are not a member of this channel yet.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Join',
        onPress: async () => {
          try {
            await joinChannelApi(item._id);
            setChannels((prev) => prev.map((c) => (c._id === item._id ? { ...c, isMember: true } : c)));
            navigation.navigate('ChannelChat', { channel: { ...item, isMember: true } });
          } catch (err) {
            toast(errorMessage(err, 'Could not join channel'), 'error');
          }
        },
      },
    ]);
  }, [navigation]);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? channels.filter((c) => c.name?.toLowerCase().includes(q)) : channels;
    return list.slice().sort((a, b) => (b.isMember === a.isMember ? a.name.localeCompare(b.name) : b.isMember ? 1 : -1));
  }, [channels, query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = useCallback(({ item }) => <ChannelRow item={item} onPress={open} />, [open]);

  if (!workspace) {
    return <View style={s.root}><EmptyState icon="🏢" title="No workspace selected" body="Go to Home to select a workspace." /></View>;
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Channels" subtitle={workspace.name} />
      <TextInput
        style={s.search}
        placeholder="Search channels"
        placeholderTextColor={T.textMuted}
        value={query}
        onChangeText={setQuery}
      />
      {loading && !channels.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="📢" title="No channels" body="Create channels from the web app to get started." />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  search: {
    margin: 12, backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 9,
    color: T.textPrimary, fontSize: 13, borderWidth: 1, borderColor: T.borderDefault,
  },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  icon: {
    width: 34, height: 34, borderRadius: 4, backgroundColor: T.bgActive, alignItems: 'center',
    justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: T.borderAccent,
  },
  iconPrivate: { borderColor: 'rgba(184,149,106,0.4)' },
  hash: { color: T.accent, fontSize: 16, fontWeight: '800' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: T.textPrimary, fontSize: 14, fontWeight: '600' },
  nameMuted: { color: T.textSecondary },
  lock: { fontSize: 11, marginLeft: 5 },
  badge: { color: T.textMuted, fontSize: 10, marginLeft: 6, textTransform: 'uppercase', fontWeight: '700' },
  desc: { color: T.textSecondary, fontSize: 12, marginTop: 2 },
  arrow: { color: T.borderAccent, fontSize: 18 },
  join: { color: T.accent, fontSize: 12, fontWeight: '700' },
});

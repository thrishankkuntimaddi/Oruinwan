import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchNotes, NOTE_TYPES } from '../services/api/notes';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import { useSocketEvent } from '../hooks/useSocketEvent';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

const NoteRow = memo(function NoteRow({ item, onPress }) {
  const preview = (item.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)}>
      <View style={s.titleRow}>
        {item.isPinned ? <Text style={s.pin}>📌</Text> : null}
        <Text style={s.title} numberOfLines={1}>{item.title || 'Untitled'}</Text>
      </View>
      {preview ? <Text style={s.preview} numberOfLines={2}>{preview}</Text> : null}
      <Text style={s.meta}>
        {item.type && item.type !== 'note' ? `${item.type} · ` : ''}
        {item.owner?.username ? `${item.owner.username} · ` : ''}
        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}
      </Text>
    </TouchableOpacity>
  );
});

export default function NotesScreen({ navigation }) {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [notes, setNotes] = useState([]);
  const [type, setType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await fetchNotes(wsId, type);
      setNotes((data?.notes || []).filter((n) => !n.isArchived));
    } catch (err) {
      toast(errorMessage(err, 'Could not load notes'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId, type]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSocketEvent('note-created', () => load());
  useSocketEvent('note-updated', () => load());
  useSocketEvent('note-deleted', ({ noteId } = {}) => setNotes((prev) => prev.filter((n) => n._id !== noteId)));

  const open = useCallback((note) => navigation.navigate('NoteEditor', { note }), [navigation]);
  const renderItem = useCallback(({ item }) => <NoteRow item={item} onPress={open} />, [open]);
  const types = useMemo(() => [null, ...NOTE_TYPES], []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Notes"
        subtitle={workspace?.name}
        onBack={() => navigation.goBack()}
        right={<TouchableOpacity style={s.newBtn} onPress={() => navigation.navigate('NoteEditor', {})}><Text style={s.newText}>＋ New</Text></TouchableOpacity>}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        {types.map((t) => (
          <TouchableOpacity key={t || 'all'} style={[s.chip, type === t && s.chipOn]} onPress={() => { setLoading(true); setType(t); }}>
            <Text style={[s.chipText, type === t && s.chipTextOn]}>{t || 'all'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading && !notes.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => String(n._id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="📝" title="No notes yet" actionLabel="Write a note" onAction={() => navigation.navigate('NoteEditor', {})} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  filters: { flexGrow: 0, paddingVertical: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, borderColor: T.borderDefault },
  chipOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  chipText: { color: T.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  chipTextOn: { color: T.accent, fontWeight: '700' },
  card: { backgroundColor: T.bgSurface, borderRadius: 6, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: T.borderSubtle },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  pin: { marginRight: 6, fontSize: 12 },
  title: { color: T.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  preview: { color: T.textSecondary, fontSize: 13, marginTop: 5, lineHeight: 18 },
  meta: { color: T.textMuted, fontSize: 11, marginTop: 8, textTransform: 'capitalize' },
  newBtn: { borderWidth: 1, borderColor: T.accent, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  newText: { color: T.accent, fontSize: 12, fontWeight: '700' },
});

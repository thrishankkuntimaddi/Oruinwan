import React, { memo, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchKnowledgePages } from '../services/api/knowledge';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T } from '../theme';

const PageRow = memo(function PageRow({ item, onPress }) {
  return (
    <TouchableOpacity style={s.item} onPress={() => onPress(item)}>
      <Text style={s.icon}>{item.icon || '📄'}</Text>
      <View style={s.info}>
        <Text style={s.title} numberOfLines={1}>{item.title || 'Untitled Page'}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {item.isHandbook ? 'Handbook · ' : ''}{item.createdBy?.username || ''}
          {item.updatedAt ? ` · ${new Date(item.updatedAt).toLocaleDateString()}` : ''}
        </Text>
      </View>
      <Text style={s.arrow}>›</Text>
    </TouchableOpacity>
  );
});

/** One level of the page tree; drill down via KnowledgePage (which lists children). */
export default function KnowledgeScreen({ navigation }) {
  const { workspace } = useApp();
  const wsId = workspace?._id;
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const { data } = await fetchKnowledgePages(wsId, null);
      setPages((data?.pages || []).filter((p) => !p.isDeleted));
    } catch (err) {
      toast(errorMessage(err, 'Could not load knowledge base'), 'error');
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const open = useCallback((p) => navigation.push('KnowledgePage', { pageId: p._id, title: p.title }), [navigation]);
  const renderItem = useCallback(({ item }) => <PageRow item={item} onPress={open} />, [open]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  return (
    <View style={s.root}>
      <ScreenHeader title="Knowledge" subtitle={workspace?.name} onBack={() => navigation.goBack()} />
      {loading && !pages.length ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={pages}
          keyExtractor={(p) => String(p._id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListEmptyComponent={<EmptyState icon="📚" title="No pages yet" body="Create knowledge pages from the web app." />}
        />
      )}
    </View>
  );
}

export { PageRow };

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.borderSubtle },
  icon: { fontSize: 20, width: 32 },
  info: { flex: 1 },
  title: { color: T.textPrimary, fontSize: 14, fontWeight: '600' },
  meta: { color: T.textSecondary, fontSize: 11, marginTop: 3 },
  arrow: { color: T.borderAccent, fontSize: 18 },
});

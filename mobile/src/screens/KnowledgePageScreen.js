import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { fetchKnowledgePage, fetchKnowledgePages } from '../services/api/knowledge';
import { errorMessage } from '../services/http';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { PageRow } from './KnowledgeScreen';
import { T } from '../theme';

/** Very small markdown-ish renderer: headings, bullets, rules; HTML tags stripped. */
function renderContent(content) {
  const text = String(content || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li)>/gi, '\n').replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return text.split('\n').map((line, i) => {
    const key = `l${i}`;
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) return <Text key={key} style={[s.h, h[1].length === 1 && s.h1]}>{h[2]}</Text>;
    if (/^\s*[-*]\s+/.test(line)) return <Text key={key} style={s.p}>•  {line.replace(/^\s*[-*]\s+/, '')}</Text>;
    if (/^\s*---+\s*$/.test(line)) return <View key={key} style={s.hr} />;
    return <Text key={key} style={s.p}>{line}</Text>;
  });
}

export default function KnowledgePageScreen({ route, navigation }) {
  const { pageId, title } = route.params;
  const { workspace } = useApp();
  const [page, setPage] = useState(null);
  const [children, setChildren] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchKnowledgePage(pageId), fetchKnowledgePages(workspace?._id, pageId)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPage(p.data?.page || null);
        setChildren((c.data?.pages || []).filter((x) => !x.isDeleted));
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load page')); });
    return () => { cancelled = true; };
  }, [pageId, workspace?._id]);

  const open = useCallback((p) => navigation.push('KnowledgePage', { pageId: p._id, title: p.title }), [navigation]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title={`${page?.icon || '📄'} ${page?.title || title || 'Page'}`}
        subtitle={page?.createdBy?.username ? `by ${page.createdBy.username} · ${new Date(page.updatedAt).toLocaleDateString()}` : undefined}
        onBack={() => navigation.goBack()}
      />
      {error ? <EmptyState icon="⚠️" title="Could not load page" body={error} /> : !page ? (
        <ActivityIndicator color={T.accent} size="large" style={{ marginTop: 48 }} />
      ) : (
        <ScrollView contentContainerStyle={s.body}>
          {page.summary ? <Text style={s.summary}>{page.summary}</Text> : null}
          {page.content ? renderContent(page.content) : <Text style={s.empty}>This page is empty.</Text>}
          {page.tags?.length ? <Text style={s.tags}>{page.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
          {children.length ? (
            <View style={s.children}>
              <Text style={s.section}>SUB-PAGES</Text>
              {children.map((c) => <PageRow key={String(c._id)} item={c} onPress={open} />)}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  body: { padding: 16, paddingBottom: 48 },
  summary: {
    color: T.textSecondary, fontSize: 13, fontStyle: 'italic', marginBottom: 14, padding: 10,
    backgroundColor: T.bgSurface, borderLeftWidth: 2, borderLeftColor: T.accent,
  },
  h: { color: T.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  h1: { fontSize: 20 },
  p: { color: T.textPrimary, fontSize: 14, lineHeight: 21 },
  hr: { height: 1, backgroundColor: T.borderDefault, marginVertical: 12 },
  empty: { color: T.textMuted, fontStyle: 'italic' },
  tags: { color: T.accent, fontSize: 12, marginTop: 16 },
  children: { marginTop: 24 },
  section: { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
});

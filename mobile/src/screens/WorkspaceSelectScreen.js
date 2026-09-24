import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { fetchMyWorkspaces } from '../services/api/workspaces';
import { errorMessage } from '../services/http';
import { useApp, normalizeWorkspace } from '../context/AppContext';
import ScreenHeader from '../components/ScreenHeader';

export default function WorkspaceSelectScreen({ navigation }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setWorkspace, workspace: current } = useApp();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await fetchMyWorkspaces();
        if (!cancelled) setWorkspaces((data.workspaces || []).map(normalizeWorkspace));
      } catch (err) {
        if (!cancelled) Alert.alert('Error', errorMessage(err, 'Could not load workspaces.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSelect(ws) {
    await setWorkspace(ws);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <View style={styles.container}>
      {navigation.canGoBack() ? <ScreenHeader title="Switch workspace" onBack={() => navigation.goBack()} /> : null}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.title}>Select Workspace</Text>
        <Text style={styles.subtitle}>Choose a workspace to get started</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#b8956a" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={workspaces}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, current?._id === item._id && styles.cardActive]} onPress={() => handleSelect(item)}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>{(item.name || 'W')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={1}>
                  {item.description || `${item.memberCount ?? 0} members`}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🏢</Text>
              <Text style={styles.emptyTitle}>No workspaces found</Text>
              <Text style={styles.emptyBody}>
                Ask your admin to add you to a workspace.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: '#b8956a', alignItems: 'center',
    justifyContent: 'center', marginBottom: 18,
  },
  logoText: { color: '#0c0c0c', fontSize: 28, fontWeight: '800' },
  title: { color: '#e4e4e4', fontSize: 22, fontWeight: '700', marginBottom: 5, letterSpacing: -0.3 },
  subtitle: { color: '#7a7a7a', fontSize: 13 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111111', borderRadius: 6,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#222222',
  },
  cardActive: { borderColor: '#b8956a' },
  cardIcon: {
    width: 42, height: 42, borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1, borderColor: '#383838',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardIconText: { color: '#b8956a', fontSize: 17, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { color: '#e4e4e4', fontSize: 14, fontWeight: '600' },
  cardDesc: { color: '#7a7a7a', fontSize: 12, marginTop: 2 },
  arrow: { color: '#383838', fontSize: 20 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 14 },
  emptyTitle: { color: '#e4e4e4', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyBody: { color: '#7a7a7a', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});


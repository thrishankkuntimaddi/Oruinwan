import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { fetchMyWorkspaces } from '../services/api';
import { connectSocket, joinWorkspace as socketJoinWorkspace } from '../services/socket';
import { useApp } from '../context/AppContext';

export default function WorkspaceSelectScreen({ navigation }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const { setWorkspace } = useApp();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await fetchMyWorkspaces();
        
        setWorkspaces(data.workspaces || data || []);
      } catch (err) {
        Alert.alert('Error', 'Could not load workspaces. Check your connection.');
        console.warn('[WorkspaceSelect]', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSelect(ws) {
    await setWorkspace(ws);
    try {
      await connectSocket();
      socketJoinWorkspace(ws._id);
    } catch (_) {}
    navigation.replace('Main');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.title}>Select Workspace</Text>
        <Text style={styles.subtitle}>Choose a workspace to get started</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#6366f1" size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={workspaces}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { alignItems: 'center', paddingTop: 64, paddingBottom: 36, paddingHorizontal: 24 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#6366f1', alignItems: 'center',
    justifyContent: 'center', marginBottom: 20,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { color: '#94a3b8', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 16,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#334155',
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#4f46e5', alignItems: 'center',
    justifyContent: 'center', marginRight: 14,
  },
  cardIconText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  cardDesc: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  arrow: { color: '#475569', fontSize: 24 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

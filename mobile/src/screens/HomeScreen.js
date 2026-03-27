/**
 * Chttrix Mobile — Home Screen
 * Entry point after login. Displays a summary / welcome with user info.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getUser, saveUser } from '../services/storage';
import { getMe } from '../services/api';
import { connectSocket } from '../services/socket';

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
    initSocket();
  }, []);

  async function loadUser() {
    const cached = await getUser();
    if (cached) setUser(cached);
    try {
      const { data } = await getMe();
      const u = data.user || data;
      setUser(u);
      await saveUser(u);
    } catch (_) {}
  }

  async function initSocket() {
    try {
      await connectSocket();
    } catch (_) {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  }

  const stats = [
    { label: 'Messages', icon: '💬', hint: 'Switch to Messages tab' },
    { label: 'Tasks', icon: '📋', hint: 'Switch to Tasks tab' },
    { label: 'Notifications', icon: '🔔', hint: 'Switch to Notifications tab' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.username || 'C')[0].toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.username || 'there'} 👋
          </Text>
          <Text style={styles.subGreeting}>
            {user?.companyRole ? `${user.companyRole} · ` : ''}Chttrix Mobile
          </Text>
        </View>
      </View>

      {/* Quick Access */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.card}>
            <Text style={styles.cardIcon}>{s.icon}</Text>
            <Text style={styles.cardLabel}>{s.label}</Text>
            <Text style={styles.cardHint}>{s.hint}</Text>
          </View>
        ))}
      </View>

      {/* Platform banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>📱 You're on mobile</Text>
        <Text style={styles.bannerBody}>
          Your messages, tasks, and notifications stay in sync across all your devices in real time.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, marginTop: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  greeting: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  subGreeting: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  sectionTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, flex: 1, minWidth: '28%' },
  cardIcon: { fontSize: 24, marginBottom: 8 },
  cardLabel: { color: '#f1f5f9', fontWeight: '700', fontSize: 14 },
  cardHint: { color: '#64748b', fontSize: 11, marginTop: 4 },
  banner: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderLeftWidth: 4, borderLeftColor: '#6366f1' },
  bannerTitle: { color: '#f1f5f9', fontWeight: '700', fontSize: 15, marginBottom: 6 },
  bannerBody: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
});

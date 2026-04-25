import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { getMe, logoutApi } from '../services/api';
import { connectSocket, joinWorkspace, signalActive, disconnectSocket } from '../services/socket';

export default function HomeScreen({ navigation }) {
  const { user, workspace, setUser, clearSession } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  
  useEffect(() => {
    loadUser();
    connectSocket().then(() => signalActive()).catch(() => {});
  }, []);

  
  useEffect(() => {
    if (workspace?._id) joinWorkspace(workspace._id);
  }, [workspace?._id]);

  async function loadUser() {
    try {
      const { data } = await getMe();
      const u = data.user || data;
      await setUser(u);
    } catch (_) {}
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await logoutApi(); } catch (_) {}
          disconnectSocket();
          await clearSession();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  }

  const quickAccess = [
    { label: 'Channels', tab: 'Channels', icon: '#', desc: 'Team discussions' },
    { label: 'Direct Messages', tab: 'DMs', icon: '💬', desc: 'Private messages' },
    { label: 'Tasks', tab: 'Tasks', icon: '📋', desc: 'Your work items' },
    { label: 'Notifications', tab: 'Notifications', icon: '🔔', desc: 'Activity feed' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.username || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Hello, {user?.username || 'there'} 👋</Text>
          <Text style={styles.subGreeting}>
            {user?.companyRole ? `${user.companyRole} · ` : ''}Chttrix Mobile
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {}
      {workspace ? (
        <TouchableOpacity
          style={styles.workspaceCard}
          onPress={() => navigation.navigate('WorkspaceSelect')}
        >
          <View style={styles.wsIcon}>
            <Text style={styles.wsIconText}>{(workspace.name || 'W')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.wsInfo}>
            <Text style={styles.wsLabel}>ACTIVE WORKSPACE</Text>
            <Text style={styles.wsName}>{workspace.name}</Text>
          </View>
          <Text style={styles.wsSwitch}>Switch ›</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.workspaceCard, styles.workspaceCardEmpty]}
          onPress={() => navigation.navigate('WorkspaceSelect')}
        >
          <Text style={styles.wsEmptyText}>Tap to select a workspace →</Text>
        </TouchableOpacity>
      )}

      {}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.grid}>
        {quickAccess.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.card}
            onPress={() => {
              try { navigation.navigate(item.tab); } catch (_) {}
            }}
          >
            <Text style={[styles.cardIcon, item.tab === 'Channels' && styles.cardIconHash]}>
              {item.icon}
            </Text>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>📱 Real-time sync active</Text>
        <Text style={styles.bannerBody}>
          Messages, tasks, and notifications stay in sync across all your devices instantly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logoutBtn: {
    backgroundColor: '#1e293b', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#334155',
  },
  logoutText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6366f1', alignItems: 'center',
    justifyContent: 'center', marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerText: { flex: 1 },
  greeting: { color: '#f1f5f9', fontSize: 20, fontWeight: '700' },
  subGreeting: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  workspaceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 14,
    padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: '#334155',
  },
  workspaceCardEmpty: { justifyContent: 'center' },
  wsEmptyText: { color: '#6366f1', fontWeight: '600', fontSize: 14 },
  wsIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#4f46e5', alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  wsIconText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  wsInfo: { flex: 1 },
  wsLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  wsName: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginTop: 2 },
  wsSwitch: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  sectionTitle: {
    color: '#64748b', fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, width: '47%' },
  cardIcon: { fontSize: 24, marginBottom: 8 },
  cardIconHash: { fontSize: 22, fontWeight: '900', color: '#6366f1' },
  cardLabel: { color: '#f1f5f9', fontWeight: '700', fontSize: 14 },
  cardDesc: { color: '#64748b', fontSize: 11, marginTop: 4 },
  banner: {
    backgroundColor: '#1e293b', borderRadius: 16, padding: 20,
    borderLeftWidth: 4, borderLeftColor: '#6366f1',
  },
  bannerTitle: { color: '#f1f5f9', fontWeight: '700', fontSize: 15, marginBottom: 6 },
  bannerBody: { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
});

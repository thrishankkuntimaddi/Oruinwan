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
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  logoutBtn: {
    backgroundColor: '#111111', borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#222222',
  },
  logoutText: { color: '#e05252', fontSize: 12, fontWeight: '600' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1c1c1c',
    borderWidth: 1, borderColor: '#383838',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarText: { color: '#b8956a', fontSize: 18, fontWeight: '700' },
  headerText: { flex: 1 },
  greeting: { color: '#e4e4e4', fontSize: 18, fontWeight: '700' },
  subGreeting: { color: '#7a7a7a', fontSize: 12, marginTop: 2 },
  workspaceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111111', borderRadius: 6,
    padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: '#222222',
  },
  workspaceCardEmpty: { justifyContent: 'center' },
  wsEmptyText: { color: '#b8956a', fontWeight: '600', fontSize: 13 },
  wsIcon: {
    width: 38, height: 38, borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1, borderColor: '#383838',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  wsIconText: { color: '#b8956a', fontSize: 16, fontWeight: '800' },
  wsInfo: { flex: 1 },
  wsLabel: { color: '#404040', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  wsName: { color: '#e4e4e4', fontSize: 14, fontWeight: '600', marginTop: 2 },
  wsSwitch: { color: '#b8956a', fontSize: 12, fontWeight: '600' },
  sectionTitle: {
    color: '#404040', fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 10, textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  card: {
    backgroundColor: '#111111', borderRadius: 6,
    padding: 16, width: '47%',
    borderWidth: 1, borderColor: '#191919',
  },
  cardIcon: { fontSize: 22, marginBottom: 8 },
  cardIconHash: { fontSize: 18, fontWeight: '900', color: '#b8956a' },
  cardLabel: { color: '#e4e4e4', fontWeight: '600', fontSize: 13 },
  cardDesc: { color: '#404040', fontSize: 11, marginTop: 4 },
  banner: {
    backgroundColor: '#111111', borderRadius: 6, padding: 16,
    borderWidth: 1, borderColor: '#222222',
    borderLeftWidth: 2, borderLeftColor: '#b8956a',
  },
  bannerTitle: { color: '#e4e4e4', fontWeight: '600', fontSize: 13, marginBottom: 4 },
  bannerBody: { color: '#7a7a7a', fontSize: 12, lineHeight: 18 },
});


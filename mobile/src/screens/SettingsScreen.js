import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { updateMe, updateStatus, uploadProfilePicture } from '../services/api/auth';
import { forgetIdentity, clearConversationKeys } from '../services/crypto';
import { errorMessage } from '../services/http';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { T } from '../theme';

const STATUSES = [
  { key: 'active', label: 'Active', color: T.success },
  { key: 'away', label: 'Away', color: T.warning },
  { key: 'dnd', label: 'Do not disturb', color: T.danger },
];
const E2EE_LABEL = {
  ready: 'Unlocked on this device', unlocking: 'Unlocking…', locked: 'Locked',
  password_required: 'Locked — password required', no_identity: 'Not set up (sign in on the web once)',
  unsupported: 'Not supported for this account on mobile', error: 'Error loading keys',
};

export default function SettingsScreen({ navigation }) {
  const { user, workspace, e2ee, setUser, signOut } = useApp();
  const [username, setUsername] = useState(user?.username || '');
  const [about, setAbout] = useState(user?.about || '');
  const [status, setStatusState] = useState(user?.userStatus || 'active');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = username.trim() !== (user?.username || '') || about !== (user?.about || '');

  async function saveProfile() {
    if (!username.trim()) return toast('Name cannot be empty', 'error');
    setSaving(true);
    try {
      const { data } = await updateMe({ username: username.trim(), about });
      await setUser({ ...user, ...(data?.user || {}), username: username.trim(), about });
      toast('Profile updated', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not update profile'), 'error');
    } finally {
      setSaving(false);
    }
    return undefined;
  }

  async function changeStatus(next) {
    const prev = status;
    setStatusState(next);
    try {
      await updateStatus(next);
      await setUser({ ...user, userStatus: next });
    } catch (err) {
      setStatusState(prev);
      toast(errorMessage(err, 'Could not update status'), 'error');
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('Photo library permission is required', 'error');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return undefined;
    setUploading(true);
    try {
      const { data } = await uploadProfilePicture(res.assets[0]);
      await setUser({ ...user, profilePicture: data?.profilePicture || user.profilePicture });
      toast('Profile picture updated', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Upload failed'), 'error');
    } finally {
      setUploading(false);
    }
    return undefined;
  }

  function lockKeys() {
    Alert.alert('Lock encryption?', 'Your decrypted key is removed from this device. You will need your password to read messages again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', style: 'destructive', onPress: async () => { clearConversationKeys(); await forgetIdentity(user?._id); } },
    ]);
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Sign out of Oruinwan on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.profile}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
            <Avatar name={user?.username} uri={user?.profilePicture} size={72} />
            <View style={s.editBadge}>{uploading ? <ActivityIndicator size="small" color={T.bgBase} /> : <Text style={s.editBadgeText}>✎</Text>}</View>
          </TouchableOpacity>
          <Text style={s.email}>{user?.email}</Text>
        </View>

        <Text style={s.label}>DISPLAY NAME</Text>
        <TextInput style={s.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholderTextColor={T.textMuted} />
        <Text style={s.label}>ABOUT</Text>
        <TextInput style={[s.input, s.multi]} value={about} onChangeText={setAbout} multiline maxLength={500} placeholder="A few words about you" placeholderTextColor={T.textMuted} />
        {dirty ? (
          <TouchableOpacity style={s.primary} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color={T.bgBase} /> : <Text style={s.primaryText}>Save profile</Text>}
          </TouchableOpacity>
        ) : null}

        <Text style={s.label}>STATUS</Text>
        <View style={s.row}>
          {STATUSES.map((st) => (
            <TouchableOpacity key={st.key} style={[s.chip, status === st.key && s.chipOn]} onPress={() => changeStatus(st.key)}>
              <View style={[s.dot, { backgroundColor: st.color }]} />
              <Text style={[s.chipText, status === st.key && s.chipTextOn]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>WORKSPACE</Text>
        <TouchableOpacity style={s.cell} onPress={() => navigation.navigate('WorkspaceSelect')}>
          <Text style={s.cellText}>{workspace?.name || 'None selected'}</Text>
          <Text style={s.link}>Switch ›</Text>
        </TouchableOpacity>

        <Text style={s.label}>END-TO-END ENCRYPTION</Text>
        <View style={s.cell}>
          <Text style={s.cellText}>{E2EE_LABEL[e2ee.status] || e2ee.status}</Text>
          {e2ee.status === 'ready' ? (
            <TouchableOpacity onPress={lockKeys}><Text style={s.link}>Lock</Text></TouchableOpacity>
          ) : e2ee.status === 'password_required' || e2ee.status === 'locked' ? (
            <TouchableOpacity onPress={() => navigation.navigate('Unlock')}><Text style={s.link}>Unlock</Text></TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity style={s.signOut} onPress={confirmSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  body: { padding: 16, paddingBottom: 48 },
  profile: { alignItems: 'center', marginVertical: 12 },
  editBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
  },
  editBadgeText: { color: T.bgBase, fontSize: 12, fontWeight: '800' },
  email: { color: T.textSecondary, fontSize: 12, marginTop: 10 },
  label: { color: T.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12,
    color: T.textPrimary, fontSize: 14, borderWidth: 1, borderColor: T.borderDefault,
  },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  primary: { backgroundColor: T.accent, borderRadius: 4, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  primaryText: { color: T.bgBase, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 4, borderWidth: 1, borderColor: T.borderDefault,
  },
  chipOn: { borderColor: T.accent, backgroundColor: T.accentDim },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: { color: T.textSecondary, fontSize: 12 },
  chipTextOn: { color: T.textPrimary, fontWeight: '600' },
  cell: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bgSurface,
    borderRadius: 6, padding: 14, borderWidth: 1, borderColor: T.borderDefault,
  },
  cellText: { color: T.textPrimary, fontSize: 13, flex: 1 },
  link: { color: T.accent, fontWeight: '700', fontSize: 12, marginLeft: 12 },
  signOut: {
    marginTop: 32, borderRadius: 4, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: T.danger,
  },
  signOutText: { color: T.danger, fontWeight: '700' },
});

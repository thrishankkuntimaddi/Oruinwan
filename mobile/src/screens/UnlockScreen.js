import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { unlockIdentity } from '../services/crypto';
import { toast } from '../services/events';
import ScreenHeader from '../components/ScreenHeader';
import { T } from '../theme';

/**
 * E2EE unlock: derives the key-encryption key from the account password
 * (PBKDF2-SHA256, 100k iterations — can take a few seconds on device) and
 * decrypts the identity private key. The password is never stored.
 */
export default function UnlockScreen({ navigation }) {
  const { user, e2ee } = useApp();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockIdentity(user?._id, password);
      setPassword('');
      toast('Encrypted messages unlocked', 'success');
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err) {
      setError(err?.message || 'Could not unlock');
    } finally {
      setBusy(false);
    }
  }

  const unavailable = e2ee.status === 'no_identity' || e2ee.status === 'unsupported';

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Unlock encryption" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={s.body}>
        <Text style={s.icon}>🔐</Text>
        <Text style={s.title}>Your messages are end-to-end encrypted</Text>
        <Text style={s.text}>
          Enter your account password to unlock your encryption key on this device.
          You only need to do this once per device.
        </Text>
        {unavailable ? (
          <Text style={s.warn}>{e2ee.detail || 'Encryption keys are not available for this account on mobile yet.'}</Text>
        ) : (
          <>
            <TextInput
              style={[s.input, error && s.inputErr]}
              placeholder="Password"
              placeholderTextColor={T.textMuted}
              secureTextEntry
              autoFocus
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              onSubmitEditing={submit}
              editable={!busy}
            />
            {error ? <Text style={s.err}>{error}</Text> : null}
            <TouchableOpacity style={[s.btn, (!password || busy) && s.btnOff]} onPress={submit} disabled={!password || busy}>
              {busy ? <ActivityIndicator color={T.bgBase} /> : <Text style={s.btnText}>Unlock</Text>}
            </TouchableOpacity>
            {busy ? <Text style={s.hint}>Deriving key… this can take a few seconds.</Text> : null}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  body: { padding: 24, alignItems: 'stretch' },
  icon: { fontSize: 40, textAlign: 'center', marginTop: 24, marginBottom: 12 },
  title: { color: T.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  text: { color: T.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 24 },
  warn: { color: T.warning, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  input: {
    backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 13,
    color: T.textPrimary, fontSize: 14, borderWidth: 1, borderColor: T.borderDefault,
  },
  inputErr: { borderColor: T.danger },
  err: { color: T.danger, fontSize: 12, marginTop: 6 },
  btn: { backgroundColor: T.accent, borderRadius: 4, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnOff: { opacity: 0.5 },
  btnText: { color: T.bgBase, fontWeight: '700', fontSize: 14 },
  hint: { color: T.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { login } from '../services/api/auth';
import { errorMessage } from '../services/http';
import { useApp } from '../context/AppContext';
import { T } from '../theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const { signIn }              = useApp();

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required.';
    if (!password)     e.password = 'Password is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const { data } = await login(email.trim(), password);
      if (!(data?.accessToken || data?.token) || !data?.user) throw new Error('No access token received');
      // The navigator switches to the signed-in stack; the password is used once,
      // in memory, to unlock the E2EE identity key and is not stored.
      await signIn(data, password);
    } catch (err) {
      Alert.alert('Sign In Error', errorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand ── */}
        <View style={s.brand}>
          <View style={s.logo}>
            <Text style={s.logoText}>C</Text>
          </View>
          <Text style={s.appName}>Oruinwan</Text>
          <Text style={s.tagline}>Company Workspace OS</Text>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome back</Text>
          <Text style={s.cardSub}>Sign in to your workspace</Text>

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={[s.input, errors.email && s.inputErr]}
              placeholder="you@company.com"
              placeholderTextColor={T.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(v) => { setEmail(v); if (errors.email) setErrors(p => ({ ...p, email: null })); }}
            />
            {errors.email ? <Text style={s.errText}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={[s.input, errors.password && s.inputErr]}
              placeholder="Your password"
              placeholderTextColor={T.textMuted}
              secureTextEntry
              value={password}
              onChangeText={(v) => { setPassword(v); if (errors.password) setErrors(p => ({ ...p, password: null })); }}
            />
            {errors.password ? <Text style={s.errText}>{errors.password}</Text> : null}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={T.bgBase} />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Sign Up link */}
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.7}
          >
            <Text style={s.switchText}>
              New to Oruinwan?{' '}
              <Text style={s.switchLink}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bgBase },
  scroll: { padding: 24, paddingBottom: 48 },

  // Brand
  brand:   { alignItems: 'center', marginTop: 60, marginBottom: 36 },
  logo: {
    width: 68, height: 68,
    borderRadius: 14,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  logoText: { color: T.bgBase, fontSize: 30, fontWeight: '800' },
  appName:  { color: T.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  tagline:  { color: T.textMuted, fontSize: 13, marginTop: 5, letterSpacing: 0.3 },

  // Card
  card: {
    backgroundColor: T.bgSurface,
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: T.borderDefault,
  },
  cardTitle: { color: T.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardSub:   { color: T.textSecondary, fontSize: 13, marginBottom: 24 },

  // Fields
  fieldWrap: { marginBottom: 18 },
  label: {
    color: T.textSecondary, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 7, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: T.bgInput,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: T.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: T.borderDefault,
  },
  inputErr: { borderColor: T.danger },
  errText:  { color: T.danger, fontSize: 11, marginTop: 5 },

  // Button
  btn: {
    backgroundColor: T.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: T.bgBase, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  divLine: { flex: 1, height: 1, backgroundColor: T.borderSubtle },
  divText: { color: T.textMuted, marginHorizontal: 12, fontSize: 12 },

  // Switch
  switchBtn:  { alignItems: 'center', paddingVertical: 2 },
  switchText: { color: T.textSecondary, fontSize: 13 },
  switchLink: { color: T.accent, fontWeight: '600' },
});

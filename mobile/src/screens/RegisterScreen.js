import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { register } from '../services/api/auth';
import { T } from '../theme';

// Declared at module level: a component defined inside render is re-created on
// every keystroke, which remounts the TextInput and dismisses the keyboard.
function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, error, onClearError }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, error && s.inputErr]}
        placeholder={placeholder}
        placeholderTextColor={T.textMuted}
        value={value}
        onChangeText={(v) => { onChangeText(v); onClearError(); }}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  );
}

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});

  function validate() {
    const e = {};
    if (!username.trim() || username.trim().length < 3)
      e.username = 'Must be at least 3 characters.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'Enter a valid email address.';
    if (!password || password.length < 8)
      e.password = 'Must be at least 8 characters.';
    if (password !== confirm)
      e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    try {
      setLoading(true);
      await register(username.trim(), email.trim().toLowerCase(), password);
      Alert.alert(
        'Account Created',
        'Check your email for a verification link before signing in.',
        [{ text: 'Sign In', onPress: () => navigation.replace('Login') }],
        { cancelable: false }
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Sign up failed. Please try again.';
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  }

  const clearError = (key) => {
    if (errors[key]) setErrors((p) => ({ ...p, [key]: null }));
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
          <Text style={s.appName}>Create Account</Text>
          <Text style={s.tagline}>Join your team on Oruinwan</Text>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <Field label="USERNAME" value={username} onChangeText={setUsername}
            placeholder="e.g. johndoe" error={errors.username} onClearError={() => clearError('username')} />
          <Field label="WORK EMAIL" value={email} onChangeText={setEmail}
            placeholder="you@company.com" keyboardType="email-address" error={errors.email} onClearError={() => clearError('email')} />
          <Field label="PASSWORD" value={password} onChangeText={setPassword}
            placeholder="At least 8 characters" secureTextEntry error={errors.password} onClearError={() => clearError('password')} />
          <Field label="CONFIRM PASSWORD" value={confirm} onChangeText={setConfirm}
            placeholder="Repeat your password" secureTextEntry error={errors.confirm} onClearError={() => clearError('confirm')} />

          {/* CTA */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={T.bgBase} />
              : <Text style={s.btnText}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={s.switchText}>
              Already have an account?{' '}
              <Text style={s.switchLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.terms}>
          By creating an account you agree to our Terms of Service.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bgBase },
  scroll: { padding: 24, paddingBottom: 48 },

  brand:   { alignItems: 'center', marginTop: 40, marginBottom: 28 },
  logo: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoText: { color: T.bgBase, fontSize: 28, fontWeight: '800' },
  appName:  { color: T.textPrimary, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  tagline:  { color: T.textMuted, fontSize: 13, marginTop: 5 },

  card: {
    backgroundColor: T.bgSurface,
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: T.borderDefault,
  },

  fieldWrap: { marginBottom: 16 },
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

  btn: {
    backgroundColor: T.accent,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: T.bgBase, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: T.borderSubtle },
  divText: { color: T.textMuted, marginHorizontal: 12, fontSize: 12 },

  switchBtn:  { alignItems: 'center' },
  switchText: { color: T.textSecondary, fontSize: 13 },
  switchLink: { color: T.accent, fontWeight: '600' },

  terms: { color: T.textMuted, fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T } from '../../theme';

/** Explains why messages cannot be decrypted, with an unlock action when possible. */
export default function EncryptionBanner({ e2eeStatus, keyError, onUnlock }) {
  let text = null;
  let action = null;
  if (e2eeStatus === 'password_required' || e2eeStatus === 'locked') {
    text = 'Messages are end-to-end encrypted. Enter your password to unlock them on this device.';
    action = 'Unlock';
  } else if (e2eeStatus === 'unlocking') {
    text = 'Unlocking encryption keys…';
  } else if (e2eeStatus === 'no_identity') {
    text = 'Encryption is not set up for this account yet. Sign in once on the web app to create your keys.';
  } else if (e2eeStatus === 'unsupported' || e2eeStatus === 'error') {
    text = 'Encrypted messages cannot be unlocked on this device right now.';
    action = 'Retry';
  } else if (keyError?.code === 'NOT_DISTRIBUTED') {
    text = "This conversation's key has not been shared with you yet. It is shared automatically when another member is online.";
  } else if (keyError?.code === 'UNWRAP_FAILED') {
    text = "This conversation's key could not be decrypted with your identity key.";
  }
  if (!text) return null;
  return (
    <View style={s.bar}>
      <Text style={s.text}>🔒 {text}</Text>
      {action ? (
        <TouchableOpacity onPress={onUnlock} style={s.btn}><Text style={s.btnText}>{action}</Text></TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: T.accentDim,
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.borderSubtle,
  },
  text: { flex: 1, color: T.textSecondary, fontSize: 12, lineHeight: 17 },
  btn: { marginLeft: 10, borderWidth: 1, borderColor: T.accent, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
  btnText: { color: T.accent, fontWeight: '700', fontSize: 12 },
});

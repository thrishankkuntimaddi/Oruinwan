import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T } from '../theme';

export default function EmptyState({ icon = '•', title, body, actionLabel, onAction }) {
  return (
    <View style={s.wrap}>
      <Text style={s.icon}>{icon}</Text>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {body ? <Text style={s.body}>{body}</Text> : null}
      {actionLabel ? (
        <TouchableOpacity style={s.btn} onPress={onAction}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  icon: { fontSize: 36, marginBottom: 12 },
  title: { color: T.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  body: { color: T.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  btn: {
    marginTop: 16, backgroundColor: T.accentDim, borderRadius: 4,
    paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: T.accent,
  },
  btnText: { color: T.accent, fontWeight: '700', fontSize: 13 },
});

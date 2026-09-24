import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../theme';

/** Owns its own text state so keystrokes do not re-render the message list. */
function Composer({ placeholder, disabled, disabledReason, onSend, onTyping }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();

  const change = useCallback((v) => {
    setText(v);
    if (v) onTyping?.();
  }, [onTyping]);

  const submit = useCallback(async () => {
    const draft = text.trim();
    if (!draft || sending) return;
    setSending(true);
    setText('');
    const ok = await onSend(draft);
    if (!ok) setText((cur) => cur || draft); // keep the draft if encryption/send failed up-front
    setSending(false);
  }, [text, sending, onSend]);

  if (disabled) {
    return (
      <View style={[s.row, { paddingBottom: 10 + insets.bottom }]}>
        <Text style={s.disabled}>{disabledReason || 'You cannot send messages here'}</Text>
      </View>
    );
  }
  const can = !!text.trim() && !sending;
  return (
    <View style={[s.row, { paddingBottom: 10 + insets.bottom }]}>
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={T.textMuted}
        value={text}
        onChangeText={change}
        multiline
        maxLength={4000}
      />
      <TouchableOpacity style={[s.send, !can && s.sendOff]} onPress={submit} disabled={!can}>
        <Text style={s.sendIcon}>➤</Text>
      </TouchableOpacity>
    </View>
  );
}

export default memo(Composer);

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: T.borderSubtle, backgroundColor: T.bgBase,
  },
  input: {
    flex: 1, backgroundColor: T.bgInput, borderRadius: 4, paddingHorizontal: 14,
    paddingTop: 10, paddingBottom: 10, color: T.textPrimary, fontSize: 14, maxHeight: 120,
    borderWidth: 1, borderColor: T.borderDefault, marginRight: 8,
  },
  send: {
    width: 42, height: 42, borderRadius: 4, backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { opacity: 0.35 },
  sendIcon: { color: T.bgBase, fontSize: 16, fontWeight: '800' },
  disabled: { flex: 1, color: T.textSecondary, fontSize: 12, textAlign: 'center', paddingVertical: 12 },
});

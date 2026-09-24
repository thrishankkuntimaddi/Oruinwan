import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { on } from '../services/events';
import { T } from '../theme';

/** Global toast surface — anything can call toast() from services/events. */
export default function ToastHost() {
  const [item, setItem] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const off = on('toast', (t) => {
      if (!t?.message) return;
      clearTimeout(timer.current);
      setItem(t);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
          .start(({ finished }) => finished && setItem(null));
      }, t.type === 'error' ? 4500 : 3000);
    });
    return () => { off(); clearTimeout(timer.current); };
  }, [opacity]);

  if (!item) return null;
  const color = item.type === 'error' ? T.danger : item.type === 'success' ? T.success : T.accent;
  return (
    <Animated.View pointerEvents="box-none" style={[s.wrap, { opacity, bottom: insets.bottom + 72 }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setItem(null)} style={[s.toast, { borderLeftColor: color }]}>
        <Text style={s.text}>{item.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000 },
  toast: {
    backgroundColor: T.bgActive, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: T.borderAccent, borderLeftWidth: 3, maxWidth: 520, width: '100%',
  },
  text: { color: T.textPrimary, fontSize: 13, lineHeight: 18 },
});

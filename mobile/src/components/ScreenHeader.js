import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../theme';

export default function ScreenHeader({ title, subtitle, onBack, right, safeTop = true }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.bar, safeTop && { paddingTop: insets.top + 10 }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={s.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
      ) : null}
      <View style={s.titles}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right || null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.borderSubtle, backgroundColor: T.bgBase,
  },
  back: { marginRight: 12 },
  backText: { color: T.accent, fontSize: 20 },
  titles: { flex: 1 },
  title: { color: T.textPrimary, fontSize: 17, fontWeight: '700' },
  subtitle: { color: T.textSecondary, fontSize: 11, marginTop: 2 },
});

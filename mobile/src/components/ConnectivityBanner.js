import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useConnectivity } from '../hooks/useConnectivity';
import { useApp } from '../context/AppContext';
import { T } from '../theme';

/** Returns { text, tone } for the global banner, or null when everything is fine. */
export function useConnectivityBanner() {
  const { status } = useApp();
  const { online, socketStatus, queued } = useConnectivity();
  // Only surface socket trouble after it persists, so the initial connect does not flash a banner.
  const [socketDown, setSocketDown] = useState(false);
  useEffect(() => {
    if (socketStatus === 'connected') { setSocketDown(false); return undefined; }
    const t = setTimeout(() => setSocketDown(true), 3000);
    return () => clearTimeout(t);
  }, [socketStatus]);
  if (status !== 'signedIn') return null;
  if (!online) {
    return { tone: T.danger, text: queued ? `You're offline · ${queued} pending — will send when reconnected` : "You're offline" };
  }
  if (socketDown) return { tone: T.warning, text: queued ? `Reconnecting… · ${queued} pending` : 'Reconnecting…' };
  if (queued) return { tone: T.warning, text: `Sending ${queued} queued item${queued > 1 ? 's' : ''}…` };
  return null;
}

/** App-wide offline / reconnecting indicator. `topInset` is the device safe-area top. */
export default function ConnectivityBanner({ banner, topInset = 0 }) {
  if (!banner) return null;
  return (
    <View style={[s.bar, { paddingTop: topInset + 4, borderBottomColor: banner.tone }]}>
      <View style={[s.dot, { backgroundColor: banner.tone }]} />
      <Text style={s.text} numberOfLines={1}>{banner.text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.bgSurface, paddingBottom: 6, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  text: { color: T.textSecondary, fontSize: 11, fontWeight: '600' },
});

import React, { memo, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { absoluteUrl, SERVER_ORIGIN } from '../services/config';
import { getAccessTokenSync } from '../services/tokens';
import { T } from '../theme';

/** Initial-letter avatar; loads the profile picture (with auth for server-hosted URLs). */
function Avatar({ name, uri, size = 32, radius, style }) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => {
    const url = absoluteUrl(uri);
    if (!url || failed) return null;
    const token = getAccessTokenSync();
    return url.startsWith(SERVER_ORIGIN) && token ? { uri: url, headers: { Authorization: `Bearer ${token}` } } : { uri: url };
  }, [uri, failed]);
  const r = radius ?? size / 2;
  return (
    <View style={[s.box, { width: size, height: size, borderRadius: r }, style]}>
      {source ? (
        <Image source={source} style={{ width: size, height: size, borderRadius: r }} onError={() => setFailed(true)} />
      ) : (
        <Text style={[s.text, { fontSize: Math.max(10, size * 0.4) }]}>{(name || '?')[0].toUpperCase()}</Text>
      )}
    </View>
  );
}

export default memo(Avatar);

const s = StyleSheet.create({
  box: {
    backgroundColor: T.bgActive, borderWidth: 1, borderColor: T.borderAccent,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  text: { color: T.accent, fontWeight: '700' },
});

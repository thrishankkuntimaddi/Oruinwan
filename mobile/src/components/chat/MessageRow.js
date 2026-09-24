import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../Avatar';
import { T } from '../../theme';

const idOf = (v) => (v == null ? null : String(v._id ?? v.id ?? v.user?._id ?? v.user ?? v));

function groupReactions(reactions, meId) {
  const map = new Map();
  for (const r of reactions || []) {
    if (!r?.emoji) continue;
    const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (idOf(r.userId ?? r.user) === meId) g.mine = true;
    map.set(r.emoji, g);
  }
  return Array.from(map.values());
}

function MessageRow({ item, meId, showSender, highlighted, seen, onLongPress, onReact, onRetry }) {
  const isOwn = idOf(item.sender) === meId;
  const name = item.sender?.username || 'User';
  const time = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const reactions = useMemo(() => groupReactions(item.reactions, meId), [item.reactions, meId]);

  if (item._state === 'system') {
    return <View style={s.systemRow}><Text style={s.systemText}>{item._text}</Text></View>;
  }
  if (item._state === 'deleted') {
    return <View style={[s.systemRow, isOwn && s.rowOwn]}><Text style={s.deletedText}>🗑 {item._text}</Text></View>;
  }

  const muted = item._state === 'locked' || item._state === 'nokey' || item._state === 'failed';
  let status = null;
  if (isOwn) {
    if (item._status === 'sending') status = 'Sending…';
    else if (item._status === 'queued') status = 'Queued · offline';
    else if (item._status === 'failed') status = 'Failed · tap to retry';
    else if (seen) status = 'Seen';
  }

  return (
    <View style={[s.row, isOwn && s.rowOwn]}>
      {!isOwn && (showSender
        ? <Avatar name={name} uri={item.sender?.profilePicture} size={28} radius={4} style={s.avatar} />
        : <View style={s.avatarSpacer} />)}
      <View style={s.col}>
        <Pressable
          onLongPress={() => onLongPress?.(item)}
          onPress={item._status === 'failed' ? () => onRetry?.(item) : undefined}
          delayLongPress={300}
          style={[s.bubble, isOwn && s.bubbleOwn, item._status && item._status !== 'sent' && s.pending,
            item._status === 'failed' && s.failed, highlighted && s.highlight]}
        >
          {!isOwn && showSender ? <Text style={s.sender}>{name}</Text> : null}
          <Text style={[s.text, muted && s.textMuted]}>{item._text ?? ''}</Text>
          <Text style={[s.time, isOwn && s.timeOwn]}>{item.editedAt ? 'edited · ' : ''}{time}</Text>
        </Pressable>
        {reactions.length > 0 && (
          <View style={[s.reactions, isOwn && s.reactionsOwn]}>
            {reactions.map((r) => (
              <TouchableOpacity key={r.emoji} style={[s.chip, r.mine && s.chipMine]} onPress={() => onReact?.(item, r.emoji)}>
                <Text style={s.chipText}>{r.emoji} {r.count > 1 ? r.count : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {status ? <Text style={[s.status, item._status === 'failed' && { color: T.danger }]}>{status}</Text> : null}
      </View>
    </View>
  );
}

export default memo(MessageRow);

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 3 },
  rowOwn: { justifyContent: 'flex-end' },
  avatar: { marginRight: 8, alignSelf: 'flex-start', marginTop: 2 },
  avatarSpacer: { width: 36 },
  col: { maxWidth: '78%' },
  bubble: {
    backgroundColor: T.bgSurface, borderRadius: 6, borderBottomLeftRadius: 2,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.borderDefault,
  },
  bubbleOwn: {
    backgroundColor: 'rgba(184,149,106,0.15)', borderColor: 'rgba(184,149,106,0.25)',
    borderBottomLeftRadius: 6, borderBottomRightRadius: 2,
  },
  pending: { opacity: 0.6 },
  failed: { borderColor: T.danger },
  highlight: { borderColor: T.accent, backgroundColor: 'rgba(184,149,106,0.28)' },
  sender: { color: T.accent, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  text: { color: T.textPrimary, fontSize: 14, lineHeight: 20 },
  textMuted: { color: T.textSecondary, fontStyle: 'italic' },
  time: { color: T.textMuted, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeOwn: { color: 'rgba(184,149,106,0.6)' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  reactionsOwn: { justifyContent: 'flex-end' },
  chip: {
    backgroundColor: T.bgActive, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: T.borderDefault,
  },
  chipMine: { borderColor: T.accent, backgroundColor: T.accentDim },
  chipText: { fontSize: 12, color: T.textPrimary },
  status: { color: T.textMuted, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  systemRow: { paddingHorizontal: 20, paddingVertical: 6, alignItems: 'center' },
  systemText: { color: T.textSecondary, fontSize: 12, textAlign: 'center' },
  deletedText: { color: T.textMuted, fontSize: 12, fontStyle: 'italic' },
});

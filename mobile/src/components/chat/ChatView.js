import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import MessageRow from './MessageRow';
import Composer from './Composer';
import EmptyState from '../EmptyState';
import { T } from '../../theme';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '😢'];
const idOf = (v) => (v == null ? null : String(v._id ?? v.id ?? v.user?._id ?? v.user ?? v));
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

/**
 * Inverted message list + composer shared by channel and DM screens.
 * Inverted lists keep the newest message pinned to the bottom without
 * scrollToEnd, and older pages append at the end (no jump on prepend).
 */
const ChatView = forwardRef(function ChatView({
  convo, meId, isDM, placeholder, composerDisabled, composerDisabledReason,
  highlightId, onDividerPress, emptyTitle, emptyBody, header,
}, ref) {
  const listRef = useRef(null);
  const [picker, setPicker] = useState(null);
  const { messages, loading, error, hasMore, hasMoreNewer, loadingOlder, typingName } = convo;

  const items = useMemo(() => {
    const out = [];
    let last = null;
    for (const m of messages) {
      if (!m.createdAt) continue;
      const k = dayKey(m.createdAt);
      if (k !== last) {
        out.push({
          _id: `day-${k}`, _divider: true, rawDate: m.createdAt,
          label: new Date(m.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        });
        last = k;
      }
      out.push(m);
    }
    return out.reverse();
  }, [messages]);

  const seenId = useMemo(() => {
    if (!isDM) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m._tempId || idOf(m.sender) !== meId) continue;
      if ((m.readBy || []).some((r) => idOf(r) !== meId)) return String(m._id);
    }
    return null;
  }, [messages, isDM, meId]);

  useImperativeHandle(ref, () => ({
    scrollToMessage(id) {
      const index = items.findIndex((it) => String(it._id) === String(id));
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      return index >= 0;
    },
    scrollToLatest() { listRef.current?.scrollToOffset({ offset: 0, animated: true }); },
  }), [items]);

  const onLongPress = useCallback((item) => { if (!item._tempId) setPicker(item); }, []);
  const onReact = useCallback((item, emoji) => convo.toggleReaction(item, emoji), [convo.toggleReaction]); // eslint-disable-line react-hooks/exhaustive-deps
  const onRetry = useCallback((item) => convo.retry(item), [convo.retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(({ item, index }) => {
    if (item._divider) {
      return (
        <View style={s.divider}>
          <TouchableOpacity disabled={!onDividerPress} onPress={() => onDividerPress?.(item.rawDate)} style={s.pill}>
            <Text style={s.pillText}>{item.label}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const prev = items[index + 1]; // chronologically previous (list is inverted)
    const showSender = !prev || prev._divider || idOf(prev.sender) !== idOf(item.sender);
    return (
      <MessageRow
        item={item}
        meId={meId}
        showSender={showSender}
        highlighted={highlightId != null && String(item._id) === String(highlightId)}
        seen={seenId === String(item._id)}
        onLongPress={onLongPress}
        onReact={onReact}
        onRetry={onRetry}
      />
    );
  }, [items, meId, highlightId, seenId, onLongPress, onReact, onRetry, onDividerPress]);

  const keyExtractor = useCallback((it) => String(it._id), []);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {loading && !messages.length ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
      ) : error && !messages.length ? (
        <EmptyState icon="⚠️" title="Could not load messages" body={error} />
      ) : (
        <FlatList
          ref={listRef}
          inverted
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onEndReached={hasMore ? convo.loadOlder : undefined}
          onEndReachedThreshold={0.3}
          onStartReached={hasMoreNewer ? () => convo.loadNewer() : undefined}
          onStartReachedThreshold={0.3}
          maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 60 }}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 120);
          }}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={T.accent} style={{ margin: 12 }} /> : null}
          ListEmptyComponent={
            <View style={s.invertFix}><EmptyState icon="👋" title={emptyTitle} body={emptyBody} /></View>
          }
          contentContainerStyle={{ paddingVertical: 8 }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
          windowSize={11}
        />
      )}
      {hasMoreNewer ? (
        <TouchableOpacity style={s.latest} onPress={() => convo.reloadLatest().then(() => listRef.current?.scrollToOffset({ offset: 0 }))}>
          <Text style={s.latestText}>↓ Jump to latest</Text>
        </TouchableOpacity>
      ) : null}
      {typingName ? <Text style={s.typing}>{typingName} is typing…</Text> : null}
      <Composer
        placeholder={placeholder}
        disabled={composerDisabled}
        disabledReason={composerDisabledReason}
        onSend={convo.send}
        onTyping={convo.notifyTyping}
      />
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={s.picker}>
            {QUICK_REACTIONS.map((e) => (
              <TouchableOpacity key={e} style={s.pickerBtn} onPress={() => { convo.toggleReaction(picker, e); setPicker(null); }}>
                <Text style={s.pickerEmoji}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
});

export default ChatView;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  divider: { alignItems: 'center', marginVertical: 10 },
  pill: {
    backgroundColor: T.bgSurface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: T.borderDefault,
  },
  pillText: { color: T.textSecondary, fontSize: 11, fontWeight: '600' },
  invertFix: { transform: [{ scaleY: -1 }] },
  typing: { color: T.textSecondary, fontSize: 11, fontStyle: 'italic', paddingHorizontal: 16, paddingVertical: 4 },
  latest: {
    position: 'absolute', right: 16, bottom: 90, backgroundColor: T.bgActive, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: T.accent,
  },
  latestText: { color: T.accent, fontSize: 12, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: T.overlay, justifyContent: 'center', alignItems: 'center' },
  picker: {
    flexDirection: 'row', backgroundColor: T.bgSurface, borderRadius: 28, padding: 8,
    borderWidth: 1, borderColor: T.borderAccent,
  },
  pickerBtn: { padding: 8 },
  pickerEmoji: { fontSize: 26 },
});

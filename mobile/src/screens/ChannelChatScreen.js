import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ChatView from '../components/chat/ChatView';
import DateJumpModal from '../components/chat/DateJumpModal';
import EncryptionBanner from '../components/chat/EncryptionBanner';
import ScreenHeader from '../components/ScreenHeader';
import { useConversation } from '../hooks/useConversation';
import { useApp } from '../context/AppContext';
import { fetchChannelJumpAnchor } from '../services/api/messages';
import { restoreIdentity } from '../services/crypto';
import { toast } from '../services/events';
import { errorMessage } from '../services/http';
import { T } from '../theme';

export default function ChannelChatScreen({ route, navigation }) {
  const { channel } = route.params;
  const { user, workspace, e2ee } = useApp();
  const convo = useConversation({
    type: 'channel', id: channel._id, workspaceId: workspace?._id, me: user, e2eeStatus: e2ee.status,
  });
  const chatRef = useRef(null);
  const highlightTimer = useRef(null);
  const pendingScroll = useRef(null);
  const [picker, setPicker] = useState(null); // initial Date | null
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  // After a jump replaces the window, scroll once the new rows are rendered.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return undefined;
    const t = setTimeout(() => {
      if (chatRef.current?.scrollToMessage(id)) pendingScroll.current = null;
    }, 80);
    return () => clearTimeout(t);
  }, [convo.messages]);

  const minDate = useMemo(() => {
    const created = channel.createdAt ? new Date(channel.createdAt) : new Date(0);
    const joined = convo.joinedAt ? new Date(convo.joinedAt) : null;
    return joined && joined > created ? joined : created;
  }, [channel.createdAt, convo.joinedAt]);

  const onSelectDate = useCallback(async (date) => {
    setPicker(null);
    const pad = (n) => String(n).padStart(2, '0');
    const ds = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    try {
      const { data } = await fetchChannelJumpAnchor(channel._id,
        new Date(`${ds}T00:00:00`).toISOString(), new Date(`${ds}T23:59:59.999`).toISOString());
      if (!data?.anchorMessageId) {
        toast('No messages around that date.');
        return;
      }
      pendingScroll.current = data.anchorMessageId;
      await convo.jumpTo(data.anchorMessageId);
      setHighlightId(data.anchorMessageId);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 3000);
      if (data.isFallback) toast('No messages on that date — showing the nearest conversation.');
    } catch (err) {
      toast(errorMessage(err, 'Could not jump to that date'), 'error');
    }
  }, [channel._id, convo.jumpTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUnlock = useCallback(() => {
    if (e2ee.status === 'unsupported' || e2ee.status === 'error') restoreIdentity(user?._id);
    else navigation.navigate('Unlock');
  }, [e2ee.status, navigation, user?._id]);

  const locked = e2ee.status !== 'ready';
  const joinBlocked = !!convo.joinError;

  return (
    <View style={s.root}>
      <ChatView
        ref={chatRef}
        convo={convo}
        meId={user?._id}
        isDM={false}
        highlightId={highlightId}
        onDividerPress={(raw) => setPicker(new Date(raw))}
        placeholder={`Message #${channel.name}`}
        composerDisabled={locked || joinBlocked}
        composerDisabledReason={joinBlocked ? 'You are not a member of this channel' : 'Unlock encryption to send messages'}
        emptyTitle="Start the conversation"
        emptyBody={`Be the first to post in #${channel.name}`}
        header={(
          <>
            <ScreenHeader
              title={`#${channel.name}${channel.isPrivate ? ' 🔒' : ''}`}
              subtitle={channel.description || workspace?.name}
              onBack={() => navigation.goBack()}
              right={(
                <TouchableOpacity onPress={() => setPicker(new Date())} style={s.cal}>
                  <Text style={s.calText}>📅</Text>
                </TouchableOpacity>
              )}
            />
            <EncryptionBanner e2eeStatus={e2ee.status} keyError={convo.keyError} onUnlock={onUnlock} />
          </>
        )}
      />
      <DateJumpModal
        visible={!!picker}
        initialDate={picker}
        minDate={minDate}
        onClose={() => setPicker(null)}
        onSelect={onSelectDate}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgBase },
  cal: { padding: 6, borderRadius: 4, backgroundColor: T.bgSurface, borderWidth: 1, borderColor: T.borderDefault },
  calText: { fontSize: 15 },
});

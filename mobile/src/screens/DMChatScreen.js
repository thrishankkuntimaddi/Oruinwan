import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import ChatView from '../components/chat/ChatView';
import EncryptionBanner from '../components/chat/EncryptionBanner';
import ScreenHeader from '../components/ScreenHeader';
import { useConversation } from '../hooks/useConversation';
import { useApp } from '../context/AppContext';
import { restoreIdentity } from '../services/crypto';
import { T } from '../theme';

export default function DMChatScreen({ route, navigation }) {
  const { dmId, otherUser, otherUserId } = route.params;
  const { user, workspace, e2ee } = useApp();
  const convo = useConversation({
    type: 'dm', id: dmId, workspaceId: workspace?._id, otherUserId, me: user, e2eeStatus: e2ee.status,
  });
  const name = otherUser?.username || 'Direct message';

  const onUnlock = useCallback(() => {
    if (e2ee.status === 'unsupported' || e2ee.status === 'error') restoreIdentity(user?._id);
    else navigation.navigate('Unlock');
  }, [e2ee.status, navigation, user?._id]);

  const status = otherUser?.isOnline || otherUser?.status === 'online' ? 'Online' : (otherUser?.userStatus || '');

  return (
    <View style={s.root}>
      <ChatView
        convo={convo}
        meId={user?._id}
        isDM
        placeholder={`Message ${name}`}
        composerDisabled={e2ee.status !== 'ready' || !convo.convId}
        composerDisabledReason={e2ee.status !== 'ready' ? 'Unlock encryption to send messages' : 'Loading…'}
        emptyTitle={`Say hi to ${name}`}
        emptyBody="Messages are end-to-end encrypted."
        header={(
          <>
            <ScreenHeader title={name} subtitle={status} onBack={() => navigation.goBack()} />
            <EncryptionBanner e2eeStatus={e2ee.status} keyError={convo.keyError} onUnlock={onUnlock} />
          </>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: T.bgBase } });

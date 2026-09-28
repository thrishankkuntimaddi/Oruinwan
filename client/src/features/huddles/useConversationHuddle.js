import { useContext, useMemo } from 'react';
import { useHuddle } from './useHuddle';
import { HuddleContext } from './HuddleContext';

/**
 * The call controls of one channel or DM.
 *
 * The call itself lives in the app-wide HuddleProvider, so opening another page
 * keeps you in it; this hook only exposes that call when it belongs to this
 * conversation. A local, idle useHuddle instance still watches the conversation
 * for "X started a huddle" announcements. Without an app-wide provider (tests,
 * embeds) it falls back to a conversation-local call, as before.
 */
export function useConversationHuddle({ channelId, dmId, currentUser, socket }) {
    const ctx = useContext(HuddleContext);
    const local = useHuddle({ channelId, dmId, currentUser, socket });

    return useMemo(() => {
        if (!ctx) return local;
        const scope = channelId ? { channelId } : dmId ? { dmId } : null;
        const here = !!scope && ctx.isCallIn(scope);
        const announcement = local.huddleAnnouncement && local.huddleAnnouncement.huddleId !== ctx.huddleId
            ? local.huddleAnnouncement : null;
        return {
            active: here,
            huddleId: here ? ctx.huddleId : null,
            participants: here ? ctx.participants : [],
            muted: here ? ctx.muted : false,
            isVideo: here ? ctx.isVideo : false,
            cameraOn: here ? ctx.cameraOn : false,
            localStream: here ? ctx.localStream : null,
            remoteStreams: here ? ctx.remoteStreams : {},
            screenStream: here ? ctx.screenStream : null,
            peerStates: here ? ctx.peerStates : {},
            huddleAnnouncement: here ? null : announcement,
            dismissAnnouncement: local.dismissAnnouncement,
            toggleMute: ctx.toggleMute,
            toggleCamera: ctx.toggleCamera,
            startScreenShare: ctx.startScreenShare,
            stopScreenShare: ctx.stopScreenShare,
            leaveHuddle: ctx.leaveHuddle,
            startHuddle: (opts = {}) => ctx.startHuddle('Huddle', { ...opts, scope, quiet: true }),
            joinHuddle: (id, opts = {}) => ctx.joinHuddle({ id, video: !!opts.video, ...(scope || {}) }, { quiet: true }),
        };
    }, [ctx, local, channelId, dmId]);
}

export default useConversationHuddle;

// Mentioning someone who isn't in the channel (Slack-like): anyone in the workspace can be
// @mentioned, and after sending, the channel offers to add the people who aren't in it yet.
import { peopleFromHandles } from '../../utils/aiMentions';

const idOf = (m) => String(m?._id || m?.id || m?.user?._id || m?.user || m?.userId || '');

/**
 * Who to suggest for @mentions in a channel: its members first, then everyone else in the
 * workspace (deduplicated). members/workspaceMembers: [{ _id, username, name, profilePicture }].
 */
export function mentionCandidates(channelMembers = [], workspaceMembers = []) {
    const seen = new Set();
    const out = [];
    for (const m of [...channelMembers, ...workspaceMembers]) {
        const user = m?.user && typeof m.user === 'object' ? m.user : m;
        const id = idOf(user) || idOf(m);
        const username = user?.username || user?.name || '';
        if (!id || !username || seen.has(id)) continue;
        seen.add(id);
        out.push({ _id: id, username, name: user?.name || username, profilePicture: user?.profilePicture || null });
    }
    return out;
}

/**
 * The people a message @mentions who are in the workspace but not in the channel:
 * [{ id, username, name }]. Assistants, @here/@channel and unknown names are ignored.
 */
export function mentionedOutsiders(text, workspaceMembers = [], channelMemberIds = [], me = null) {
    const inChannel = new Set((channelMemberIds || []).map(String));
    return peopleFromHandles(text, workspaceMembers).filter((p) => !inChannel.has(String(p.id)) && String(p.id) !== String(me || ''));
}

/** "@nikhil isn't in #design." / "@nikhil and @yasin aren't in #design." */
export function outsidersSentence(people, channelName) {
    const names = people.map((p) => `@${p.username}`);
    const list = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${list} ${people.length === 1 ? "isn't" : "aren't"} in #${channelName || 'this channel'}.`;
}

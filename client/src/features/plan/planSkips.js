// What the free plan left out of a bulk create (clone, import, template): the server answers
// skippedChannels [names], channelLimit, skippedMembers [{ userId, name, reason }] and
// skippedMessage (one line). These turn that into words for the screens.

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "2 channels skipped: free plan allows 10" (null when nothing was skipped). */
export function skippedChannelsText(data) {
    const n = (data?.skippedChannels || []).length;
    if (!n) return null;
    return `${plural(n, 'channel', 'channels')} skipped: free plan allows ${data.channelLimit ?? 10}`;
}

/** "3 people not added (free plan limits): ana, ben, cy" (null when everyone came along). */
export function skippedMembersText(data) {
    const people = data?.skippedMembers || [];
    if (!people.length) return null;
    const names = people.map((p) => p.name).filter(Boolean);
    const shown = names.slice(0, 5).join(', ');
    const more = names.length > 5 ? ` and ${names.length - 5} more` : '';
    return `${plural(people.length, 'person', 'people')} not added (their joined-workspaces limit or the member limit on the free plan)${shown ? `: ${shown}${more}` : ''}`;
}

/** Every skip as one line, or null. */
export function planSkipsText(data) {
    const parts = [skippedChannelsText(data), skippedMembersText(data)].filter(Boolean);
    return parts.length ? parts.join('. ') : null;
}

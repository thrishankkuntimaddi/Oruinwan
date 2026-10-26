'use strict';

// Which known usernames a message @mentions. Usernames can have spaces ("Pakanati Shiva Kumar
// Goud"), so after an "@" the longest known name wins. Same rule as the apps
// (platform/people/mentions.js).

const WORD = /[\p{L}\p{N}_]/u;
const fold = (s) => String(s || '').toLowerCase().replace(/[\s ]+/g, ' ').trim();

/** Lower-case, single-spaced usernames from `usernames` that `text` mentions. */
function mentionedUsernames(text, usernames = []) {
    const src = String(text || '');
    const found = new Set();
    if (!src.includes('@')) return found;
    const list = [...new Set((usernames || []).map(fold).filter(Boolean))].sort((a, b) => b.length - a.length);
    const flat = src.toLowerCase().replace(/[\s ]/g, ' ');
    for (let i = 0; i < src.length; i += 1) {
        if (src[i] !== '@') continue;
        if (i > 0 && /[\p{L}\p{N}_@/]/u.test(src[i - 1])) continue;
        const rest = flat.slice(i + 1);
        const hit = list.find((c) => rest.startsWith(c) && !WORD.test(rest[c.length] || ''));
        if (hit) {
            found.add(hit);
            i += hit.length;
        }
    }
    return found;
}

/** The ids of `users` (a Map or array of { _id, username }) that `text` mentions. */
function mentionedUserIds(text, users) {
    const list = users instanceof Map ? [...users.values()] : (users || []);
    const names = mentionedUsernames(text, list.map((u) => u?.username));
    return list.filter((u) => u && names.has(fold(u.username))).map((u) => String(u._id || u.id));
}

module.exports = { mentionedUsernames, mentionedUserIds, foldName: fold };

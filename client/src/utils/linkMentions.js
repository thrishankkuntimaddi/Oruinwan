// @mentions become links with a mention: URL so the markdown renderer can draw
// chips (the old ~~@name~~ trick needed GFM strikethrough and clashed with it).
// Code spans and fenced blocks are left untouched. Names with spaces ("@Pakanati Shiva Kumar
// Goud") are matched against the workspace's usernames (platform/people/mentions.js).

import { findKnownMentions, findMentions } from '@platform/people/mentions.js';

const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;
// Link text can't hold these without breaking the markdown link.
const safeLabel = (s) => s.replace(/[[\]\\*_`]/g, (c) => `\\${c}`);

function linkPart(part, names) {
    const found = names ? findMentions(part, names) : findKnownMentions(part);
    if (!found.length) return part;
    let out = '';
    let last = 0;
    for (const m of found) {
        out += part.slice(last, m.start);
        out += `[@${safeLabel(m.handle)}](mention:${encodeURIComponent(m.handle)})`;
        last = m.end;
    }
    return out + part.slice(last);
}

/** `names` (optional): the usernames to match; defaults to the workspace's (setMentionNames). */
export function linkMentions(text, names = null) {
    if (!text) return text;
    return String(text)
        .split(CODE)
        .map((part, i) => (i % 2 === 1 ? part : linkPart(part, names)))
        .join('');
}

export function mentionFromHref(href) {
    return typeof href === 'string' && href.startsWith('mention:') ? decodeURIComponent(href.slice(8)) : null;
}

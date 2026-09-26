// @mentions become links with a mention: URL so the markdown renderer can draw
// chips (the old ~~@name~~ trick needed GFM strikethrough and clashed with it).
// Code spans and fenced blocks are left untouched.

const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;
const MENTION = /(^|[^\w@/])@(here|channel|[a-zA-Z0-9_.-]+)/g;

export function linkMentions(text) {
    if (!text) return text;
    return String(text)
        .split(CODE)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(MENTION, (_, pre, name) => `${pre}[@${name}](mention:${encodeURIComponent(name)})`)))
        .join('');
}

export function mentionFromHref(href) {
    return typeof href === 'string' && href.startsWith('mention:') ? decodeURIComponent(href.slice(8)) : null;
}

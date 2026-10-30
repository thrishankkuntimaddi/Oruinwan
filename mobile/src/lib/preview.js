// Short previews of message text for lists and notifications: one line, cut at a word near
// `max` characters with "…", so a long message never changes a row's height.

/** True for the server's stand-ins when it can't read an end-to-end encrypted message. */
export const isGenericPreview = (text) =>
  !text || /^(new message|new messages|sent you a message|sent a message|message|🔒.*|encrypted message|\d+ new messages?)$/i.test(String(text).trim());

export function clipPreview(text, max = 90) {
  const one = String(text || '').replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

'use strict';

/** Strip ``` fences the model may add around JSON or text. */
function stripFences(raw) {
  return String(raw || '')
    .trim()
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

/** Parse the first JSON object/array found in a model reply; null when none. */
function parseJson(raw, { array = false } = {}) {
  const cleaned = stripFences(raw);
  const candidates = [cleaned];
  const match = cleaned.match(array ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (match && match[0] !== cleaned) candidates.push(match[0]);
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (array ? Array.isArray(parsed) : parsed && typeof parsed === 'object') return parsed;
    } catch { /* try next */ }
  }
  return null;
}

/** Turn a transcript array into "Name: text" lines, capped in size. */
function transcriptToText(messages = [], { maxChars = 60_000, maxPerMessage = 4_000 } = {}) {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => {
      const name = String(m?.sender || m?.senderName || m?.author || (m?.isMe ? 'Me' : 'User')).slice(0, 80);
      const text = String(m?.text || m?.content || '').slice(0, maxPerMessage);
      return text ? `${name}: ${text}` : null;
    })
    .filter(Boolean)
    .join('\n')
    .slice(-maxChars);
}

module.exports = { stripFences, parseJson, transcriptToText };

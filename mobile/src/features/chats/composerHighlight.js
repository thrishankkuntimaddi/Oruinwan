// Live formatting in the composer: the text box stays plain Markdown (what is sent), and a copy
// drawn underneath shows it formatted — bold looks bold, *, _, ~ and ` markers fade out. Every
// character is drawn exactly once and nothing changes its width, so the caret lines up.
//
// Segments: [{ text, kind }] where kind is null | 'mark' | 'bold' | 'italic' | 'strike' |
// 'code' | 'mention' | 'quote' | 'list', or combinations joined by spaces ("bold italic").

import { findKnownMentions } from '../../../../platform/people/mentions.js';

const INLINE = [
  { kind: 'code', re: /`([^`\n]+)`/y, mark: 1 },
  { kind: 'bold', re: /\*\*(?=\S)([^\n]*?\S)\*\*/y, mark: 2 },
  { kind: 'strike', re: /~~(?=\S)([^\n]*?\S)~~/y, mark: 2 },
  { kind: 'italic', re: /_(?=\S)([^\n_]*?\S)_(?![A-Za-z0-9])/y, mark: 1, wordStart: true },
  { kind: 'italic', re: /\*(?=\S)([^\n*]*?\S)\*/y, mark: 1 },
];

function inline(line, base, out) {
  let i = 0;
  let plain = '';
  const flush = () => {
    if (plain) out.push({ text: plain, kind: base || null });
    plain = '';
  };
  while (i < line.length) {
    let matched = false;
    for (const rule of INLINE) {
      if (rule.wordStart && i > 0 && /[A-Za-z0-9]/.test(line[i - 1])) continue;
      rule.re.lastIndex = i;
      const m = rule.re.exec(line);
      if (!m) continue;
      flush();
      const mark = line.slice(i, i + rule.mark);
      const kind = base ? `${base} ${rule.kind}` : rule.kind;
      out.push({ text: mark, kind: 'mark' });
      if (rule.kind === 'code') out.push({ text: m[1], kind });
      else {
        // Bold may hold italic and so on: format what's inside too.
        const inner = [];
        inline(m[1], kind, inner);
        out.push(...inner);
      }
      out.push({ text: mark, kind: 'mark' });
      i += m[0].length;
      matched = true;
      break;
    }
    if (matched) continue;
    // @mentions and #channels
    if ((line[i] === '@' || line[i] === '#') && (i === 0 || /\s|\(/.test(line[i - 1]))) {
      // A workspace name with spaces ("@Pakanati Shiva Kumar Goud") is one mention.
      const known = line[i] === '@' ? findKnownMentions(line.slice(i)).find((x) => x.start === 0 && x.known) : null;
      const m = known ? [line.slice(i, i + known.end)] : /^[@#][\w.-]+/.exec(line.slice(i));
      if (m && m[0].length > 1) {
        flush();
        out.push({ text: m[0], kind: base ? `${base} mention` : 'mention' });
        i += m[0].length;
        continue;
      }
    }
    plain += line[i];
    i += 1;
  }
  flush();
}

export function highlightSegments(text) {
  const out = [];
  const lines = String(text ?? '').split('\n');
  let inFence = false;
  lines.forEach((line, n) => {
    if (n > 0) out.push({ text: '\n', kind: null });
    if (/^```/.test(line)) {
      out.push({ text: line, kind: 'mark' });
      inFence = !inFence;
      return;
    }
    if (inFence) {
      if (line) out.push({ text: line, kind: 'code' });
      return;
    }
    const lead = /^(> ?|- |\d+\. )/.exec(line);
    if (lead) {
      out.push({ text: lead[0], kind: 'mark' });
      inline(line.slice(lead[0].length), lead[0].startsWith('>') ? 'quote' : null, out);
      return;
    }
    inline(line, null, out);
  });
  return out;
}

/** True when the text has anything the highlighter would style (no overlay needed otherwise). */
export const hasFormatting = (text) => /[*_~`@#>]|^- |^\d+\. /m.test(String(text || ''));

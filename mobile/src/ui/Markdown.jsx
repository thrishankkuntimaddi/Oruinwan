// Small Markdown renderer for messages, AI answers and release notes. It builds React
// elements directly (never HTML strings), so message content can't inject markup.
import { Fragment } from 'react';
import { cx } from './cx.js';

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))|((?:https?:\/\/)[^\s<>()]+[^\s<>().,!?;:'"])|(@[A-Za-z][\w.-]*)|(#[a-z0-9][a-z0-9_-]*)/g;

function inline(text, keyBase = 'i', { onLink } = {}) {
  const out = [];
  let last = 0;
  // matchAll clones the regex, so nested calls (bold text) never share lastIndex.
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [tok] = m;
    const key = `${keyBase}-${m.index}`;
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (m[3]) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (m[4]) {
      const label = tok.slice(1, tok.indexOf(']'));
      const href = tok.slice(tok.indexOf('(') + 1, -1);
      out.push(
        <a key={key} href={href} onClick={(e) => onLink && (e.preventDefault(), onLink(href))} target="_blank" rel="noreferrer noopener">
          {label}
        </a>,
      );
    } else if (m[5]) {
      out.push(
        <a key={key} href={tok} onClick={(e) => onLink && (e.preventDefault(), onLink(tok))} target="_blank" rel="noreferrer noopener">
          {tok.replace(/^https?:\/\//, '')}
        </a>,
      );
    } else if (m[6] || m[7]) {
      out.push(
        <span key={key} className="rounded bg-accent/12 px-0.5 font-medium text-accent-ink">
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function withBreaks(text, key, opts) {
  return text.split('\n').map((line, i, arr) => (
    <Fragment key={`${key}-${i}`}>
      {inline(line, `${key}-${i}`, opts)}
      {i < arr.length - 1 && <br />}
    </Fragment>
  ));
}

export function parseBlocks(src) {
  const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: `h${h[1].length}`, text: h[2] });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: body.join('\n') });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ type: 'ol', items });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const body = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(lines[i])) body.push(lines[i++]);
    blocks.push({ type: 'p', text: body.join('\n') });
  }
  return blocks;
}

export function Markdown({ text, className, onLink }) {
  const opts = { onLink };
  return (
    <div className={cx('prose-oru selectable', className)}>
      {parseBlocks(text).map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case 'code':
            return (
              <pre key={k}>
                <code>{b.text}</code>
              </pre>
            );
          case 'h1':
            return <h1 key={k}>{inline(b.text, k, opts)}</h1>;
          case 'h2':
            return <h2 key={k}>{inline(b.text, k, opts)}</h2>;
          case 'h3':
            return <h3 key={k}>{inline(b.text, k, opts)}</h3>;
          case 'quote':
            return <blockquote key={k}>{withBreaks(b.text, k, opts)}</blockquote>;
          case 'ul':
            return (
              <ul key={k}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${k}-${j}`, opts)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={k}>
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t, `${k}-${j}`, opts)}</li>
                ))}
              </ol>
            );
          default:
            return <p key={k}>{withBreaks(b.text, k, opts)}</p>;
        }
      })}
    </div>
  );
}

/** Plain-text preview for list rows: strips Markdown syntax. */
export function plainPreview(text, max = 120) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/[*_`>#]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

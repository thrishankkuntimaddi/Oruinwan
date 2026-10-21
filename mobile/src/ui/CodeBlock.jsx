// A fenced code block in a message: plain text at once, then coloured when the highlighter has
// loaded. Copy puts the code on the clipboard.
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Icon } from './Icon.jsx';
import { toast } from '../lib/bus.js';
import { highlightHtml, languageOf, loadHighlighter } from './highlight.js';

export function CodeBlock({ code, lang: fence }) {
  const lang = languageOf(fence);
  const [html, setHtml] = useState(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    loadHighlighter()
      .then((hljs) => alive && setHtml(highlightHtml(hljs, code, lang)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [code, lang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Code copied');
    } catch {
      toast("Couldn't copy on this device", 'danger');
    }
  };

  return (
    <div className="code-block relative">
      <div className="flex items-center justify-between gap-2 rounded-t-lg border border-b-0 border-line bg-surface-3 px-2.5 py-1 text-[11px] text-text-2">
        <span className="font-mono">{fence?.trim() || lang || 'code'}</span>
        <button type="button" onClick={copy} aria-label="Copy code" className="grid h-6 w-6 place-items-center rounded text-text-2 active:bg-surface-2">
          <Icon as={Copy} size={13} />
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        {/* highlight.js escapes the code; only its own <span class="hl-…"> markup is added. */}
        {html ? <code className="hl" dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
      </pre>
    </div>
  );
}

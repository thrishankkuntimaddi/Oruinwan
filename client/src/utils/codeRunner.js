// Runs a JavaScript snippet in a throwaway sandboxed iframe: sandbox="allow-scripts"
// without allow-same-origin gives it an opaque origin, so it cannot read cookies,
// storage or the app's DOM. It is removed after the run or after a timeout, and its
// console output is returned.

const TIMEOUT_MS = 3000;
const READY_MS = 1000;

function sandboxDocument(id, code) {
    // The snippet travels as a JSON string literal ("<" escaped so it cannot close the
    // script element) and is compiled with Function inside the sandbox.
    const source = JSON.stringify(String(code)).replace(/</g, '\\u003c');
    return `<!doctype html><script>
const ID = ${JSON.stringify(id)};
const send = (m) => parent.postMessage(Object.assign({ id: ID }, m), '*');
const fmt = (v) => { try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); } catch (_) { return String(v); } };
['log', 'info', 'warn', 'error'].forEach((level) => {
  console[level] = (...args) => send({ type: 'log', level, text: args.map(fmt).join(' ') });
});
send({ type: 'ready' });
(async () => {
  try {
    const run = new Function('return (async () => {\\n' + ${source} + '\\n})()');
    const result = await run();
    if (result !== undefined) send({ type: 'log', level: 'result', text: fmt(result) });
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'log', level: 'error', text: String((err && err.message) || err) });
    send({ type: 'done', error: true });
  }
})();
</script>`;
}

export function runJavaScript(code, { timeoutMs = TIMEOUT_MS } = {}) {
    return new Promise((resolve) => {
        const id = `run-${Math.random().toString(36).slice(2)}`;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts');
        iframe.style.display = 'none';
        const output = [];
        let ready = false;
        let finished = false;
        let timer = null;
        let readyTimer = null;

        const done = (status) => {
            if (finished) return;
            finished = true;
            window.removeEventListener('message', onMessage);
            clearTimeout(timer);
            clearTimeout(readyTimer);
            iframe.remove();
            resolve({ status, output });
        };
        function onMessage(e) {
            if (e.source !== iframe.contentWindow || e.data?.id !== id) return;
            if (e.data.type === 'ready') ready = true;
            if (e.data.type === 'log') output.push({ level: e.data.level, text: e.data.text });
            if (e.data.type === 'done') done(e.data.error ? 'error' : 'ok');
        }
        window.addEventListener('message', onMessage);
        readyTimer = setTimeout(() => {
            if (ready) return;
            output.push({ level: 'error', text: "Running code isn't allowed on this site (its security policy blocks the sandbox)." });
            done('blocked');
        }, READY_MS);
        timer = setTimeout(() => {
            output.push({ level: 'error', text: `Stopped after ${timeoutMs / 1000}s` });
            done('timeout');
        }, timeoutMs);

        iframe.srcdoc = sandboxDocument(id, code);
        document.body.appendChild(iframe);
    });
}

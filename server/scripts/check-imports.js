// For every relative require in the server, check that destructured names and
// `require(...).name` member accesses exist on the loaded module.
require('dotenv').config();
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const fs = require('fs'), path = require('path');
function walk(d, o = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!/node_modules|__tests__|scripts|migrations/.test(p)) walk(p, o); } else if (p.endsWith('.js')) o.push(p); } return o; }
const files = ['server.js', ...walk('src'), ...walk('routes'), ...walk('utils'), ...walk('config')];
const cache = new Map();
function load(abs) { if (cache.has(abs)) return cache.get(abs); let m; try { m = require(abs); } catch (e) { m = { __loadError: e.message.split('\n')[0] }; } cache.set(abs, m); return m; }
const problems = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  // const { a, b: c } = require('./x')
  for (const m of s.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    const names = m[1].split(',').map(x => x.trim().split(':')[0].trim()).filter(Boolean);
    const abs = path.resolve(path.dirname(f), m[2]);
    const mod = load(abs);
    if (mod && mod.__loadError) { problems.push(`${f}: cannot load ${m[2]} (${mod.__loadError})`); continue; }
    for (const n of names) if (mod && !(n in mod)) problems.push(`${f}: '${n}' is not exported by ${m[2]}`);
  }
  // require('./x').name
  for (const m of s.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)\.([A-Za-z_$][\w$]*)/g)) {
    const abs = path.resolve(path.dirname(f), m[1]); const mod = load(abs);
    if (mod && !mod.__loadError && !(m[2] in mod)) problems.push(`${f}: '.${m[2]}' missing on ${m[1]}`);
  }
}
console.log(problems.length ? problems.join('\n') : 'no missing exports found');
console.log(`checked ${files.length} files`);
setTimeout(() => process.exit(0), 500);

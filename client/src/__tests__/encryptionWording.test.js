/**
 * Encryption wording guard.
 *
 * The server keeps an escrowed copy of every conversation key (for AI agents and account
 * recovery), so whoever runs the server could decrypt messages. That is encryption on the
 * device, not strict end-to-end and not zero-knowledge. Any copy a person can read must say
 * "encrypted on the device"; an overclaim here undermines the Enterprise trust argument.
 *
 * This scans the web and phone app sources (not comments, logs or tests) for the claims.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '../../..');
const ROOTS = ['client/src', 'mobile/src', 'server/utils/emailTemplates.js', 'server/src/features/integrations', 'server/src/features/developer'];
const SKIP_DIR = /(__tests__|node_modules|dist)$/;
const CODE = /\.(js|jsx|ts|tsx)$/;
const CLAIM = /end[- ]to[- ]end encrypt|zero[- ]knowledge|server (can'?t|cannot) read/i;
// Saying what Oruinwan is NOT is the honest wording, so negations are allowed.
const NEGATED = /not (strict )?(“|")?(end[- ]to[- ]end|zero[- ]knowledge)|isn'?t (end[- ]to[- ]end|zero[- ]knowledge)/i;

function files(p) {
    const abs = path.join(REPO, p);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return [abs];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => {
        const child = path.join(p, d.name);
        if (d.isDirectory()) return SKIP_DIR.test(d.name) ? [] : files(child);
        return CODE.test(d.name) && !/\.test\./.test(d.name) ? [path.join(REPO, child)] : [];
    });
}

const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
const isLog = (line) => /logger\.|console\./.test(line);

describe('encryption wording', () => {
    it('never claims end-to-end or zero-knowledge encryption in product copy', () => {
        const offenders = [];
        for (const file of ROOTS.flatMap(files)) {
            fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                if (isComment(line) || isLog(line) || !CLAIM.test(line) || NEGATED.test(line)) return;
                // Search keywords may include the term so people who type it find the article.
                if (/keywords:/.test(line)) return;
                offenders.push(`${path.relative(REPO, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
            });
        }
        expect(offenders).toEqual([]);
    });
});

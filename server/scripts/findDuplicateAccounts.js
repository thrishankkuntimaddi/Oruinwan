#!/usr/bin/env node
'use strict';

/**
 * Lists people who have more than one account: the same email in different letter case, the
 * same Gmail mailbox spelled differently (dots, +tags, googlemail.com), or a verified secondary
 * email that is someone else's main email. Read-only: it changes nothing.
 *
 *   node scripts/findDuplicateAccounts.js            (inside the app container: uses DATABASE_URL)
 */

require('dotenv').config();
const { Client } = require('pg');

const CANONICAL = `CASE WHEN lower(trim(email)) ~ '@(gmail|googlemail)\\.com$'
    THEN replace(split_part(split_part(lower(trim(email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE lower(trim(email)) END`;

async function main() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
        const { rows: groups } = await db.query(
            `SELECT ${CANONICAL} AS mailbox,
                    json_agg(json_build_object('id', id, 'username', username, 'email', email, 'google', google_id IS NOT NULL,
                             'verified', verified, 'created', created_at, 'lastLogin', last_login_at) ORDER BY created_at) AS accounts
             FROM users GROUP BY 1 HAVING count(*) > 1 ORDER BY 1`
        );
        const { rows: secondary } = await db.query(
            `SELECT e.email, e.user_id AS secondary_of, s.username AS secondary_username, u.id AS main_of, u.username AS main_username
             FROM user_emails e JOIN users u ON lower(u.email) = lower(e.email) AND u.id <> e.user_id
             JOIN users s ON s.id = e.user_id WHERE e.verified = true`
        );

        if (!groups.length && !secondary.length) {
            console.log('No duplicate accounts found.');
            return;
        }
        for (const g of groups) {
            console.log(`\n${g.mailbox}: ${g.accounts.length} accounts`);
            for (const a of g.accounts) {
                console.log(`  ${a.id}  ${a.username}  <${a.email}>  google=${a.google}  verified=${a.verified}  created=${a.created}  lastLogin=${a.lastLogin || '-'}`);
            }
        }
        for (const s of secondary) {
            console.log(`\n${s.email}: main email of ${s.main_username} (${s.main_of}) and a verified secondary email of ${s.secondary_username} (${s.secondary_of})`);
        }
        console.log('\nNothing was changed. Decide which account to keep before merging or removing any.');
    } finally {
        await db.end();
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});

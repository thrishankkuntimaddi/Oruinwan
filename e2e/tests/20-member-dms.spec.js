'use strict';

// Anyone in a workspace can message anyone: members message members (not only the owner and
// admins), people who sign in with Google (no password) included, someone who has never signed
// in yet gets the messages once they do, and a second device reads the history.

const { test, expect } = require('@playwright/test');
const { E2E, seedData, login, loginWithGoogle, openWorkspace, openDm: openDmFromHome, sendText, withDb, withPg } = require('./helpers');

// Starting a DM opens it on the Messages page; the "new message" button is on Home.
async function openDm(page, otherUsername) {
  await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await openDmFromHome(page, otherUsername);
}

async function signIn(browser, key, { blockKeyUpload = false } = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // The app's separate public-key upload fails (as it sometimes did for real accounts).
  if (blockKeyUpload) {
    await ctx.route(/\/api\/v2\/identity\/public-key$/, (route) => (
      route.request().method() === 'POST' ? route.abort() : route.continue()));
  }
  // The first-run tour can open over the page at any time; skip it whenever it's in the way.
  await page.addLocatorHandler(page.locator('[data-tour-card]'), async () => {
    await page.getByRole('button', { name: 'Skip tour' }).click();
  });
  if (E2E.users[key].google) await loginWithGoogle(page, key);
  else await login(page, key);
  await openWorkspace(page);
  return { ctx, page };
}

const message = (page, text) => page.locator('[id^="msg-"]').filter({ hasText: text });

async function reads(page, otherUsername, text) {
  await openDm(page, otherUsername);
  await expect(message(page, text)).toBeVisible({ timeout: 30_000 });
}

test.describe('member to member messages', () => {
  test('members, Google sign-ins and late joiners all message each other', async ({ browser }) => {
    test.setTimeout(360_000);
    const t = Date.now();
    const said = [];
    const say = async (page, text) => { said.push(text); await sendText(page, text); };

    const vishnu = await signIn(browser, 'vishnu');
    // Vishnu's account is like one set up before this fix whose public-key upload failed: only
    // the key saved with his encryption setup exists.
    await expect.poll(() => withPg((q) => q('SELECT 1 FROM user_crypto_state WHERE user_id = $1', [seedData().users.vishnu.id])).then((r) => r.length)).toBe(1);
    await withPg((q) => q('DELETE FROM user_identity_keys WHERE user_id = $1', [seedData().users.vishnu.id]));
    const shiva = await signIn(browser, 'shiva'); // Google, no password

    // Member → member, both ways.
    await openDm(vishnu.page, 'shiva');
    await say(vishnu.page, `vishnu to shiva ${t}`);
    await reads(shiva.page, 'vishnu', `vishnu to shiva ${t}`);
    await say(shiva.page, `shiva to vishnu ${t}`);
    await expect(message(vishnu.page, `shiva to vishnu ${t}`)).toBeVisible({ timeout: 30_000 });

    // Member → a member who has never signed in (no encryption keys yet).
    await openDm(shiva.page, 'sandeep');
    await say(shiva.page, `shiva to sandeep ${t}`);
    const sandeep = await signIn(browser, 'sandeep', { blockKeyUpload: true });
    await reads(sandeep.page, 'shiva', `shiva to sandeep ${t}`);
    await say(sandeep.page, `sandeep to shiva ${t}`);
    await expect(message(shiva.page, `sandeep to shiva ${t}`)).toBeVisible({ timeout: 30_000 });

    // That late joiner starts a new conversation with another member.
    await openDm(sandeep.page, 'vishnu');
    await say(sandeep.page, `sandeep to vishnu ${t}`);
    await reads(vishnu.page, 'sandeep', `sandeep to vishnu ${t}`);

    // Admin ↔ member and owner ↔ member keep working.
    const thrishank = await signIn(browser, 'thrishank');
    await openDm(thrishank.page, 'shiva');
    await say(thrishank.page, `admin to shiva ${t}`);
    await reads(shiva.page, 'thrishank', `admin to shiva ${t}`);
    await say(shiva.page, `shiva to admin ${t}`);
    await expect(message(thrishank.page, `shiva to admin ${t}`)).toBeVisible({ timeout: 30_000 });

    const alice = await signIn(browser, 'alice'); // the owner
    await openDm(alice.page, 'sandeep');
    await say(alice.page, `owner to sandeep ${t}`);
    await reads(sandeep.page, 'alice', `owner to sandeep ${t}`);

    // Shiva signs in with Google on a second device: the history opens there too.
    const shivaPhone = await signIn(browser, 'shiva');
    await reads(shivaPhone.page, 'vishnu', `vishnu to shiva ${t}`);
    await expect(message(shivaPhone.page, `shiva to vishnu ${t}`)).toBeVisible();
    await reads(shivaPhone.page, 'sandeep', `sandeep to shiva ${t}`);

    // The server only ever stored ciphertext.
    const leaked = await withDb(async (db) => {
      const raw = JSON.stringify(await db.collection('messages').find({}).toArray());
      return said.filter((text) => raw.includes(text));
    });
    expect(leaked).toEqual([]);

    for (const s of [vishnu, shiva, sandeep, thrishank, alice, shivaPhone]) await s.ctx.close();
  });
});

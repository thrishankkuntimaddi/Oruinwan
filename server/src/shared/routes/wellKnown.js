'use strict';

/**
 * The files phones check before they let the Oruinwan app open https://<web host> links
 * (workspace invitations): without them Android opens the browser instead of the app.
 *
 *   GET /.well-known/assetlinks.json            Android App Links
 *   GET /.well-known/apple-app-site-association iOS Universal Links (only when APPLE_TEAM_ID is set)
 *
 * Settings (server .env), all optional:
 *   ANDROID_PACKAGE            default com.oruinwan.app
 *   ANDROID_CERT_SHA256        extra signing-certificate fingerprints, comma-separated (for example
 *                              the Play Console "App signing key certificate" SHA-256)
 *   APPLE_TEAM_ID              the Apple developer team id (iOS app id = <team>.<bundle id>)
 *   IOS_BUNDLE_ID              default com.oruinwan.app
 */

const express = require('express');

// The key GitHub release builds (APK downloads) are signed with: CN=Oruinwan, O=Oruinwan, C=IN.
const RELEASE_CERT_SHA256 = '95:E2:DE:0F:29:7D:8D:22:D2:28:06:45:EB:F6:C0:20:EA:82:48:2E:2A:D2:5E:FD:FE:88:9B:AF:54:93:F7:E5';

// The app's link paths (mobile/android/app/src/main/AndroidManifest.xml, mobile/src/lib/invite.js,
// and shared message/thread links: mobile/src/lib/shareContent.js).
const APP_PATHS = ['/join-workspace*', '/join/*', '/invite/*', '/workspace/*/channel/*', '/workspace/*/dm/*'];

/** "95e2de0f…" or "95:E2:…" → "95:E2:…" (the form assetlinks.json uses). */
function normalizeFingerprint(fp) {
    const hex = String(fp || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
    if (hex.length !== 64) return null;
    return hex.match(/.{2}/g).join(':');
}

function assetLinks(env = process.env) {
    const extra = String(env.ANDROID_CERT_SHA256 || '').split(',').map(normalizeFingerprint).filter(Boolean);
    const fingerprints = [...new Set([RELEASE_CERT_SHA256, ...extra])];
    return [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: env.ANDROID_PACKAGE || 'com.oruinwan.app', sha256_cert_fingerprints: fingerprints },
    }];
}

function appleAssociation(env = process.env) {
    const team = String(env.APPLE_TEAM_ID || '').trim();
    if (!team) return null;
    const appId = `${team}.${env.IOS_BUNDLE_ID || 'com.oruinwan.app'}`;
    return { applinks: { details: [{ appIDs: [appId], components: APP_PATHS.map((p) => ({ '/': p })) }] } };
}

function wellKnownRouter(env = process.env) {
    const router = express.Router();
    // Phones fetch these directly: plain JSON, no redirects, cacheable for an hour.
    router.get('/.well-known/assetlinks.json', (req, res) => {
        res.set('Cache-Control', 'public, max-age=3600');
        res.type('application/json').send(JSON.stringify(assetLinks(env)));
    });
    router.get('/.well-known/apple-app-site-association', (req, res) => {
        const body = appleAssociation(env);
        if (!body) return res.status(404).json({ error: 'Not Found' });
        res.set('Cache-Control', 'public, max-age=3600');
        return res.type('application/json').send(JSON.stringify(body));
    });
    return router;
}

module.exports = { wellKnownRouter, assetLinks, appleAssociation, normalizeFingerprint, RELEASE_CERT_SHA256 };

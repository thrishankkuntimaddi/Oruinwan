'use strict';

const express = require('express');
const { wellKnownRouter, normalizeFingerprint, RELEASE_CERT_SHA256 } = require('../wellKnown');

async function get(env, path) {
    const server = express().use(wellKnownRouter(env)).listen(0);
    try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { redirect: 'manual' });
        const text = await res.text();
        return { status: res.status, type: res.headers.get('content-type'), body: text ? JSON.parse(text) : null };
    } finally {
        server.close();
    }
}

describe('/.well-known files for opening links in the phone app', () => {
    test('assetlinks.json names the app and the release signing key, as plain JSON', async () => {
        const res = await get({}, '/.well-known/assetlinks.json');
        expect(res.status).toBe(200);
        expect(res.type).toMatch(/application\/json/);
        expect(res.body).toEqual([{
            relation: ['delegate_permission/common.handle_all_urls'],
            target: { namespace: 'android_app', package_name: 'com.oruinwan.app', sha256_cert_fingerprints: [RELEASE_CERT_SHA256] },
        }]);
    });

    test('adds the Play signing key and others from ANDROID_CERT_SHA256, in either form', async () => {
        const play = 'ab'.repeat(32);
        const res = await get({ ANDROID_CERT_SHA256: `${play}, ${RELEASE_CERT_SHA256}, nonsense` }, '/.well-known/assetlinks.json');
        expect(res.body[0].target.sha256_cert_fingerprints).toEqual([RELEASE_CERT_SHA256, normalizeFingerprint(play)]);
        expect(normalizeFingerprint(play)).toMatch(/^AB(:AB){31}$/);
    });

    test('the iOS file exists only once the Apple team is set', async () => {
        expect((await get({}, '/.well-known/apple-app-site-association')).status).toBe(404);
        const res = await get({ APPLE_TEAM_ID: 'TEAM123' }, '/.well-known/apple-app-site-association');
        expect(res.status).toBe(200);
        expect(res.body.applinks.details[0].appIDs).toEqual(['TEAM123.com.oruinwan.app']);
        expect(res.body.applinks.details[0].components.map((c) => c['/'])).toContain('/join-workspace*');
    });
});

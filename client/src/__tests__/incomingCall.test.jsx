// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { IncomingCall, HuddleStartedBanner, ringLabel } from '../features/huddles/call/IncomingCall';
import { shouldOfferNotifications } from '../features/notifications/NotificationPermissionPrompt';
import { openMeetingPage, insideApp } from '../features/meetings/meetingModel';
import { decideStoredAlert } from '../features/notifications/notificationPolicy';
import { notificationTypeMeta } from '../features/notifications/notificationTypes';

afterEach(cleanup);

const ring = { huddleId: 'h1', kind: 'dm', dmId: 'd1', workspaceId: 'w1', title: 'Ben', from: { id: 'u2', name: 'Ben', avatar: null }, video: false, ring: true };

describe('incoming call screen', () => {
    it('says who is calling and what kind of call', () => {
        render(<IncomingCall ring={ring} onAccept={() => {}} onDecline={() => {}} />);
        expect(screen.getByTestId('incoming-call-name').textContent).toBe('Ben');
        expect(screen.getByTestId('incoming-call').textContent).toContain('Incoming voice call');
        expect(ringLabel({ ...ring, video: true })).toBe('Incoming video call');
        expect(ringLabel({ ...ring, kind: 'group_dm' })).toBe('Incoming group voice call');
    });

    it('a group call shows the group and who is calling', () => {
        render(<IncomingCall ring={{ ...ring, kind: 'group_dm', title: 'Launch crew' }} onAccept={() => {}} onDecline={() => {}} />);
        expect(screen.getByTestId('incoming-call-name').textContent).toBe('Launch crew');
        expect(screen.getByTestId('incoming-call').textContent).toContain('Ben is calling');
    });

    it('Accept and Decline, also from the keyboard', () => {
        const onAccept = vi.fn();
        const onDecline = vi.fn();
        render(<IncomingCall ring={ring} onAccept={onAccept} onDecline={onDecline} />);
        fireEvent.click(screen.getByTestId('incoming-call-accept'));
        fireEvent.click(screen.getByTestId('incoming-call-decline'));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onAccept).toHaveBeenCalledTimes(1);
        expect(onDecline).toHaveBeenCalledTimes(2);
    });

    it('a broken caller picture falls back to initials', () => {
        render(<IncomingCall ring={{ ...ring, from: { name: 'Ben Ito', avatar: 'https://x.test/broken.png' } }} onAccept={() => {}} onDecline={() => {}} />);
        const img = document.querySelector('.ic-avatar img');
        fireEvent.error(img);
        expect(document.querySelector('.ic-initials').textContent).toBe('BI');
    });

    it('nothing rings without a ring', () => {
        render(<IncomingCall ring={null} onAccept={() => {}} onDecline={() => {}} />);
        expect(screen.queryByTestId('incoming-call')).toBeNull();
    });
});

describe('channel huddle banner', () => {
    it('names who started it and where, with Join', () => {
        const onJoin = vi.fn();
        render(<HuddleStartedBanner banner={{ huddleId: 'c1', kind: 'channel', title: '#design', from: { name: 'Ben' }, ring: false }} onJoin={onJoin} onDismiss={() => {}} />);
        expect(screen.getByTestId('huddle-started-banner').textContent).toContain('Ben started a huddle');
        expect(screen.getByTestId('huddle-started-banner').textContent).toContain('in #design');
        fireEvent.click(screen.getByTestId('huddle-started-join'));
        expect(onJoin).toHaveBeenCalled();
    });
});

describe('notification permission prompt', () => {
    const win = (permission, extra = {}) => ({ Notification: { permission }, localStorage: { getItem: () => null }, navigator: {}, ...extra });
    it('only offered when the browser has not asked yet', () => {
        expect(shouldOfferNotifications({ win: win('default') })).toBe(true);
        expect(shouldOfferNotifications({ win: win('granted') })).toBe(false);
        expect(shouldOfferNotifications({ win: win('denied') })).toBe(false);
        expect(shouldOfferNotifications({ win: { localStorage: { getItem: () => null }, navigator: {} } })).toBe(false);
    });
    it('not in the desktop app, not in automated browsers, not right after "Not now"', () => {
        expect(shouldOfferNotifications({ win: win('default', { oruinwanDesktop: {} }) })).toBe(false);
        expect(shouldOfferNotifications({ win: win('default', { navigator: { webdriver: true } }) })).toBe(false);
        const now = Date.now();
        expect(shouldOfferNotifications({ win: win('default', { localStorage: { getItem: () => String(now - 1000) } }), now })).toBe(false);
        expect(shouldOfferNotifications({ win: win('default', { localStorage: { getItem: () => String(now - 30 * 86400000) } }), now })).toBe(true);
    });
});

describe('opening the meeting page', () => {
    it('the web opens a new tab; the call keeps going here', () => {
        const open = vi.fn(() => ({}));
        const navigate = vi.fn();
        openMeetingPage('/workspace/w1/meetings/m1', { navigate, win: { open } });
        expect(open).toHaveBeenCalledWith('/workspace/w1/meetings/m1', '_blank', 'noopener');
        expect(navigate).not.toHaveBeenCalled();
    });
    it('the desktop and tablet apps open it inside the app and shrink the call', () => {
        const navigate = vi.fn();
        const inApp = vi.fn();
        const open = vi.fn();
        openMeetingPage('/workspace/w1/meetings/m1', { navigate, inApp, win: { open, oruinwanDesktop: {} } });
        expect(open).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith('/workspace/w1/meetings/m1');
        expect(inApp).toHaveBeenCalled();
        expect(insideApp({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
        expect(insideApp({})).toBe(false);
    });
    it('a blocked new tab falls back to the app', () => {
        const navigate = vi.fn();
        openMeetingPage('/m', { navigate, win: { open: () => null } });
        expect(navigate).toHaveBeenCalledWith('/m');
    });
});

describe('desktop app ring events', () => {
    it('announces a ring and its end, and passes Accept / Decline / Open from the app', async () => {
        const { announceRing, announceRingEnd, onRingAction, ringDetail, desktopRings } = await import('../features/huddles/call/ringBridge');
        const seen = [];
        const onRing = (e) => seen.push(['ring', e.detail]);
        const onEnd = (e) => seen.push(['end', e.detail]);
        window.addEventListener('oruinwan:ring', onRing);
        window.addEventListener('oruinwan:ring-end', onEnd);
        announceRing({ ...ring, video: true });
        announceRingEnd('h1');
        window.removeEventListener('oruinwan:ring', onRing);
        window.removeEventListener('oruinwan:ring-end', onEnd);
        expect(seen).toEqual([
            ['ring', { huddleId: 'h1', title: 'Ben', body: 'Incoming video call', video: true }],
            ['end', { huddleId: 'h1' }],
        ]);
        expect(ringDetail({ ...ring, kind: 'group_dm', title: 'Launch crew' })).toMatchObject({ title: 'Launch crew', body: 'Ben · Incoming group voice call' });

        const actions = [];
        const off = onRingAction((a) => actions.push(a));
        for (const action of ['accept', 'decline', 'open', 'bogus']) {
            window.dispatchEvent(new CustomEvent('oruinwan:ring-action', { detail: { huddleId: 'h1', action } }));
        }
        off();
        window.dispatchEvent(new CustomEvent('oruinwan:ring-action', { detail: { huddleId: 'h1', action: 'accept' } }));
        expect(actions.map((a) => a.action)).toEqual(['accept', 'decline', 'open']);
        expect(desktopRings()).toBe(false);
    });
});

describe('call notifications in the bell', () => {
    const active = { workspaceId: 'w1', visible: true, focused: true, pathname: '/workspace/w1/home' };
    it('"huddle started" never pops a toast (the banner does that), but still counts', () => {
        const d = decideStoredAlert({ type: 'huddle_started', workspaceId: 'w1', meta: { channelId: 'c1' } }, active, {});
        expect(d.count).toBe(true);
        expect(d.toast).toBe(false);
    });
    it('a missed call pops up and has its own look', () => {
        const d = decideStoredAlert({ type: 'missed_call', workspaceId: 'w1', link: '/dm/d1', meta: { dmSessionId: 'd1' } }, active, {});
        expect(d.count).toBe(true);
        expect(d.toast).toBe(true);
        expect(notificationTypeMeta('missed_call').label).toBe('Missed call');
    });
});

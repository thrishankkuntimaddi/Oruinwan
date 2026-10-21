// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { callConflict } from '../features/huddles/HuddleContext';
import { conflictText, whereText, ConflictDialog, ElsewherePill } from '../features/huddles/call/CallDialogs';
import { callDevice } from '../features/huddles/callDevice';
import { pickFeatured, clampPos, MiniCallBody } from '../features/huddles/call/MiniCall';
import { rmsOf } from '../features/huddles/call/useSpeaking';
import { formatTime } from '../features/huddles/call/callParts';
import CallScreen from '../features/huddles/call/CallScreen';

afterEach(cleanup);

const PHONE = { id: 'p', label: 'Pixel 8', platform: 'android' };

describe('one call per person', () => {
    it('no question when I am in no call, or already in this one here', () => {
        expect(callConflict('h1')).toBeNull();
        expect(callConflict('h1', { local: { huddleId: 'h1' } })).toBeNull();
    });

    it('another call on this device asks to switch', () => {
        expect(callConflict('h2', { local: { huddleId: 'h1' } })).toMatchObject({ kind: 'switch', current: { huddleId: 'h1', here: true } });
    });

    it('this call on another device asks to move it; another call there asks to switch', () => {
        const elsewhere = { huddleId: 'h1', channelName: 'general', device: PHONE };
        expect(callConflict('h1', { elsewhere })).toEqual({ kind: 'move', current: elsewhere });
        expect(callConflict('h2', { elsewhere })).toEqual({ kind: 'switch', current: elsewhere });
    });

    it('the questions name the call and the device', () => {
        expect(conflictText({ kind: 'move', current: { device: PHONE } })).toMatchObject({ title: 'Move the call here?', yes: 'Move here' });
        expect(conflictText({ kind: 'move', current: { device: PHONE } }).body).toContain('Pixel 8');
        const sw = conflictText({ kind: 'switch', current: { channelName: 'general', device: PHONE } });
        expect(sw).toMatchObject({ title: 'Switch calls?', yes: 'Switch', no: 'Stay' });
        expect(sw.body).toBe("You're already in # general on Pixel 8. Leave it and join this one?");
        expect(conflictText({ kind: 'switch', current: { huddleId: 'h1', here: true } }).body).toBe("You're already in a call. Leave it and join this one?");
        expect(whereText({ dmId: 'd1' })).toBe('in a direct message call');
    });

    it('the dialog answers yes or no', () => {
        const onAnswer = vi.fn();
        render(<ConflictDialog conflict={{ kind: 'switch', current: { channelName: 'design' } }} onAnswer={onAnswer} />);
        fireEvent.click(screen.getByTestId('call-conflict-yes'));
        fireEvent.click(screen.getByTestId('call-conflict-no'));
        expect(onAnswer.mock.calls).toEqual([[true], [false]]);
    });

    it('"Move here" shows while my call runs on another device', () => {
        const onMove = vi.fn();
        render(<ElsewherePill call={{ huddleId: 'h1', device: PHONE }} onMove={onMove} />);
        expect(screen.getByTestId('call-elsewhere').textContent).toContain('In a call on Pixel 8');
        fireEvent.click(screen.getByTestId('call-move-here'));
        expect(onMove).toHaveBeenCalled();
    });
});

describe('call device', () => {
    const win = (ua, extra = {}) => ({ navigator: { userAgent: ua, maxTouchPoints: 0 }, ...extra });
    it('names the browser and the computer, the desktop app, and app tablets', () => {
        expect(callDevice(win('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit Chrome/130.0 Safari/537.36'))).toMatchObject({ label: 'Chrome on Mac', platform: 'web' });
        expect(callDevice(win('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130.0 Safari/537.36 Edg/130.0'))).toMatchObject({ label: 'Edge on Windows' });
        expect(callDevice(win('Mozilla/5.0 (Windows NT 10.0) Chrome/130', { oruinwanDesktop: {} }))).toMatchObject({ label: 'Desktop app on Windows', platform: 'desktop' });
        expect(callDevice(win('Mozilla/5.0 (Linux; Android 14)', { Capacitor: { getPlatform: () => 'android' } }))).toMatchObject({ label: 'Android tablet', platform: 'android' });
    });
});

describe('mini call helpers', () => {
    const people = [
        { userId: 'me', isLocal: true },
        { userId: 'b', videoEnabled: false },
        { userId: 'c', videoEnabled: true },
    ];
    it('shows whoever talks, else the last speaker, else someone with video', () => {
        expect(pickFeatured(people, new Set(['b']), null).userId).toBe('b');
        expect(pickFeatured(people, new Set(), 'b').userId).toBe('b');
        expect(pickFeatured(people, new Set(), null).userId).toBe('c');
        expect(pickFeatured([{ userId: 'me', isLocal: true }], new Set(), null).userId).toBe('me');
    });

    it('keeps the box on screen', () => {
        expect(clampPos({ right: -50, bottom: 5000 }, { width: 300, height: 200 }, { width: 1000, height: 800 })).toEqual({ right: 12, bottom: 588 });
    });

    it('measures loudness and formats time', () => {
        expect(rmsOf(new Uint8Array([128, 128, 128]))).toBe(0);
        expect(rmsOf(new Uint8Array([255, 0, 255, 0]))).toBeGreaterThan(0.9);
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(3723)).toBe('1:02:03');
    });
});

function fakeCall(over = {}) {
    return {
        participants: [
            { userId: 'me', username: 'alice', isLocal: true, audioEnabled: true },
            { userId: 'b', username: 'bob', audioEnabled: false },
        ],
        muted: false, isVideo: false, cameraOn: false, localStream: null, remoteStreams: {}, screenStream: null, peerStates: {},
        handRaised: false, huddleId: 'h1', workspaceOpen: false,
        selectedHuddle: { id: 'h1', channelName: 'general', startTime: new Date() },
        toggleMute: vi.fn(), toggleCamera: vi.fn(), toggleHand: vi.fn(), startScreenShare: vi.fn(), stopScreenShare: vi.fn(),
        leaveHuddle: vi.fn(), minimiseCall: vi.fn(), expandCall: vi.fn(), openWorkspace: vi.fn(), closeWorkspace: vi.fn(),
        ...over,
    };
}

describe('call screen', () => {
    it('shows the call, everyone in it, and the controls', () => {
        const ctx = fakeCall();
        render(<CallScreen ctx={ctx} />);
        const scr = screen.getByTestId('call-screen');
        expect(scr.textContent).toContain('# general');
        expect(scr.textContent).toContain('2 participants');
        expect(scr.textContent).toContain('bob');
        expect(screen.getAllByTestId('video-tile-remote')).toHaveLength(1);
        fireEvent.click(screen.getByTitle('Leave huddle'));
        expect(ctx.leaveHuddle).toHaveBeenCalled();
        fireEvent.click(screen.getByTestId('call-minimise'));
        expect(ctx.minimiseCall).toHaveBeenCalledTimes(1);
    });

    it('M mutes, V turns the camera on, Esc minimises; typing in a field does nothing', () => {
        const ctx = fakeCall();
        render(<div><input data-testid="field" /><CallScreen ctx={ctx} /></div>);
        fireEvent.keyDown(window, { key: 'm' });
        fireEvent.keyDown(window, { key: 'v' });
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(ctx.toggleMute).toHaveBeenCalledTimes(1);
        expect(ctx.toggleCamera).toHaveBeenCalledTimes(1);
        expect(ctx.minimiseCall).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(screen.getByTestId('field'), { key: 'm' });
        expect(ctx.toggleMute).toHaveBeenCalledTimes(1);
    });

    it('the mini call can expand and leave', () => {
        const ctx = fakeCall();
        const onExpand = vi.fn();
        render(<MiniCallBody ctx={ctx} onExpand={onExpand} />);
        expect(screen.getByTestId('call-mini').textContent).toContain('bob');
        fireEvent.click(screen.getByTestId('mini-expand'));
        fireEvent.click(screen.getByTestId('mini-leave'));
        expect(onExpand).toHaveBeenCalled();
        expect(ctx.leaveHuddle).toHaveBeenCalled();
    });
});

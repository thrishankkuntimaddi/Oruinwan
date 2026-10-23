// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import CallStage from '../CallStage';

afterEach(() => {
    cleanup();
    document.querySelectorAll('audio[id^="huddle-audio-"]').forEach(a => a.remove());
});

const fakeStream = id => ({ id, getVideoTracks: () => [{ id: `${id}-v` }], getAudioTracks: () => [{ id: `${id}-a` }] });

function people(n, { video = true } = {}) {
    const list = [{ userId: 'me', username: 'Me Myself', isLocal: true, audioEnabled: true, videoEnabled: video }];
    for (let i = 1; i < n; i += 1) list.push({ userId: `u${i}`, username: `Person ${i}`, audioEnabled: i % 3 !== 0, videoEnabled: video });
    return list;
}

function streamsFor(list) {
    const out = {};
    list.filter(p => !p.isLocal).forEach(p => { out[p.userId] = fakeStream(p.userId); });
    return out;
}

function Stage({ participants, device = 'desktop', speaking = new Set(), ...rest }) {
    return (
        <CallStage
            participants={participants}
            localStream={fakeStream('local')}
            screenStream={null}
            remoteStreams={streamsFor(participants)}
            cameraOn
            speaking={speaking}
            peerStates={{}}
            device={device}
            {...rest}
        />
    );
}

const tiles = () => [...document.querySelectorAll('[data-user]')];
const ids = () => tiles().map(t => t.dataset.user);
const layout = () => screen.getByTestId('call-stage').dataset.layout;

describe('call stage: grid and pages', () => {
    it('pages 20 people (16 per page on desktop) and nobody is lost', () => {
        const list = people(20);
        render(<Stage participants={list} />);
        expect(layout()).toBe('grid');
        expect(tiles()).toHaveLength(16);
        expect(screen.getByTestId('call-pager').textContent).toContain('Page 1 of 2');
        const firstPage = ids();
        fireEvent.click(screen.getByTestId('page-next'));
        expect(screen.getByTestId('call-pager').textContent).toContain('Page 2 of 2');
        expect(tiles()).toHaveLength(4);
        expect(new Set([...firstPage, ...ids()]).size).toBe(20);
        fireEvent.click(screen.getByTestId('page-prev'));
        expect(ids()).toEqual(firstPage);
    });

    it('a tablet shows 9 per page and swipes between pages', () => {
        render(<Stage participants={people(20)} device="tablet" />);
        expect(tiles()).toHaveLength(9);
        const canvas = document.querySelector('.cs-canvas');
        fireEvent.touchStart(canvas, { touches: [{ clientX: 400, clientY: 200 }] });
        fireEvent.touchEnd(canvas, { changedTouches: [{ clientX: 250, clientY: 210 }] });
        expect(screen.getByTestId('call-pager').textContent).toContain('Page 2 of 3');
        fireEvent.touchStart(canvas, { touches: [{ clientX: 250, clientY: 200 }] });
        fireEvent.touchEnd(canvas, { changedTouches: [{ clientX: 420, clientY: 200 }] });
        expect(screen.getByTestId('call-pager').textContent).toContain('Page 1 of 3');
    });

    it('people leaving pull me back to a page that exists', () => {
        const { rerender } = render(<Stage participants={people(20)} />);
        fireEvent.click(screen.getByTestId('page-next'));
        rerender(<Stage participants={people(10)} />);
        expect(screen.queryByTestId('call-pager')).toBeNull();
        expect(tiles()).toHaveLength(10);
    });

    it('3 people share a 2×2 grid; tiles have exact sizes', () => {
        render(<Stage participants={people(3)} />);
        const grid = document.querySelector('.cs-grid');
        expect(grid.dataset.cols).toBe('2');
        expect(grid.dataset.rows).toBe('2');
        expect(tiles()[0].style.width).toMatch(/px$/);
    });

    it('marks me as "You", shows muted mics and raised hands', () => {
        const list = people(4);
        list[2] = { ...list[2], handRaised: true };
        render(<Stage participants={list} />);
        const mine = screen.getByTestId('video-tile-local');
        expect(mine.textContent).toContain('You');
        expect(mine.querySelector('video').style.transform).toBe('scaleX(-1)');
        expect(within(tiles()[3]).getByLabelText('Muted')).toBeTruthy();
        expect(within(tiles()[2]).getByLabelText('Hand raised')).toBeTruthy();
    });
});

describe('call stage: views and pins', () => {
    it('switches between grid and speaker view', () => {
        render(<Stage participants={people(4)} speaking={new Set(['u2'])} />);
        fireEvent.click(screen.getByTestId('view-speaker'));
        expect(layout()).toBe('stage');
        const main = document.querySelector('.cs-main [data-user]');
        expect(main.dataset.user).toBe('u2');
        expect(within(screen.getByTestId('call-filmstrip')).getAllByText(/You|Person/)).toHaveLength(3);
        expect(screen.getByTestId('view-speaker').getAttribute('aria-selected')).toBe('true');
        fireEvent.click(screen.getByTestId('view-grid'));
        expect(layout()).toBe('grid');
        expect(tiles()).toHaveLength(4);
    });

    it('pins anyone to the main stage and unpins', () => {
        render(<Stage participants={people(5)} />);
        const target = tiles().find(t => t.dataset.user === 'u3');
        fireEvent.click(within(target).getByTestId('tile-pin'));
        expect(screen.getByTestId('call-stage').dataset.reason).toBe('pinned');
        expect(document.querySelector('.cs-main [data-user]').dataset.user).toBe('u3');
        expect(screen.getByTestId('stage-chip').textContent).toBe('Pinned: Person 3');
        fireEvent.click(screen.getByTestId('stage-unpin'));
        expect(layout()).toBe('grid');
    });

    it('a screen share takes the main stage; Grid goes back; a new share takes it again', () => {
        const list = people(4);
        list[1] = { ...list[1], screenSharing: true };
        const { rerender } = render(<Stage participants={list} />);
        expect(screen.getByTestId('call-stage').dataset.reason).toBe('screen');
        expect(document.querySelector('.cs-main [data-user]').dataset.user).toBe('u1');
        expect(document.querySelector('.cs-main video').style.objectFit).toBe('contain');
        expect(screen.getByTestId('stage-chip').textContent).toContain('Person 1 is sharing');
        fireEvent.click(screen.getByTestId('view-grid'));
        expect(layout()).toBe('grid');
        const next = list.map(p => (p.userId === 'u1' ? { ...p, screenSharing: false } : p.userId === 'u2' ? { ...p, screenSharing: true } : p));
        rerender(<Stage participants={next} />);
        expect(screen.getByTestId('call-stage').dataset.reason).toBe('screen');
        expect(document.querySelector('.cs-main [data-user]').dataset.user).toBe('u2');
    });

    it('a 1:1 call fills the stage with the other person and puts me in a corner', () => {
        render(<Stage participants={people(2)} />);
        expect(layout()).toBe('duo');
        const pip = screen.getByTestId('call-pip');
        expect(within(pip).getByTestId('video-tile-local')).toBeTruthy();
        expect(pip.className).toContain('at-br');
        expect(screen.getByTestId('video-tile-remote').style.width).toBe('960px');
    });

    it('waits alone without a layout toolbar', () => {
        render(<Stage participants={people(1)} />);
        expect(screen.queryByTestId('view-grid')).toBeNull();
        expect(screen.getByText('Waiting for others to join…')).toBeTruthy();
    });
});

describe('call stage: only visible tiles play video, audio never depends on tiles', () => {
    it('off-page people have no <video>; the hidden <audio> of everyone keeps playing', () => {
        const list = people(20);
        // useHuddle plays each remote person through a hidden <audio> on <body>.
        for (const p of list.filter(x => !x.isLocal)) {
            const a = document.createElement('audio');
            a.id = `huddle-audio-${p.userId}`;
            a.srcObject = fakeStream(p.userId);
            document.body.appendChild(a);
        }
        render(<Stage participants={list} />);
        expect(document.querySelectorAll('.cs-canvas video')).toHaveLength(16);
        expect(document.querySelector('.cs-canvas audio')).toBeNull();
        document.querySelectorAll('.cs-canvas video').forEach(v => expect(v.muted).toBe(true));
        fireEvent.click(screen.getByTestId('page-next'));
        expect(document.querySelectorAll('.cs-canvas video')).toHaveLength(4);
        const audios = document.querySelectorAll('audio[id^="huddle-audio-"]');
        expect(audios).toHaveLength(19);
        audios.forEach(a => expect(a.srcObject).toBeTruthy());
    });

    it('the filmstrip plays video only for tiles scrolled into view', async () => {
        render(<Stage participants={people(20)} speaking={new Set(['u1'])} />);
        fireEvent.click(screen.getByTestId('view-speaker'));
        const strip = screen.getByTestId('call-filmstrip');
        const on = () => [...strip.querySelectorAll('[data-user]')].filter(t => t.dataset.video === 'on').map(t => t.dataset.user);
        expect(strip.querySelectorAll('[data-user]')).toHaveLength(19);
        const before = on();
        expect(before.length).toBeGreaterThan(0);
        expect(before.length).toBeLessThan(19);
        expect(before[0]).toBe('me');
        // jsdom has no layout: fake the scroll offset (the strip runs right or below, by stage shape).
        Object.defineProperty(strip, 'scrollLeft', { value: 1000, configurable: true });
        Object.defineProperty(strip, 'scrollTop', { value: 1000, configurable: true });
        fireEvent.scroll(strip);
        await act(() => new Promise(r => setTimeout(r, 50)));
        const after = on();
        expect(after).not.toContain('me');
        expect(after.length).toBeLessThan(19);
        expect(after).toContain('u12');
    });

    it('a camera that is off shows initials, and a lost connection says so', () => {
        const list = people(3, { video: false });
        render(<Stage participants={list} cameraOn={false} peerStates={{ u1: 'failed' }} />);
        expect(document.querySelectorAll('.cs-canvas video')).toHaveLength(0);
        expect(screen.getByText('MM')).toBeTruthy();
        const failed = tiles().find(t => t.dataset.user === 'u1');
        expect(failed.className).toContain('is-weak');
        expect(failed.textContent).toContain('Connection failed');
    });
});

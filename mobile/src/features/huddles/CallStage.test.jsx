// The call screen's views: grid pages, speaker and pinned views, a shared screen on the stage,
// the 1:1 self-view, controls that fade, and video attached only for tiles on screen.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../app/layout.js', () => ({ useWide: () => false }));
vi.mock('./CallExtras.jsx', () => ({ CallMenu: () => null, useActiveRecorder: () => null }));

// Everyone's stream carries a live camera track, so a tile shows video whenever it's allowed to.
const fakeStream = () => ({ getVideoTracks: () => [{ readyState: 'live', muted: false }], getAudioTracks: () => [] });
vi.mock('./huddle.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, localMedia: () => fakeStream(), remoteMedia: () => fakeStream() };
});

const { useHuddle } = await import('./huddle.js');
const { CallView } = await import('./CallScreen.jsx');

const me = { userId: 'me', username: 'Me', audioEnabled: true, videoEnabled: false, isLocal: true };
const person = (i, patch = {}) => ({ userId: `u${i}`, username: `Person ${i}`, audioEnabled: true, videoEnabled: false, ...patch });
const crowd = (n, patch) => [me, ...Array.from({ length: n - 1 }, (_, i) => person(i + 1, patch))];

function inCall(participants, patch = {}) {
  useHuddle.setState({
    call: { huddleId: 'h1', scope: { channelId: 'c1' }, title: '# design', startedAt: Date.now(), meetingId: null },
    participants,
    view: 'full',
    connecting: false,
    sharing: false,
    cameraOn: false,
    ...patch,
  });
}

const callScreen = () => screen.getByTestId('huddle-call-screen');
const tiles = () => screen.queryAllByTestId('huddle-tile');
const videos = () => screen.queryAllByTestId('huddle-video');
const grid = () => screen.getByTestId('huddle-grid');

beforeEach(() => {
  window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useHuddle.setState({ call: null, participants: [], view: 'full', sharing: false, cameraOn: false });
});

describe('the grid', () => {
  it('lays out 3 and 4 people 2×2 on a phone, and 5–6 people 2×3', () => {
    inCall(crowd(3));
    const { unmount } = render(<CallView title="# design" />);
    expect(callScreen().dataset.view).toBe('grid');
    expect(grid().dataset).toMatchObject({ cols: '2', rows: '2' });
    expect(tiles()).toHaveLength(3);
    unmount();
    inCall(crowd(6));
    render(<CallView title="# design" />);
    expect(grid().dataset).toMatchObject({ cols: '2', rows: '3' });
    expect(tiles()).toHaveLength(6);
  });

  it('two people can be stacked in a grid, and go back to full screen', () => {
    inCall(crowd(2));
    render(<CallView title="# design" />);
    expect(callScreen().dataset.view).toBe('duo');
    fireEvent.click(screen.getByLabelText('Switch to grid view'));
    expect(callScreen().dataset.view).toBe('grid');
    expect(grid().dataset).toMatchObject({ cols: '1', rows: '2' });
    fireEvent.click(screen.getByLabelText('Switch to speaker view'));
    expect(callScreen().dataset.view).toBe('duo');
  });

  it('pages beyond six people, with dots and "page x of y", and nobody dropped', () => {
    inCall(crowd(10));
    render(<CallView title="# design" />);
    expect(tiles()).toHaveLength(6);
    expect(screen.getByRole('group', { name: 'Page 1 of 2' })).toBeTruthy();
    // I'm always on the first page.
    expect(tiles().some((t) => t.dataset.user === 'me')).toBe(true);
    const firstPage = tiles().map((t) => t.dataset.user);
    fireEvent.click(screen.getByRole('button', { name: 'Page 2 of 2' }));
    expect(grid().dataset.page).toBe('1');
    const secondPage = tiles().map((t) => t.dataset.user);
    expect(secondPage).toHaveLength(4);
    expect(new Set([...firstPage, ...secondPage]).size).toBe(10);
  });

  it('swipes between pages', () => {
    inCall(crowd(13));
    render(<CallView title="# design" />);
    expect(screen.getByRole('group', { name: 'Page 1 of 3' })).toBeTruthy();
    const swipe = (from, to) => {
      fireEvent.pointerDown(grid(), { clientX: from, clientY: 300, pointerId: 1 });
      fireEvent.pointerUp(grid(), { clientX: to, clientY: 305, pointerId: 1 });
    };
    swipe(300, 100);
    expect(grid().dataset.page).toBe('1');
    swipe(300, 100);
    expect(grid().dataset.page).toBe('2');
    expect(tiles()).toHaveLength(1);
    swipe(300, 100); // already on the last page
    expect(grid().dataset.page).toBe('2');
    swipe(100, 300);
    expect(grid().dataset.page).toBe('1');
    // A short drag is not a swipe.
    swipe(300, 280);
    expect(grid().dataset.page).toBe('1');
  });

  it('reflows when people leave: back to a page that exists, dots gone', () => {
    inCall(crowd(8));
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 2 of 2' }));
    expect(tiles()).toHaveLength(2);
    act(() => useHuddle.setState({ participants: crowd(5) }));
    expect(grid().dataset.page).toBe('0');
    expect(tiles()).toHaveLength(5);
    expect(screen.queryByTestId('huddle-pages')).toBeNull();
    act(() => useHuddle.setState({ participants: crowd(2) }));
    expect(callScreen().dataset.view).toBe('duo');
  });
});

describe('speaker and pinned views', () => {
  it('speaker view: one person large and everyone else in the filmstrip', () => {
    inCall(crowd(5));
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByLabelText('Switch to speaker view'));
    expect(callScreen().dataset.view).toBe('speaker');
    expect(screen.getByTestId('huddle-focus').dataset.user).not.toBe('me');
    const strip = screen.getByTestId('huddle-filmstrip');
    expect(strip.querySelectorAll('[data-testid="huddle-tile"]')).toHaveLength(4);
    fireEvent.click(screen.getByLabelText('Switch to grid view'));
    expect(callScreen().dataset.view).toBe('grid');
  });

  it('tapping a tile pins it; tapping another in the filmstrip moves the pin; unpin goes back', () => {
    inCall(crowd(4));
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByLabelText('Person 2'));
    expect(callScreen().dataset.view).toBe('stage');
    expect(screen.getByTestId('huddle-focus').dataset.user).toBe('u2');
    fireEvent.click(screen.getByLabelText('Person 3'));
    expect(screen.getByTestId('huddle-focus').dataset.user).toBe('u3');
    fireEvent.click(screen.getByLabelText('Back to everyone'));
    expect(callScreen().dataset.view).toBe('grid');
  });

  it('pressing and holding a tile pins it too', () => {
    vi.useFakeTimers();
    inCall(crowd(4));
    render(<CallView title="# design" />);
    const tile = screen.getByLabelText('Person 1');
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 });
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(tile, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.click(tile); // the click after a hold doesn't unpin
    expect(screen.getByTestId('huddle-focus').dataset.user).toBe('u1');
  });

  it('unpins when the pinned person leaves', () => {
    inCall(crowd(4));
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByLabelText('Person 3'));
    act(() => useHuddle.setState({ participants: crowd(3) }));
    expect(callScreen().dataset.view).toBe('grid');
  });

  it('a shared screen takes the stage; back to everyone returns to the grid', () => {
    inCall([...crowd(3), person(9, { sharing: true, videoEnabled: true })]);
    render(<CallView title="# design" />);
    expect(callScreen().dataset.view).toBe('stage');
    expect(screen.getByTestId('huddle-focus').dataset.user).toBe('u9');
    expect(screen.getByTestId('huddle-filmstrip').querySelectorAll('[data-testid="huddle-tile"]')).toHaveLength(3);
    fireEvent.click(screen.getByLabelText('Back to everyone'));
    expect(callScreen().dataset.view).toBe('grid');
  });

  it('my own shared screen takes the stage too', () => {
    inCall(crowd(3), { sharing: true });
    render(<CallView title="# design" />);
    expect(callScreen().dataset.view).toBe('stage');
    expect(screen.getByTestId('huddle-focus').dataset.user).toBe('me');
  });
});

describe('video only where it can be seen', () => {
  it('attaches video for the current grid page only', () => {
    inCall(crowd(10, { videoEnabled: true }).map((p) => ({ ...p, videoEnabled: true })));
    render(<CallView title="# design" />);
    expect(videos()).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Page 2 of 2' }));
    expect(videos()).toHaveLength(4);
  });

  it('attaches video for filmstrip tiles in view, following the scroll', async () => {
    inCall(crowd(20).map((p) => ({ ...p, videoEnabled: true })));
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByLabelText('Switch to speaker view'));
    const strip = screen.getByTestId('huddle-filmstrip');
    const stripTiles = () => [...strip.querySelectorAll('[data-testid="huddle-tile"]')];
    expect(stripTiles()).toHaveLength(19);
    const on = () => stripTiles().filter((t) => t.dataset.video === 'on').length;
    const firstOn = on();
    expect(firstOn).toBeGreaterThan(0);
    expect(firstOn).toBeLessThan(19);
    expect(stripTiles()[0].dataset.video).toBe('on');
    // The big tile plus the filmstrip tiles in view.
    expect(videos()).toHaveLength(firstOn + 1);
    strip.scrollLeft = 1200;
    fireEvent.scroll(strip);
    await waitFor(() => expect(stripTiles()[0].dataset.video).toBe('off'));
    expect(stripTiles()[13].dataset.video).toBe('on');
  });

  it('shows initials, not video, when the camera is off', () => {
    inCall(crowd(3));
    render(<CallView title="# design" />);
    expect(videos()).toHaveLength(0);
    expect(tiles().every((t) => t.dataset.video === 'off')).toBe(true);
  });
});

describe('the tiles', () => {
  it('say who it is, muted, hand raised, and "You" for me', () => {
    inCall([me, person(1, { audioEnabled: false, handRaised: true }), person(2)]);
    render(<CallView title="# design" />);
    expect(screen.getByLabelText('Person 1, muted, hand raised')).toBeTruthy();
    expect(screen.getByLabelText('You')).toBeTruthy();
  });

  it('mirrors my own front camera', () => {
    inCall([{ ...me, videoEnabled: true }, person(1), person(2)], { cameraOn: true, facing: 'user' });
    render(<CallView title="# design" />);
    const mine = screen.getByLabelText('You');
    expect(mine.querySelector('video').className).toContain('-scale-x-100');
  });
});

describe('the 1:1 self-view', () => {
  it('starts in a corner, swaps on tap and snaps to the nearest corner when dragged', () => {
    inCall([me, person(1, { videoEnabled: true })]);
    render(<CallView title="Call with Person 1" />);
    const self = screen.getByTestId('huddle-selfview');
    expect(self.dataset.corner).toBe('br');
    fireEvent.pointerDown(self, { clientX: 300, clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(self, { clientX: 300, clientY: 600, pointerId: 1 });
    expect(screen.getByTestId('huddle-selfview').getAttribute('aria-label')).toContain('Person 1');
    fireEvent.pointerDown(self, { clientX: 300, clientY: 600, pointerId: 1 });
    fireEvent.pointerMove(self, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(self, { clientX: 20, clientY: 20, pointerId: 1 });
    expect(screen.getByTestId('huddle-selfview').dataset.corner).toBe('tl');
  });
});

describe('the controls', () => {
  it('fade away during a video call and come back with a tap that does nothing else', () => {
    vi.useFakeTimers();
    inCall(crowd(3).map((p) => ({ ...p, videoEnabled: true })));
    render(<CallView title="# design" />);
    expect(callScreen().dataset.controls).toBe('shown');
    act(() => vi.advanceTimersByTime(5200));
    expect(callScreen().dataset.controls).toBe('hidden');
    fireEvent.click(screen.getByLabelText('Person 1'));
    expect(callScreen().dataset.controls).toBe('shown');
    expect(callScreen().dataset.view).toBe('grid'); // the tap didn't pin
  });

  it('stay put in a voice call', () => {
    vi.useFakeTimers();
    inCall(crowd(3));
    render(<CallView title="# design" />);
    act(() => vi.advanceTimersByTime(10000));
    expect(callScreen().dataset.controls).toBe('shown');
  });
});

describe('the minimised call', () => {
  it('shows the active speaker (someone else, not me)', () => {
    inCall([me, person(1), person(2, { videoEnabled: true })], { view: 'mini' });
    render(<CallView title="# design" />);
    expect(screen.getByTestId('huddle-bar-speaker').textContent).toBe('Person 2');
  });
});

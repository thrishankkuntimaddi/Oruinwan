// The call screen: full screen while in a call, minimised to a floating window and back, and
// the controls reach the call engine.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../app/layout.js', () => ({ useWide: () => false }));
vi.mock('./CallExtras.jsx', () => ({ CallMenu: () => null, useActiveRecorder: () => null }));

const { useHuddle } = await import('./huddle.js');
const { CallView } = await import('./CallScreen.jsx');

function inCall(patch = {}) {
  useHuddle.setState({
    call: { huddleId: 'h1', scope: { channelId: 'c1' }, title: '# design', startedAt: Date.now() - 65000, meetingId: null },
    participants: [
      { userId: 'me', username: 'Me', audioEnabled: true, videoEnabled: false, isLocal: true },
      { userId: 'sam', username: 'Sam', audioEnabled: false, videoEnabled: false, handRaised: true },
    ],
    view: 'full',
    connecting: false,
    ...patch,
  });
}

afterEach(() => {
  cleanup();
  useHuddle.setState({ call: null, participants: [], view: 'full' });
});

describe('the call screen', () => {
  it('shows everyone full screen with the controls', () => {
    inCall();
    render(<CallView title="# design" />);
    expect(screen.getByTestId('huddle-call-screen')).toBeTruthy();
    expect(screen.getAllByTestId('huddle-tile')).toHaveLength(2);
    expect(screen.getByLabelText('Sam, muted, hand raised')).toBeTruthy();
    expect(screen.getByText(/2 in call · 1:0\d/)).toBeTruthy();
    for (const id of ['huddle-bar-mute', 'huddle-camera', 'huddle-hand', 'huddle-bar-meeting', 'huddle-bar-more', 'huddle-bar-leave']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });

  it('minimises to a floating window and opens again with a tap', () => {
    inCall();
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByTestId('huddle-minimise'));
    expect(useHuddle.getState().view).toBe('mini');
    expect(screen.queryByTestId('huddle-call-screen')).toBeNull();
    const bubble = screen.getByTestId('huddle-expand');
    fireEvent.pointerDown(bubble, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(bubble, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(useHuddle.getState().view).toBe('full');
  });

  it('a 1:1 call shows the other person full screen and me in a corner', () => {
    inCall();
    render(<CallView title="# design" />);
    expect(screen.getByTestId('huddle-call-screen').dataset.view).toBe('duo');
    expect(screen.getByTestId('huddle-selfview').textContent).toContain('You');
  });

  it('pins a person large and goes back to everyone', () => {
    inCall({
      participants: [
        { userId: 'me', username: 'Me', audioEnabled: true, videoEnabled: false, isLocal: true },
        { userId: 'sam', username: 'Sam', audioEnabled: false, videoEnabled: false, handRaised: true },
        { userId: 'ana', username: 'Ana', audioEnabled: true, videoEnabled: false },
      ],
    });
    render(<CallView title="# design" />);
    fireEvent.click(screen.getByLabelText('Sam, muted, hand raised'));
    expect(screen.getByLabelText('Back to everyone')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Back to everyone'));
    expect(screen.queryByLabelText('Back to everyone')).toBeNull();
  });

  it('shows nothing without a call', () => {
    render(<CallView title="# design" />);
    expect(screen.queryByTestId('huddle-call-screen')).toBeNull();
    expect(screen.queryByTestId('huddle-bar')).toBeNull();
  });
});

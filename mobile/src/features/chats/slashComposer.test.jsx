// Slash commands in the phone composer: the list, running a command, inline help, unknown commands.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

vi.mock('../../data/session.js', () => ({
  api: () => ({}),
  useSession: create(() => ({ user: { id: 'me' }, workspaceId: 'w1' })),
  useWorkspace: () => ({ id: 'w1', role: 'member' }),
}));

const { Composer } = await import('./messages.jsx');
const { fakeCtx } = await import('../../../../platform/commands/commands.cases.js');

beforeEach(() => cleanup());

const setup = (overrides) => {
  const { ctx, calls } = fakeCtx({ now: undefined, ...overrides });
  const onSend = vi.fn();
  render(<Composer placeholder="Message" onSend={onSend} commands={ctx} />);
  const box = screen.getByPlaceholderText('Message');
  const type = (value) => fireEvent.change(box, { target: { value } });
  const send = () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
  return { box, type, send, calls, onSend };
};

describe('slash commands in the phone composer', () => {
  it('lists the commands as you type and filters them', () => {
    const { type } = setup();
    type('/');
    expect(screen.getByTestId('slash-item-task')).toBeTruthy();
    type('/rem');
    expect(screen.getByTestId('slash-item-remind')).toBeTruthy();
    expect(screen.queryByTestId('slash-item-task')).toBeNull();
  });

  it('tapping a command that needs words fills it and shows how to use it', () => {
    const { type, box } = setup();
    type('/ta');
    fireEvent.click(screen.getByTestId('slash-item-task'));
    expect(box.value).toBe('/task ');
    expect(screen.getByTestId('slash-hint').textContent).toContain('/task <title> [@person]');
  });

  it('runs a command on Send instead of sending the text', async () => {
    const { type, send, calls, onSend, box } = setup();
    type('/task Fix login @sandeep tomorrow');
    await send();
    await waitFor(() => expect(calls.map((c) => c[0])).toEqual(['notice', 'createTask']));
    expect(calls[1][1]).toMatchObject({ title: 'Fix login', assigneeIds: ['u1'] });
    expect(onSend).not.toHaveBeenCalled();
    expect(box.value).toBe('');
  });

  it('runs a command with nothing more to type straight from the list', async () => {
    const { type, calls } = setup();
    type('/mu');
    await act(async () => fireEvent.click(screen.getByTestId('slash-item-mute')));
    expect(calls).toEqual([['setMuted', true]]);
  });

  it('keeps the text and explains when the arguments are wrong', async () => {
    const { type, send, onSend, box } = setup();
    type('/poll "Lunch?" "Pizza"');
    await send();
    expect(screen.getByTestId('slash-error').textContent).toContain('Add at least two options');
    expect(onSend).not.toHaveBeenCalled();
    expect(box.value).toBe('/poll "Lunch?" "Pizza"');
  });

  it('asks before sending an unknown command as text', async () => {
    const { type, send, onSend } = setup();
    type('/xyz hello');
    await send();
    expect(screen.getByTestId('slash-unknown').textContent).toContain("/xyz isn't a command");
    expect(onSend).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByTestId('slash-send-as-text')));
    expect(onSend).toHaveBeenCalledWith('/xyz hello');
  });

  it('puts the command back with the reason when it fails', async () => {
    const { type, send, box } = setup({ setMuted: async () => { throw new Error('No connection'); } });
    type('/mute');
    await send();
    await waitFor(() => expect(screen.getByTestId('slash-error').textContent).toContain('No connection'));
    expect(box.value).toBe('/mute');
  });

  it('/help lists every command', async () => {
    const { type, send } = setup();
    type('/help');
    await send();
    expect(screen.getByTestId('slash-help').textContent).toContain('/remind [me|@person] <when> <what>');
  });

  it('plain messages and paths are sent as they are', async () => {
    const { type, send, onSend } = setup();
    type('/usr/local/bin is the path');
    await send();
    expect(onSend).toHaveBeenCalledWith('/usr/local/bin is the path');
  });
});

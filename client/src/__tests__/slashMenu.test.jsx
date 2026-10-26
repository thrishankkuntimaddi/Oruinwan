// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import SlashCommandMenu from '../components/chat/slash/SlashCommandMenu';
import SlashNotice from '../components/chat/slash/SlashNotice';
import { menuCommands, helpLines } from '../components/chat/slash/slashCommands';
import { fakeCtx } from '@platform/commands/commands.cases.js';

afterEach(cleanup);

describe('web slash menu', () => {
    const items = menuCommands('/', fakeCtx().ctx, {});

    it('shows each command with its arguments and help text', () => {
        render(<SlashCommandMenu items={items} onPick={() => {}} />);
        const task = screen.getByTestId('slash-item-task');
        expect(task.textContent).toContain('/task');
        expect(task.textContent).toContain('<title> [@person]');
        expect(task.textContent).toContain('Create a task linked to this conversation');
    });

    it('Enter runs a command that needs nothing more; Tab only fills it', () => {
        const onPick = vi.fn();
        render(<SlashCommandMenu items={menuCommands('/hud', fakeCtx().ctx, {})} onPick={onPick} />);
        const key = (k) => SlashCommandMenu.handleKey({ key: k, preventDefault() {} });
        key('Tab');
        expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'huddle' }), { run: false });
        key('Enter');
        expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'huddle' }), { run: true });
    });

    it('Enter on a command that needs words fills it in', () => {
        const onPick = vi.fn();
        render(<SlashCommandMenu items={menuCommands('/task', fakeCtx().ctx, {})} onPick={onPick} />);
        SlashCommandMenu.handleKey({ key: 'Enter', preventDefault() {} });
        expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'task' }), { run: false });
    });

    it('arrow keys move through the list', () => {
        const onPick = vi.fn();
        render(<SlashCommandMenu items={menuCommands('/', fakeCtx().ctx, {})} onPick={onPick} />);
        act(() => { SlashCommandMenu.handleKey({ key: 'ArrowDown', preventDefault() {} }); });
        expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    });

    it('says when nothing matches', () => {
        render(<SlashCommandMenu items={[]} query="/zzz" onPick={() => {}} />);
        expect(screen.getByTestId('slash-menu').textContent).toContain('No command called /zzz');
    });
});

describe('web slash notices', () => {
    it('asks before sending an unknown command as text', () => {
        const onSendAsText = vi.fn();
        render(<SlashNotice notice={{ kind: 'unknown', name: 'xyz' }} onSendAsText={onSendAsText} />);
        expect(screen.getByTestId('slash-unknown').textContent).toContain("/xyz isn't a command. Send as text?");
        fireEvent.mouseDown(screen.getByTestId('slash-send-as-text'));
        expect(onSendAsText).toHaveBeenCalled();
    });
    it('shows errors and the /help list', () => {
        const { rerender } = render(<SlashNotice notice={{ kind: 'error', message: 'Add at least two options.' }} />);
        expect(screen.getByTestId('slash-error').textContent).toContain('Add at least two options.');
        rerender(<SlashNotice notice={{ kind: 'help', lines: helpLines(fakeCtx({ where: 'dm' }).ctx) }} />);
        expect(screen.getByTestId('slash-help').textContent).toContain('/later <when> <message>');
        expect(screen.getByTestId('slash-help').textContent).toContain('not here');
    });
});

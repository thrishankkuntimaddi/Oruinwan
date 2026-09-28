// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const WS = 'a'.repeat(24);
const BOB = 'b'.repeat(24);

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'c'.repeat(24), username: 'alice' } }) }));
vi.mock('../contexts/WorkspaceContext', () => ({ useOptionalWorkspace: () => ({ activeWorkspace: { id: WS } }) }));
vi.mock('@services/api', () => ({ default: { get: vi.fn() } }));

import api from '@services/api';
import { MentionChip } from '../features/profileCard/ProfileTrigger';
import { clearCardCache, mentionKind } from '../features/profileCard/profileCardStore';
import { findComposerFor, COMPOSER_MENTION_EVENT } from '../features/profileCard/composerBridge';
import { localTimeIn } from '../features/profileCard/ProfileCardPopover';

const BOB_CARD = {
    id: BOB, username: 'bob', displayName: null, email: 'bob@x.io', profilePicture: null, about: 'Builds things',
    designation: 'Engineer', department: 'Platform', companyRole: null, workspaceRole: 'admin',
    timezone: 'Europe/Berlin', isOnline: true, userStatus: 'active', lastSeen: null,
};

function renderChip(mention, extra = null) {
    return render(
        <MemoryRouter>
            <div>
                <p><MentionChip mention={mention}>@{mention}</MentionChip></p>
                {extra}
            </div>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    clearCardCache();
    api.get.mockReset();
});

describe('profile card store helpers', () => {
    it('classifies special mentions', () => {
        expect(mentionKind('here')).toBe('broadcast');
        expect(mentionKind('Channel')).toBe('broadcast');
        expect(mentionKind('Oruinwan')).toBe('assistant');
        expect(mentionKind('ai')).toBe('assistant');
        expect(mentionKind('bob')).toBe('person');
    });

    it('formats local time and ignores bad zones', () => {
        expect(localTimeIn('Europe/Berlin', new Date('2026-01-01T12:00:00Z'))).toMatch(/1:00/);
        expect(localTimeIn('Not/AZone')).toBeNull();
        expect(localTimeIn(null)).toBeNull();
    });
});

describe('MentionChip', () => {
    it('is a button that opens the person card (name, email, role)', async () => {
        api.get.mockResolvedValue({ data: { card: BOB_CARD } });
        renderChip('bob');
        const chip = screen.getByRole('button', { name: /@bob/ });
        expect(chip.getAttribute('data-mention')).toBe('bob');
        fireEvent.click(chip);
        const dialog = await screen.findByRole('dialog');
        expect(await screen.findByTestId('profile-card-name')).toHaveProperty('textContent', 'bob');
        expect(screen.getByTestId('profile-card-email').textContent).toBe('bob@x.io');
        expect(dialog.textContent).toContain('Workspace admin');
        expect(dialog.textContent).toContain('Engineer');
        expect(api.get).toHaveBeenCalledWith('/api/users/card', { params: { workspaceId: WS, username: 'bob' } });
    });

    it('opens with the keyboard and closes on Escape', async () => {
        api.get.mockResolvedValue({ data: { card: BOB_CARD } });
        renderChip('bob');
        fireEvent.keyDown(screen.getByRole('button', { name: /@bob/ }), { key: 'Enter' });
        await screen.findByRole('dialog');
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('shows "User not found" for removed users', async () => {
        api.get.mockRejectedValue({ response: { status: 404, data: { message: 'User not found' } } });
        renderChip('ghost');
        fireEvent.click(screen.getByRole('button', { name: /@ghost/ }));
        expect(await screen.findByText('User not found')).toBeTruthy();
    });

    it('explains @here without fetching', async () => {
        renderChip('here');
        fireEvent.click(screen.getByRole('button', { name: /@here/ }));
        expect((await screen.findByRole('dialog')).textContent).toMatch(/online/);
        expect(api.get).not.toHaveBeenCalled();
    });

    it('"Mention" inserts into the composer', async () => {
        api.get.mockResolvedValue({ data: { card: BOB_CARD } });
        const got = vi.fn();
        renderChip('bob', <div data-composer-root="" ref={(el) => el?.addEventListener(COMPOSER_MENTION_EVENT, (e) => got(e.detail.username))} />);
        fireEvent.click(screen.getByRole('button', { name: /@bob/ }));
        const btn = await screen.findByRole('button', { name: /Mention/ });
        await act(async () => { fireEvent.click(btn); });
        expect(got).toHaveBeenCalledWith('bob');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
});

describe('composer routing', () => {
    it('sends thread mentions to the thread composer', () => {
        document.body.innerHTML = `
            <div id="chat"><div id="m1"><span id="a1"></span></div><div data-composer-root id="main"></div>
              <div data-testid="thread-panel"><span id="a2"></span><div data-composer-root id="thread"></div></div></div>`;
        expect(findComposerFor(document.getElementById('a1')).id).toBe('main');
        expect(findComposerFor(document.getElementById('a2')).id).toBe('thread');
        document.body.innerHTML = '';
    });
});

// @vitest-environment jsdom
// @mentions in the AI panel's composer: autocomplete, structured mentions, chips, transcripts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/messageService', () => ({ messageService: { getDMMessages: vi.fn() } }));
vi.mock('../services/messageEncryptionService', () => ({ batchDecryptMessages: vi.fn() }));
vi.mock('../features/profileCard/ProfileTrigger', () => ({
    ProfileTrigger: ({ userId, children }) => <span data-user={userId} role="button">{children}</span>,
}));

import { messageService } from '../services/messageService';
import { batchDecryptMessages } from '../services/messageEncryptionService';
import { insertMention, mentionQueryAt, mentionsInText, peopleFromHandles, suggestPeople, withTranscripts } from '../utils/aiMentions';
import { useAIMentions } from '../components/ai/OruinwanAIChat/useAIMentions';
import { AIMentionMenu, MentionText } from '../components/ai/OruinwanAIChat/AIMentionMenu';

const MEMBERS = [
    { _id: 'me1', username: 'thrishank' },
    { _id: 'u-muz', username: 'muzamil', profilePicture: null },
    { _id: 'u-maya', username: 'maya' },
    { _id: 'u-raj', username: 'raj.k' },
];

describe('aiMentions helpers', () => {
    it('finds the @query before the caret', () => {
        expect(mentionQueryAt('tell @mu')).toEqual({ query: 'mu', start: 5, end: 8 });
        expect(mentionQueryAt('email@x')).toBeNull();
        expect(mentionQueryAt('hi @mu there', 6)).toEqual({ query: 'mu', start: 3, end: 6 });
    });

    it('suggests members (not me), prefix matches first', () => {
        expect(suggestPeople(MEMBERS, 'm', { me: 'me1' }).map((p) => p.username)).toEqual(['muzamil', 'maya']);
        expect(suggestPeople(MEMBERS, '', { me: 'me1' })).toHaveLength(3);
        expect(suggestPeople(MEMBERS, 'zam').map((p) => p.id)).toEqual(['u-muz']);
    });

    it('inserts the handle and keeps the rest of the text', () => {
        expect(insertMention('tell @mu the news', { start: 5, end: 8 }, { username: 'muzamil' })).toEqual({ text: 'tell @muzamil the news', caret: 14 });
    });

    it('a deleted @name drops the person; handles are matched whole', () => {
        const chosen = [{ id: 'u-muz', username: 'muzamil' }, { id: 'u-maya', username: 'maya' }];
        expect(mentionsInText('ping @muzamil now', chosen).map((p) => p.id)).toEqual(['u-muz']);
        expect(mentionsInText('ping @muzamilx', chosen)).toEqual([]);
    });

    it('maps typed handles to members and skips assistants', () => {
        expect(peopleFromHandles('@ai tell @Muzamil and @raj.k.', MEMBERS)).toEqual([
            { id: 'u-muz', username: 'muzamil', name: 'muzamil' },
            { id: 'u-raj', username: 'raj.k', name: 'raj.k' },
        ]);
    });
});

describe('withTranscripts', () => {
    beforeEach(() => { messageService.getDMMessages.mockReset(); batchDecryptMessages.mockReset(); });

    it('adds our DM with the person, decrypted on this device', async () => {
        messageService.getDMMessages.mockResolvedValue({ data: { messages: [
            { _id: 'm1', sender: { _id: 'u-muz', username: 'muzamil' }, createdAt: '2026-10-01', payload: {} },
            { _id: 'm2', sender: { _id: 'me1' }, createdAt: '2026-10-02', payload: {} },
            { _id: 'm3', sender: { _id: 'u-muz' }, parentId: 'm1', payload: {} },
        ] } });
        batchDecryptMessages.mockImplementation(async (list) => list.map((m) => ({ ...m, isDecryptable: true, decryptedContent: `text ${m._id}` })));
        const out = await withTranscripts([{ id: 'u-muz', name: 'Muzamil', username: 'muzamil' }, { id: 'u-maya', name: 'Maya' }], {
            workspaceId: 'ws1', me: 'me1', dms: [{ id: 'dm-muz', userId: 'u-muz' }, { id: 'grp', isGroup: true, userId: 'u-maya' }],
        });
        expect(messageService.getDMMessages).toHaveBeenCalledWith('ws1', 'dm-muz', 100);
        // thread replies use a derived key: not included
        expect(batchDecryptMessages.mock.calls[0][0].map((m) => m._id)).toEqual(['m1', 'm2']);
        expect(out).toEqual([
            { id: 'u-muz', name: 'Muzamil', transcript: [
                { from: 'muzamil', isMe: false, text: 'text m1', at: '2026-10-01' },
                { from: 'You', isMe: true, text: 'text m2', at: '2026-10-02' },
            ] },
            { id: 'u-maya', name: 'Maya' },
        ]);
    });

    it('a DM that cannot be read sends the mention without a transcript', async () => {
        messageService.getDMMessages.mockRejectedValue(new Error('offline'));
        expect(await withTranscripts([{ id: 'u-muz', name: 'Muzamil' }], { workspaceId: 'ws1', dms: [{ id: 'd', userId: 'u-muz' }] }))
            .toEqual([{ id: 'u-muz', name: 'Muzamil' }]);
    });
});

function Composer({ onSend }) {
    const [value, setValue] = useState('');
    const textRef = useRef(null);
    const m = useAIMentions({ value, setValue, members: MEMBERS, me: 'me1', textRef });
    return (
        <div>
            <AIMentionMenu {...m.menu} />
            <div data-testid="active">{m.active.map((p) => p.username).join(',')}</div>
            <textarea aria-label="ask" ref={textRef} value={value} onChange={m.onChange} onSelect={m.onSelect}
                onKeyDown={(e) => { if (m.onKeyDown(e)) return; if (e.key === 'Enter') { e.preventDefault(); onSend(value, m.peopleFor(value)); setValue(''); m.reset(); } }} />
        </div>
    );
}

const type = (el, value) => fireEvent.change(el, { target: { value, selectionStart: value.length } });

describe('AI composer @mention behaviour', () => {
    it('offers people while typing @, completes with Enter and sends a structured mention', () => {
        const onSend = vi.fn();
        render(<Composer onSend={onSend} />);
        const box = screen.getByLabelText('ask');
        type(box, 'tell @mu');
        const options = screen.getAllByTestId('ai-mention-option');
        expect(options.map((o) => o.textContent)).toEqual(['Mmuzamil@muzamil']);
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(box.value).toBe('tell @muzamil ');
        expect(screen.queryByTestId('ai-mention-menu')).toBeNull();
        expect(screen.getByTestId('active').textContent).toBe('muzamil');
        type(box, 'tell @muzamil the build is green');
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('tell @muzamil the build is green', [
            { id: 'u-muz', username: 'muzamil', name: 'muzamil', profilePicture: null },
        ]);
    });

    it('clicking a suggestion picks it; arrows move; Escape closes', () => {
        render(<Composer onSend={vi.fn()} />);
        const box = screen.getByLabelText('ask');
        type(box, '@m');
        fireEvent.keyDown(box, { key: 'ArrowDown' });
        expect(screen.getAllByTestId('ai-mention-option')[1].getAttribute('aria-selected')).toBe('true');
        fireEvent.keyDown(box, { key: 'Escape' });
        expect(screen.queryByTestId('ai-mention-menu')).toBeNull();
        type(box, 'ask @ma');
        act(() => { fireEvent.click(screen.getByText('maya', { selector: 'span' })); });
        expect(box.value).toBe('ask @maya ');
    });

    it('a typed handle without picking still becomes a structured mention; strangers do not', () => {
        const onSend = vi.fn();
        render(<Composer onSend={onSend} />);
        const box = screen.getByLabelText('ask');
        type(box, 'message @raj.k and @nobody hi');
        fireEvent.keyDown(box, { key: 'Escape' });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(onSend.mock.calls[0][1]).toEqual([{ id: 'u-raj', username: 'raj.k', name: 'raj.k' }]);
    });
});

describe('MentionText', () => {
    it('shows mentioned people as chips linked to their profile', () => {
        render(<p><MentionText text="tell @muzamil hi, cc @maya" people={[{ id: 'u-muz', username: 'muzamil', name: 'Muzamil' }]} /></p>);
        const chip = screen.getByText('@muzamil');
        expect(chip.closest('[data-user]').getAttribute('data-user')).toBe('u-muz');
        expect(screen.queryByText('@maya')).toBeNull(); // not a structured mention: plain text
    });
});

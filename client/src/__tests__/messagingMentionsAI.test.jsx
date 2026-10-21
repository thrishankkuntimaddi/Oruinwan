// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../contexts/WorkspaceContext', () => ({
    useOptionalWorkspace: () => ({ activeWorkspace: { id: 'ws-1' } }),
}));

import api from '@services/api';
import { canUseBroadcastMentions } from '../utils/messageActionUtils';
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete';
import { useTranslation } from '../hooks/useTranslation';

describe('canUseBroadcastMentions', () => {
    it('never offers @channel/@here outside channels', () => {
        expect(canUseBroadcastMentions('dm', { broadcastMentions: 'everyone', canManage: true })).toBe(false);
    });
    it('offers them to everyone when the channel allows it', () => {
        expect(canUseBroadcastMentions('channel', { broadcastMentions: 'everyone', canManage: false })).toBe(true);
        expect(canUseBroadcastMentions('channel', {})).toBe(true);
    });
    it('limits them to channel admins when the policy says admins', () => {
        expect(canUseBroadcastMentions('channel', { broadcastMentions: 'admins', canManage: false })).toBe(false);
        expect(canUseBroadcastMentions('channel', { broadcastMentions: 'admins', canManage: true })).toBe(true);
    });
});

/** Puts the caret at the end of `text` inside a contenteditable, as the composer does. */
function typeInComposer(text) {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    const node = document.createTextNode(text);
    el.appendChild(node);
    document.body.appendChild(el);
    const range = document.createRange();
    range.setStart(node, text.length);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

describe('useMentionAutocomplete broadcast entries', () => {
    const members = [{ _id: 'u1', username: 'helen' }];

    it('suggests @here when broadcast mentions are allowed', () => {
        const { result } = renderHook(() => useMentionAutocomplete(members, { includeBroadcast: true }));
        typeInComposer('hi @he');
        act(() => result.current.handleMentionInput());
        const names = result.current.suggestions.map(s => s.username);
        expect(names).toContain('helen');
        expect(names).toContain('here');
    });

    it('hides @here/@channel when the channel limits them to admins', () => {
        const { result } = renderHook(() => useMentionAutocomplete(members, { includeBroadcast: false }));
        typeInComposer('hi @');
        act(() => result.current.handleMentionInput());
        const names = result.current.suggestions.map(s => s.username);
        expect(names).toContain('helen');
        expect(names).not.toContain('here');
        expect(names).not.toContain('channel');
    });
});

describe('useTranslation', () => {
    beforeEach(() => { api.post.mockReset(); });

    it('names the active workspace so its AI provider and AI switch apply', async () => {
        api.post.mockResolvedValue({ data: { translated: 'Hola', detectedLang: 'en' } });
        const { result } = renderHook(() => useTranslation());
        await act(() => result.current.requestTranslation('m-ws-1', 'Hello', 'es'));
        expect(api.post).toHaveBeenCalledWith('/api/v2/messages/ai/translate', {
            text: 'Hello', targetLang: 'es', messageId: 'm-ws-1', workspaceId: 'ws-1',
        });
        await waitFor(() => expect(result.current.getTranslation('m-ws-1')?.translatedText).toBe('Hola'));
    });
});

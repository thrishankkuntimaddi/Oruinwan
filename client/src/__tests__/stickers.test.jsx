// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@services/api', () => ({ default: apiMock, API_BASE: 'http://api' }));

import { canAddAsIs, stickerBox, wrapCaption, stickerFileProblem } from '@platform/media/stickerMaker.js';
import { groupByPack, saveFromAttachment, __resetStickersForTests } from '../features/stickers/stickerStore';
import StickerPicker from '../features/stickers/StickerPicker';
import ImageMessage from '../features/messaging/chatWindowComp/messages/types/ImageMessage';
import { ToastProvider } from '../contexts/ToastContext';

const sticker = (id, pack = 'My stickers') => ({
    id, pack, name: `${id}.webp`,
    attachment: { type: 'image', url: `/api/v2/uploads/file?path=stickers%2F${id}.webp`, name: `${id}.webp`, variant: 'sticker', width: 512, height: 512 },
});

beforeEach(() => {
    __resetStickersForTests();
    Object.values(apiMock).forEach((f) => f.mockReset());
    apiMock.get.mockImplementation((url) => {
        if (url === '/api/v2/uploads/sign') return Promise.resolve({ data: { url: '/signed', expiresAt: new Date(Date.now() + 600000).toISOString() } });
        return Promise.resolve({ data: { stickers: [], giphy: false } });
    });
});

describe('sticker maker helpers', () => {
    it('adds GIF, WebP and PNG as they are; photos go through the maker', () => {
        expect(canAddAsIs({ type: 'image/gif', size: 1000 })).toBe(true);
        expect(canAddAsIs({ type: 'image/webp', size: 1000 })).toBe(true);
        expect(canAddAsIs({ type: 'image/jpeg', size: 1000 })).toBe(false);
        expect(canAddAsIs({ type: 'image/gif', size: 6 * 1024 * 1024 })).toBe(false);
        expect(stickerFileProblem({ type: 'image/heic', size: 10 })).toMatch(/Pick a photo/);
        expect(stickerFileProblem({ type: 'image/jpeg', size: 10 })).toBeNull();
    });

    it('wraps a caption into at most two lines', () => {
        const ctx = { measureText: (t) => ({ width: t.length * 10 }) };
        expect(wrapCaption(ctx, 'hi there', 100)).toEqual(['hi there']);
        expect(wrapCaption(ctx, 'one two three four five six', 100)).toEqual(['one two', 'three four…']);
    });

    it('fits stickers in a box keeping their shape', () => {
        expect(stickerBox(512, 512)).toEqual({ width: 160, height: 160 });
        expect(stickerBox(400, 200)).toEqual({ width: 160, height: 80 });
        expect(stickerBox()).toEqual({ width: 160, height: 160 });
    });
});

describe('sticker library', () => {
    it('groups stickers by pack, newest pack first', () => {
        const packs = groupByPack([sticker('a', 'Cats'), sticker('b'), sticker('c', 'Cats')]);
        expect(packs.map((p) => [p.name, p.items.length])).toEqual([['Cats', 2], ['My stickers', 1]]);
    });

    it('saves a picture from a message by its URL', async () => {
        apiMock.post.mockResolvedValue({ data: { sticker: sticker('x'), existed: false } });
        const out = await saveFromAttachment({ url: '/api/v2/uploads/file?path=dms%2Fa.gif', width: 200, height: 100 });
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/stickers', { url: '/api/v2/uploads/file?path=dms%2Fa.gif', pack: undefined, width: 200, height: 100 });
        expect(out.existed).toBe(false);
    });

    it('shows an empty state, then sends a sticker from the library', async () => {
        const onSend = vi.fn();
        const onClose = vi.fn();
        const { unmount } = render(<ToastProvider><StickerPicker onSend={onSend} onClose={onClose} /></ToastProvider>);
        expect(await screen.findByText('No stickers yet')).toBeTruthy();
        expect(screen.queryByRole('tab', { name: 'GIFs' })).toBeNull(); // GIPHY isn't set up
        unmount();

        __resetStickersForTests();
        apiMock.get.mockImplementation((url) => {
            if (url === '/api/v2/uploads/sign') return Promise.resolve({ data: { url: '/signed', expiresAt: new Date(Date.now() + 600000).toISOString() } });
            return Promise.resolve({ data: { stickers: [sticker('a', 'Cats')], giphy: true } });
        });
        render(<ToastProvider><StickerPicker onSend={onSend} onClose={onClose} /></ToastProvider>);
        fireEvent.click(await screen.findByRole('button', { name: /Send sticker a.webp/ }));
        expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ variant: 'sticker' }));
        expect(onClose).toHaveBeenCalled();
        expect(screen.getByRole('tab', { name: 'GIFs' })).toBeTruthy();
    });
});

describe('sticker messages', () => {
    it('shows a sticker without the file name bar', async () => {
        render(<ImageMessage msg={{ attachment: sticker('s').attachment }} />);
        await waitFor(() => expect(screen.getByTestId('sticker-attachment')).toBeTruthy());
        expect(screen.queryByText('s.webp')).toBeNull();
    });

    it('shows a GIF with a badge instead of its file name', async () => {
        render(<ImageMessage msg={{ attachment: { type: 'image', url: '/api/v2/uploads/file?path=dms%2Fg.webp', name: 'funny.webp', variant: 'gif', width: 300, height: 200 } }} />);
        expect(await screen.findByText('GIF')).toBeTruthy();
        expect(screen.queryByText('funny.webp')).toBeNull();
    });
});

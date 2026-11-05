// Stickers on the phone: the same library and message shape as the web app.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const mockApi = { get: vi.fn(), post: vi.fn(), del: vi.fn(), patch: vi.fn() };
vi.mock('../../data/live/http.js', () => ({
  api: mockApi,
  request: vi.fn(),
  ApiError: class extends Error {},
  NETWORK_MESSAGE: 'offline',
  accessToken: () => 'tok',
  refreshSession: vi.fn(),
  serverUrl: () => 'https://api.example',
}));
vi.mock('../../native/index.js', async (orig) => ({ ...(await orig()), clientPlatform: 'android' }));
vi.mock('../media/media.js', () => ({
  useMediaUrl: (f) => ({ url: f?.url ? `https://signed${f.url}` : null, retry: () => {}, retried: false, error: null }),
  openFile: vi.fn(),
  openWithSystem: vi.fn(),
  downloadFile: vi.fn(),
}));

const { __resetStickersForTests, canSaveAsSticker, filesToImport, groupByPack, noteStickerUsed, recentStickers, saveFromAttachment } = await import('./stickers.js');
const { PackPicker } = await import('./StickerMaker.jsx');
const { alphaFromMask, keptBox, strokesFor } = await import('../../../../platform/media/cutout.js');
const { StickerSheet } = await import('./StickerSheet.jsx');
const { Attachments } = await import('../media/Attachments.jsx');
const { attachmentDoc } = await import('../../data/live/attachments.js');

const sticker = (id, pack = 'My stickers') => ({
  id,
  pack,
  name: `${id}.webp`,
  attachment: { type: 'image', url: `/api/v2/uploads/file?path=stickers%2F${id}.webp`, name: `${id}.webp`, mimeType: 'image/webp', variant: 'sticker', width: 512, height: 512 },
});

beforeEach(() => {
  __resetStickersForTests();
  Object.values(mockApi).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe('sticker library', () => {
  it('keeps the variant when sending, so the web shows it as a sticker too', () => {
    expect(attachmentDoc(sticker('a').attachment)).toMatchObject({ type: 'image', variant: 'sticker' });
    expect(attachmentDoc({ type: 'image', url: '/x', name: 'p.jpg', size: 1, mimeType: 'image/jpeg' })).not.toHaveProperty('variant');
  });

  it('groups by pack and knows which pictures can be saved', () => {
    expect(groupByPack([sticker('a', 'Cats'), sticker('b'), sticker('c', 'Cats')]).map((p) => p.name)).toEqual(['Cats', 'My stickers']);
    expect(canSaveAsSticker({ type: 'image', url: '/x', mimeType: 'image/gif' })).toBe(true);
    expect(canSaveAsSticker({ type: 'video', url: '/x', mimeType: 'video/mp4' })).toBe(false);
    expect(canSaveAsSticker({ type: 'image', url: '/x', mimeType: 'image/heic' })).toBe(false);
  });

  it('saves a picture from a message by its URL', async () => {
    mockApi.post.mockResolvedValue({ sticker: sticker('x'), existed: true });
    const out = await saveFromAttachment({ url: '/api/v2/uploads/file?path=dms%2Fa.gif', width: 10, height: 20 });
    expect(mockApi.post).toHaveBeenCalledWith('/v2/stickers', { url: '/api/v2/uploads/file?path=dms%2Fa.gif', pack: undefined, width: 10, height: 20 });
    expect(out.existed).toBe(true);
  });
});

describe('sticker sheet', () => {
  it('sends a sticker from my stickers and closes', async () => {
    mockApi.get.mockResolvedValue({ stickers: [sticker('a', 'Cats')], giphy: true });
    const onSend = vi.fn();
    const onClose = vi.fn();
    render(<StickerSheet open onClose={onClose} onSend={onSend} />);
    fireEvent.click(await screen.findByRole('button', { name: /Send sticker a.webp/ }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ variant: 'sticker' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'GIF' })).toBeTruthy();
  });

  it('shows the empty state and hides GIPHY when the server has no key', async () => {
    mockApi.get.mockResolvedValue({ stickers: [], giphy: false });
    render(<StickerSheet open onClose={() => {}} onSend={() => {}} />);
    expect(await screen.findByText('No stickers yet')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'GIFs' })).toBeNull();
  });
});

describe('sticker messages', () => {
  it('shows a sticker frameless and a GIF with its badge', () => {
    render(<Attachments files={[sticker('s').attachment]} />);
    expect(screen.getByTestId('sticker-attachment')).toBeTruthy();
    cleanup();
    render(<Attachments files={[{ type: 'image', url: '/api/v2/uploads/file?path=g.webp', name: 'g.webp', mimeType: 'image/webp', variant: 'gif', width: 300, height: 200 }]} />);
    expect(screen.getByText('GIF')).toBeTruthy();
  });
});

describe('sticker packs and import', () => {
  it('unpacks a WhatsApp .wastickers pack, named from title.txt, skipping the tray icon', async () => {
    const { zipSync } = await import('fflate');
    const text = (t) => Uint8Array.from(t, (c) => c.charCodeAt(0));
    const zip = zipSync({ 'title.txt': text('Office memes'), 'tray.png': new Uint8Array([1]), '1.webp': new Uint8Array([2]), '2.webp': new Uint8Array([3]) });
    const items = await filesToImport([new File([zip], 'office.wastickers'), new File([new Uint8Array([4])], 'cat.png', { type: 'image/png' })]);
    expect(items.map((i) => [i.file.name, i.pack])).toEqual([
      ['1.webp', 'Office memes'],
      ['2.webp', 'Office memes'],
      ['cat.png', null],
    ]);
    expect(items[0].file.type).toBe('image/webp');
  });

  it('remembers recently sent stickers, newest first', () => {
    localStorage.clear();
    const list = [sticker('a'), sticker('b'), sticker('c')];
    noteStickerUsed('b');
    noteStickerUsed('c');
    noteStickerUsed('b');
    expect(recentStickers(list).map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('lets you type a new pack name', async () => {
    mockApi.get.mockResolvedValue({ stickers: [sticker('a', 'Cats')], giphy: false });
    const onChange = vi.fn();
    render(<PackPicker value="My stickers" onChange={onChange} />);
    expect(await screen.findByRole('button', { name: 'Cats' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /New pack/ }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('cut-out masks', () => {
  it('keeps what was tapped, whichever way the model answers', () => {
    // 2x2: the tapped top-left pixel is 0 in the raw mask, so the mask is flipped.
    const m = alphaFromMask({ width: 2, height: 2, data: [0, 1, 1, 1] }, [{ x: 0.1, y: 0.1, mode: 'add' }]);
    expect(Array.from(m.alpha)).toEqual([255, 0, 0, 0]);
    expect(keptBox(m)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('turns taps into keep / remove strokes', () => {
    expect(strokesFor([{ x: 2, y: 0.5, mode: 'remove' }])).toEqual([{ brushMode: 2, point: [{ x: 1, y: 0.5 }], isCompleted: true }]);
  });
});

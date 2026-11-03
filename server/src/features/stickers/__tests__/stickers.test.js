const giphy = require('../giphy');
const { isAnimatedImage, cleanPack, attachmentOf } = require('../stickers.service');

const ENV = { GIPHY_API_KEY: 'k' };

function item(id, images) {
    return { id, title: `t-${id}`, images };
}

describe('GIPHY results', () => {
    test('is off without a key', () => {
        expect(giphy.enabled({})).toBe(false);
        expect(giphy.enabled({ GIPHY_API_KEY: '  ' })).toBe(false);
        expect(giphy.enabled(ENV)).toBe(true);
    });

    test('only GIPHY media hosts are trusted', () => {
        expect(giphy.isGiphyMediaUrl('https://media2.giphy.com/media/x/200.webp')).toBe(true);
        expect(giphy.isGiphyMediaUrl('https://i.giphy.com/x.gif')).toBe(true);
        expect(giphy.isGiphyMediaUrl('http://media.giphy.com/x.gif')).toBe(false);
        expect(giphy.isGiphyMediaUrl('https://giphy.com.evil.example/x.gif')).toBe(false);
        expect(giphy.isGiphyMediaUrl('https://169.254.169.254/latest')).toBe(false);
    });

    test('maps a result to a small preview and the full size', () => {
        const r = giphy.mapResult(item('abc', {
            fixed_width_small: { url: 'https://media.giphy.com/s.gif', webp: 'https://media.giphy.com/s.webp', width: '100', height: '80' },
            original: { width: '480', height: '384' },
        }), 'stickers');
        expect(r).toEqual({
            id: 'abc', kind: 'stickers', title: 't-abc',
            preview: { url: 'https://media.giphy.com/s.webp', width: 100, height: 80 },
            width: 480, height: 384,
        });
        expect(giphy.mapResult(item('x', { original: { url: 'https://evil.example/a.gif' } }), 'gifs')).toBeNull();
    });

    test('picks a WebP under the size limit, skipping big renditions', () => {
        const big = String(giphy.MAX_SEND_BYTES + 1);
        const r = giphy.pickRendition({
            downsized_medium: { url: 'https://media.giphy.com/dm.gif', size: big, webp: 'https://media.giphy.com/dm.webp', webp_size: big },
            original: { url: 'https://media.giphy.com/o.gif', size: '900000', webp: 'https://media.giphy.com/o.webp', webp_size: '400000', width: '480', height: '270' },
        }, 'gifs');
        expect(r).toEqual({ url: 'https://media.giphy.com/o.webp', mimeType: 'image/webp', width: 480, height: 270 });
        expect(giphy.pickRendition({}, 'gifs')).toBeNull();
    });

    test('search calls trending without a query and returns the next page offset', async () => {
        const calls = [];
        const fetchImpl = async (url) => {
            calls.push(url);
            return {
                ok: true,
                json: async () => ({
                    data: [item('a', { fixed_width: { url: 'https://media.giphy.com/a.gif', width: '200', height: '150' } })],
                    pagination: { total_count: 100, count: 24, offset: 0 },
                }),
            };
        };
        const out = await giphy.search({ kind: 'stickers' }, { env: ENV, fetchImpl });
        expect(calls[0]).toContain('/v1/stickers/trending?');
        expect(calls[0]).toContain('rating=pg-13');
        expect(out.results).toHaveLength(1);
        expect(out.next).toBe(24);

        await giphy.search({ q: 'cats', kind: 'nope' }, { env: ENV, fetchImpl });
        expect(calls[1]).toContain('/v1/gifs/search?');
        expect(calls[1]).toContain('q=cats');
    });

    test('download refuses odd ids before calling GIPHY', async () => {
        const fetchImpl = jest.fn();
        await expect(giphy.download('../x', 'gifs', { env: ENV, fetchImpl })).rejects.toMatchObject({ status: 400 });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('sticker library helpers', () => {
    test('pack names are trimmed and default to My stickers', () => {
        expect(cleanPack('  Cats   and  dogs ')).toBe('Cats and dogs');
        expect(cleanPack('')).toBe('My stickers');
        expect(cleanPack(null)).toBe('My stickers');
        expect(cleanPack('x'.repeat(60))).toHaveLength(40);
    });

    test('detects animated GIF, WebP and PNG', () => {
        const gce = Buffer.from([0x21, 0xf9, 0x04, 0, 0, 0, 0, 0]);
        const head = Buffer.from('GIF89a----------');
        expect(isAnimatedImage(Buffer.concat([head, gce, gce]), 'image/gif')).toBe(true);
        expect(isAnimatedImage(Buffer.concat([head, gce]), 'image/gif')).toBe(false);
        expect(isAnimatedImage(Buffer.from('RIFF....WEBPVP8XANIM....'), 'image/webp')).toBe(true);
        expect(isAnimatedImage(Buffer.from('RIFF....WEBPVP8 ........'), 'image/webp')).toBe(false);
        expect(isAnimatedImage(Buffer.from('.PNG....IHDR....acTL'), 'image/png')).toBe(true);
        expect(isAnimatedImage(Buffer.from('JFIF............'), 'image/jpeg')).toBe(false);
    });

    test('a sticker is sent as an image with the sticker variant', () => {
        expect(attachmentOf({ url: '/api/v2/uploads/file?path=stickers/a.webp', name: 'a.webp', mimeType: 'image/webp', size: 10, width: 512, height: 512 }))
            .toEqual({ type: 'image', url: '/api/v2/uploads/file?path=stickers/a.webp', name: 'a.webp', size: 10, mimeType: 'image/webp', width: 512, height: 512, variant: 'sticker' });
    });
});

const aiImage = require('../aiImage');
const counters = require('../../../shared/plans/planCounters');

const ENV = { GEMINI_API_KEY: 'k' };
const photo = { buffer: Buffer.from('jpegbytes'), mimeType: 'image/jpeg' };

describe('AI pictures', () => {
    beforeEach(() => counters._resetMemory?.());

    test('off without a Gemini key', async () => {
        expect(aiImage.enabled({})).toBe(false);
        await expect(aiImage.makePicture({ ...photo, style: 'cat' }, { env: {} })).rejects.toMatchObject({ status: 503, code: 'AI_IMAGES_OFF' });
    });

    test('a look becomes an editing instruction; unknown looks are refused', () => {
        expect(aiImage.promptFor('cat')).toMatch(/cartoon cat/);
        expect(aiImage.promptFor('custom', '  a   robot  ')).toMatch(/into a robot,/);
        expect(aiImage.promptFor('dragon')).toBeNull();
        expect(aiImage.promptFor('custom', '')).toBeNull();
    });

    test('sends the photo and returns the picture Gemini made', async () => {
        const http = { request: jest.fn(async () => ({ data: { candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'UE5H' } }] } }] } })) };
        const out = await aiImage.makePicture({ ...photo, style: 'panda' }, { env: ENV, http });
        expect(out).toEqual({ mimeType: 'image/png', data: 'UE5H' });
        const req = http.request.mock.calls[0][0];
        expect(req.url).toContain('gemini-3.1-flash-image:generateContent');
        expect(req.headers['x-goog-api-key']).toBe('k');
        expect(req.data.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: Buffer.from('jpegbytes').toString('base64') });
        expect(req.data.generationConfig.responseModalities).toEqual(['IMAGE']);
    });

    test('no picture back (safety) is a clear 422; bad files are 400', async () => {
        const http = { request: async () => ({ data: { candidates: [{ content: { parts: [{ text: 'no' }] } }] } }) };
        await expect(aiImage.makePicture({ ...photo, style: 'cat' }, { env: ENV, http })).rejects.toMatchObject({ status: 422 });
        await expect(aiImage.makePicture({ buffer: Buffer.from('x'), mimeType: 'image/gif', style: 'cat' }, { env: ENV, http })).rejects.toMatchObject({ status: 400 });
    });

    test('quota and busy answers are short and friendly', async () => {
        const fail = (status, error) => ({ request: async () => { throw Object.assign(new Error('x'), { response: { status, data: { error } } }); } });
        await expect(aiImage.makePicture({ ...photo, style: 'cat' }, { env: ENV, http: fail(429, { status: 'RESOURCE_EXHAUSTED', message: 'quota...' }) }))
            .rejects.toMatchObject({ status: 503, code: 'AI_IMAGES_BUSY', message: "AI pictures aren't available right now. Try again later." });
        await expect(aiImage.makePicture({ ...photo, style: 'cat' }, { env: ENV, http: fail(500, { message: 'boom' }) })).rejects.toMatchObject({ status: 502 });
    });

    test('daily caps: 3 on Free, 20 on Pro, none on Enterprise', async () => {
        expect(aiImage.dailyLimit('free', {})).toBe(3);
        expect(aiImage.dailyLimit('pro', {})).toBe(20);
        expect(aiImage.dailyLimit('enterprise', {})).toBeNull();
        for (let i = 0; i < 3; i++) await aiImage.takeOne('u-cap', 'free');
        await expect(aiImage.takeOne('u-cap', 'free')).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
    });
});

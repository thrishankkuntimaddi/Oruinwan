import { describe, expect, it } from 'vitest';
import { isAnimated, packIdentifier } from '../../../platform/media/whatsappPack.js';
import { canExportStickers } from './stickerExport.js';

describe('WhatsApp sticker packs', () => {
  it('makes a stable, WhatsApp-safe pack id from the name', () => {
    const id = packIdentifier('Office memes 😂');
    expect(id).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(id).toBe(packIdentifier('Office memes 😂'));
    expect(id).not.toBe(packIdentifier('Office memes'));
  });

  it('tells animations apart from still pictures', async () => {
    expect(await isAnimated(new Blob(['GIF89a'], { type: 'image/gif' }))).toBe(true);
    const still = new Blob(['RIFF\0\0\0\0WEBPVP8 '], { type: 'image/webp' });
    expect(await isAnimated(still)).toBe(false);
    const anim = new Blob(['RIFF\0\0\0\0WEBPVP8X\0\0\0\0\0\0\0\0\0\0\0\0ANIM'], { type: 'image/webp' });
    expect(await isAnimated(anim)).toBe(true);
  });

  it('is off outside the Android app', () => {
    expect(canExportStickers()).toBe(false);
  });
});

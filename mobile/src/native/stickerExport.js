// Stickers out of Oruinwan on Android (android/.../StickerExportPlugin.java): add a pack to
// WhatsApp, or share one sticker to any app. Apps installed before this existed don't have the
// plugin; the sticker sheet then offers Save / Copy and suggests getting the latest app.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAndroid, isNative } from './index.js';
import {
  WA_MAX, WA_MIN, base64Of, isAnimated, packIdentifier, waSticker, waTray,
} from '../../../platform/media/whatsappPack.js';
import { loadImage } from '../../../platform/media/stickerMaker.js';

const StickerExport = registerPlugin('StickerExport');

export const canExportStickers = () => isNative && isAndroid && Capacitor.isPluginAvailable('StickerExport');
/** Android, but an app from before this feature (a full update brings it). */
export const exportNeedsUpdate = () => isNative && isAndroid && !Capacitor.isPluginAvailable('StickerExport');

export async function whatsAppApps() {
  if (!canExportStickers()) return { installed: false, business: false };
  try {
    return await StickerExport.whatsApp();
  } catch {
    return { installed: false, business: false };
  }
}

/**
 * Adds a pack to WhatsApp. `attachments` are the stickers' pictures; `urlOf(attachment)` gives a
 * readable address for each (a signed link).
 * Animated stickers are left out (WhatsApp packs are all still or all animated).
 * Resolves { added, skipped } or throws with a message to show.
 */
export async function addPackToWhatsApp({ name, attachments, urlOf, onProgress }) {
  const stills = [];
  let skipped = 0;
  const list = attachments.slice(0, WA_MAX * 2);
  for (const [i, a] of list.entries()) {
    onProgress?.(i, list.length);
    try {
      const blob = await (await fetch(await urlOf(a))).blob();
      if (await isAnimated(blob)) {
        skipped += 1;
        continue;
      }
      stills.push(await waSticker(await loadImage(blob)));
      if (stills.length === WA_MAX) break;
    } catch {
      skipped += 1;
    }
  }
  if (stills.length < WA_MIN) {
    throw new Error(`WhatsApp needs at least ${WA_MIN} still stickers in a pack${skipped ? ` (${skipped} animated or unreadable ones can't be used)` : ''}. Add a few more to this pack.`);
  }
  const tray = await waTray(await loadImage(stills[0]));
  const stickers = [];
  for (const b of stills) stickers.push({ data: await base64Of(b), emoji: '😀', label: `${name} sticker` });
  const res = await StickerExport.addToWhatsApp({
    identifier: packIdentifier(name),
    name: `${name} · Oruinwan`,
    publisher: 'Oruinwan',
    tray: await base64Of(tray),
    stickers,
  });
  return { added: Boolean(res?.added), skipped };
}

/** Share one sticker picture to any app (the Android share sheet). */
export async function shareStickerPicture(url, name = 'sticker') {
  const blob = await (await fetch(url)).blob();
  const ext = /gif/.test(blob.type) ? 'gif' : /png/.test(blob.type) ? 'png' : 'webp';
  await StickerExport.share({ data: await base64Of(blob), mimeType: blob.type || 'image/webp', name: `${String(name).replace(/\.[a-z0-9]+$/i, '')}.${ext}` });
}

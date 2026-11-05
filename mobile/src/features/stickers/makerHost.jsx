// The sticker maker opened from anywhere (press and hold a photo → Make a sticker), mounted once
// at the app root. The conversation on screen registers how to send into it, so the made sticker
// can go straight there ("Send as sticker").
import { useEffect } from 'react';
import { create } from 'zustand';
import { toast } from '../../lib/bus.js';
import { StickerMakerSheet } from './StickerMaker.jsx';

export const useStickerMakerHost = create(() => ({ file: null, send: null }));

/** Open the maker with a picture (a File). */
export function openStickerMaker(file) {
  useStickerMakerHost.setState({ file });
}

/** The composer on screen: how a made sticker is sent into this conversation (while it is shown). */
export function useRegisterStickerSend(send) {
  useEffect(() => {
    if (!send) return undefined;
    useStickerMakerHost.setState({ send });
    return () => {
      if (useStickerMakerHost.getState().send === send) useStickerMakerHost.setState({ send: null });
    };
  }, [send]);
}

/** A picture in a message → a File the maker can read. */
export async function fileFromAttachment(attachment, urlOf) {
  const blob = await (await fetch(await urlOf(attachment))).blob();
  return new File([blob], attachment.name || 'photo.jpg', { type: blob.type || attachment.mimeType || 'image/jpeg' });
}

export function StickerMakerHost() {
  const file = useStickerMakerHost((s) => s.file);
  const send = useStickerMakerHost((s) => s.send);
  if (!file) return null;
  return (
    <StickerMakerSheet
      file={file}
      canSend={Boolean(send)}
      onCancel={() => useStickerMakerHost.setState({ file: null })}
      onDone={(sticker, { send: andSend }) => {
        useStickerMakerHost.setState({ file: null });
        if (andSend && send) send(sticker.attachment);
        else toast('Added to your stickers');
      }}
    />
  );
}

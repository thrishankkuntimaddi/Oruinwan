// Opening files: the full-screen viewer (photos, videos, audio, PDFs) and, for everything else,
// a sheet to open the file with another app or download it. Used by conversations and Files.
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { api } from '../../data/session.js';
import { previewKind } from '../../lib/files.js';
import { toast } from '../../lib/bus.js';
import { isNative, openExternal } from '../../native/index.js';

/** Signed URL for an attachment ({ url, error, retry }). Local files (uploading) use their blob URL. */
export function useMediaUrl(file) {
  const local = file?.localUrl || null;
  const source = local ? null : file?.gcsPath || file?.url || null;
  const [state, setState] = useState({ url: local, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (local) {
      setState({ url: local, error: null });
      return undefined;
    }
    if (!source) {
      setState({ url: null, error: null });
      return undefined;
    }
    let cancelled = false;
    Promise.resolve(api().mediaUrl?.(file, { fresh: attempt > 0 }))
      .then((url) => !cancelled && setState({ url: url || null, error: url ? null : new Error('No file') }))
      .catch((error) => !cancelled && setState({ url: null, error }));
    return () => {
      cancelled = true;
    };
  }, [source, local, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Signed links expire after a few minutes: a media element that fails asks for a new one, once.
  const retry = useCallback(() => setAttempt((n) => (n < 1 ? n + 1 : n)), []);
  return { ...state, retry, retried: attempt > 0 };
}

export const useViewer = create((set) => ({
  media: null, // { items: [file], index }
  actions: null, // file shown in the "open / download" sheet
  openMedia: (items, index = 0) => set({ media: { items, index } }),
  closeMedia: () => set({ media: null }),
  openActions: (file) => set({ actions: file }),
  closeActions: () => set({ actions: null }),
}));

/**
 * PDFs show inside the app in a browser or the desktop app. On phones they open in the system's
 * viewer (iOS shows it over the app; Android hands it to its PDF app), because Android's WebView
 * can't draw PDFs and the app can't read file bytes across origins there.
 */
export const pdfInApp = !isNative;

/**
 * Opens a file the best way this device can: photos, videos and audio in the viewer, PDFs in
 * the viewer (or the phone's PDF app on Android), anything else in the open / download sheet.
 * `siblings`: other photos and videos to swipe through.
 */
export function openFile(file, siblings) {
  if (!file) return;
  if (!file.url && !file.gcsPath && !file.localUrl) {
    toast("This file isn't available to open.");
    return;
  }
  const kind = previewKind(file);
  if (kind === 'image' || kind === 'video' || kind === 'audio' || (kind === 'pdf' && pdfInApp)) {
    const list = siblings?.length ? siblings : [file];
    useViewer.getState().openMedia(list, Math.max(0, list.indexOf(file)));
    return;
  }
  useViewer.getState().openActions(file);
}

/** Hands the file to the phone: its viewer opens it, and from there it can be saved or shared. */
export async function openWithSystem(file) {
  try {
    const url = await api().mediaUrl(file, { fresh: true });
    if (!url) throw new Error('No file');
    await openExternal(url);
  } catch (err) {
    toast(err?.message && err.message !== 'No file' ? err.message : "Couldn't open that file.", 'danger');
  }
}

async function fileBlob(file) {
  const url = file.localUrl || (await api().mediaUrl(file, { fresh: true }));
  if (!url) throw new Error('No file');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The download failed (${res.status}).`);
  return res.blob();
}

/**
 * Saves the file with its real name. In the browser and desktop app that is a normal download;
 * on a phone the system's viewer opens it (with its own Save and Share).
 */
export async function downloadFile(file) {
  if (isNative) return openWithSystem(file);
  try {
    const blob = await fileBlob(file);
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = file.name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    toast(`Downloading ${file.name || 'file'}`);
  } catch (err) {
    toast(err?.message || "Couldn't download that file.", 'danger');
  }
  return undefined;
}

/** Whether files can go to the system share sheet from here (browsers that support it; on phones the system viewer shares). */
export function canShareFiles() {
  if (isNative) return false;
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
}

export async function shareFile(file) {
  try {
    const blob = await fileBlob(file);
    const shared = new File([blob], file.name || 'file', { type: blob.type || file.mimeType || 'application/octet-stream' });
    await navigator.share({ files: [shared], title: file.name });
  } catch (err) {
    if (/abort|cancel/i.test(String(err?.name || err?.message))) return;
    toast("Couldn't share that file.", 'danger');
  }
}

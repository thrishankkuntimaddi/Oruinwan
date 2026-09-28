import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadFile, describeUploadError, readImageSize, validateUpload } from '../../../../utils/uploadFile';

let seq = 0;

/**
 * Files being uploaded from the composer (picked, pasted or dropped). Each file is
 * uploaded on its own with progress; when it finishes it is sent as its own message
 * through onUploaded(attachment). Failed uploads stay in the list with Retry; ones
 * that failed while offline retry by themselves when the connection is back.
 */
export default function useUploadQueue({ conversationId, conversationType, onUploaded }) {
    const [items, setItems] = useState([]);
    const controllers = useRef(new Map()); // id -> AbortController
    const files = useRef(new Map()); // id -> { file, extra }
    // Uploads run in parallel but are sent in the order they were added.
    const lastTurn = useRef(Promise.resolve());
    const onUploadedRef = useRef(onUploaded);
    onUploadedRef.current = onUploaded;
    const convRef = useRef({ conversationId, conversationType });
    convRef.current = { conversationId, conversationType };

    const patch = useCallback((id, p) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it))), []);
    const remove = useCallback((id) => {
        setItems((list) => list.filter((it) => it.id !== id));
        files.current.delete(id);
        controllers.current.delete(id);
    }, []);

    const run = useCallback(async (id) => {
        const entry = files.current.get(id);
        if (!entry) return;
        const { file, extra } = entry;
        const ctrl = new AbortController();
        controllers.current.set(id, ctrl);
        patch(id, { status: 'uploading', progress: 0, error: null });
        const previous = lastTurn.current;
        let releaseTurn;
        lastTurn.current = new Promise((r) => { releaseTurn = r; });
        try {
            const [size, attachment] = await Promise.all([
                readImageSize(file),
                uploadFile(file, {
                    ...convRef.current,
                    signal: ctrl.signal,
                    filename: extra?.filename,
                    onProgress: (progress) => patch(id, { progress }),
                }),
            ]);
            if (ctrl.signal.aborted) return;
            patch(id, { status: 'sending', progress: 100 });
            await previous;
            if (ctrl.signal.aborted) return;
            await onUploadedRef.current?.({ ...attachment, ...(size || {}), ...(extra?.attachment || {}) });
            remove(id);
        } catch (err) {
            if (ctrl.signal.aborted) return; // cancelled: already removed
            patch(id, {
                status: 'error',
                error: err.userMessage || describeUploadError(err),
                offline: typeof navigator !== 'undefined' && navigator.onLine === false,
                canRetry: !err.noRetry,
            });
        } finally {
            releaseTurn();
            if (controllers.current.get(id) === ctrl) controllers.current.delete(id);
        }
    }, [patch, remove]);

    /** Queue files. extra: { filename, attachment: fields merged into the sent attachment }. */
    const add = useCallback((fileList, extra) => {
        const list = Array.from(fileList || []).filter(Boolean);
        for (const file of list) {
            const id = `up-${Date.now()}-${++seq}`;
            const name = extra?.filename || file.name || 'file';
            const problem = validateUpload(file);
            files.current.set(id, { file, extra });
            setItems((l) => [...l, {
                id, name, size: file.size, type: file.type,
                status: problem ? 'error' : 'queued', progress: 0, error: problem, canRetry: !problem,
            }]);
            if (!problem) run(id);
        }
        return list.length;
    }, [run]);

    const cancel = useCallback((id) => {
        controllers.current.get(id)?.abort();
        remove(id);
    }, [remove]);

    const retry = useCallback((id) => { run(id); }, [run]);

    // Back online: retry uploads that failed because the connection dropped.
    const itemsRef = useRef(items);
    itemsRef.current = items;
    useEffect(() => {
        const onOnline = () => itemsRef.current.filter((it) => it.status === 'error' && it.offline).forEach((it) => run(it.id));
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [run]);

    // Leaving the conversation cancels uploads that haven't finished.
    useEffect(() => {
        const ctrls = controllers.current;
        const pending = files.current;
        return () => {
            ctrls.forEach((c) => c.abort());
            ctrls.clear();
            pending.clear();
            setItems([]);
        };
    }, [conversationId]);

    return { items, add, cancel, retry, dismiss: remove };
}

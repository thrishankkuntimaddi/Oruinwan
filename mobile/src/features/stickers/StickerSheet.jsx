// The composer's sticker sheet: my stickers (by pack), GIPHY GIFs and GIPHY stickers, plus
// making a sticker from a photo. Same library and server as the web app
// (client/src/features/stickers/StickerPicker.jsx).
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Copy, Download, FolderInput, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Share2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { ActionSheet, Dialog, Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { Field, SearchField, Segmented } from '../../ui/Controls.jsx';
import { cx } from '../../ui/cx.js';
import { toast } from '../../lib/bus.js';
import { isNative } from '../../native/index.js';
import { api } from '../../data/session.js';
import { addPackToWhatsApp, canExportStickers, exportNeedsUpdate, shareStickerPicture } from '../../native/stickerExport.js';
import { downloadFile, openWithSystem, useMediaUrl } from '../media/media.js';
import {
  copyStickerImage, filesToImport, fromGiphy, groupByPack, importStickers, moveSticker, noteStickerUsed, recentStickers, removePack, removeSticker,
  renamePack, searchGiphy, useStickers,
} from './stickers.js';
import { PackPicker, StickerMakerSheet } from './StickerMaker.jsx';
import { AiPictureSheet } from './AiPictureSheet.jsx';
import { EMOJI_CATEGORIES, noteEmojiUsed, recentEmojis } from './emojiData.js';

export { StickerMakerSheet };

function LibraryTile({ sticker, onPick, onMenu, onRemove, editing }) {
  const { url, retry, retried } = useMediaUrl(sticker.attachment);
  const hold = useRef(null);
  const held = useRef(false);
  const startHold = () => {
    held.current = false;
    clearTimeout(hold.current);
    hold.current = setTimeout(() => {
      held.current = true;
      onMenu?.(sticker, url);
    }, 450);
  };
  const stopHold = () => clearTimeout(hold.current);
  return (
    <div className="relative aspect-square">
      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu?.(sticker, url);
        }}
        onClick={() => {
          if (held.current) return;
          if (editing) onRemove(sticker);
          else onPick(sticker);
        }}
        aria-label={editing ? `Remove sticker ${sticker.name || ''}` : `Send sticker ${sticker.name || ''}`}
        className="pressable grid h-full w-full place-items-center rounded-xl p-1 active:bg-surface-2"
      >
        {url ? (
          <img src={url} alt="" draggable={false} loading="lazy" onError={() => !retried && retry()} className="pointer-events-none max-h-full max-w-full object-contain" />
        ) : (
          <span className="skeleton h-4/5 w-4/5 rounded-xl" aria-hidden />
        )}
      </button>
      {editing && (
        <span className="pointer-events-none absolute top-0 right-0 grid h-5 w-5 place-items-center rounded-full bg-danger text-white" aria-hidden>
          <Icon as={X} size={12} />
        </span>
      )}
    </div>
  );
}

/** Press and hold a sticker: send, copy, save to the phone, move to a pack, remove. */
function StickerMenu({ item, onClose, onSend }) {
  const [moving, setMoving] = useState(null); // the sticker being moved (the menu closes first)
  const [pack, setPack] = useState('');
  const s = item?.sticker;
  if (moving) {
    return (
      <Sheet open onClose={() => setMoving(null)} title="Move to pack">
        <div className="px-4 pb-4">
          <PackPicker value={pack || moving.pack} onChange={setPack} />
          <Button
            block
            className="mt-4"
            disabled={!(pack || '').trim() || pack === moving.pack}
            onClick={async () => {
              try {
                await moveSticker(moving.id, pack.trim());
                toast(`Moved to ${pack.trim()}`);
              } catch (err) {
                toast(err?.message || "Couldn't move the sticker", 'danger');
              }
              setMoving(null);
              setPack('');
            }}
          >
            Move
          </Button>
        </div>
      </Sheet>
    );
  }
  return (
    <ActionSheet
      open={Boolean(item)}
      onClose={onClose}
      title="Sticker"
      actions={
        s
          ? [
              { icon: Send, label: 'Send', onSelect: () => onSend(s) },
              {
                icon: Copy,
                label: 'Copy',
                hint: 'Paste it in another app',
                onSelect: async () => toast((await copyStickerImage(item.url)) ? 'Sticker copied' : "This device can't copy pictures. Use Save instead.", 'neutral'),
              },
              canExportStickers() && {
                icon: Share2,
                label: 'Share…',
                hint: 'Send it to WhatsApp, Instagram, Facebook or any app',
                onSelect: () => shareStickerPicture(item.url, s.name).catch((err) => toast(err?.message || "Couldn't share the sticker", 'danger')),
              },
              { icon: Download, label: isNative ? 'Save / open' : 'Save image', onSelect: () => (isNative ? openWithSystem(s.attachment) : downloadFile(s.attachment)) },
              { icon: FolderInput, label: 'Move to pack', onSelect: () => setMoving(s) },
              { icon: Trash2, label: 'Remove', danger: true, onSelect: () => removeSticker(s.id).catch((err) => toast(err?.message || "Couldn't remove it", 'danger')) },
            ]
          : []
      }
    />
  );
}

function MyStickers({ onSend, onCreate }) {
  const { status, stickers, error } = useStickers();
  const packs = useMemo(() => groupByPack(stickers), [stickers]);
  const recent = recentStickers(stickers);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);
  const [packMenu, setPackMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [exporting, setExporting] = useState(null); // pack name being added to WhatsApp
  const toWhatsApp = async (name) => {
    if (exportNeedsUpdate()) {
      toast('Get the latest Oruinwan app (Settings → Updates → full download) to add stickers to WhatsApp.');
      return;
    }
    const pack = packs.find((p) => p.name === name);
    if (!pack) return;
    setExporting(name);
    try {
      const { added, skipped } = await addPackToWhatsApp({ name, attachments: pack.items.map((x) => x.attachment), urlOf: (a) => api().mediaUrl(a) });
      if (added) toast(skipped ? `Added to WhatsApp (${skipped} animated sticker${skipped === 1 ? '' : 's'} left out)` : 'Added to WhatsApp', 'success');
    } catch (err) {
      toast(err?.message || "Couldn't add the pack to WhatsApp", 'danger');
    } finally {
      setExporting(null);
    }
  };
  const remove = async (s) => {
    try {
      await removeSticker(s.id);
    } catch (err) {
      toast(err?.message || "The sticker couldn't be removed.", 'danger');
    }
  };
  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid place-items-center py-10 text-text-2">
        <Spinner />
      </div>
    );
  }
  if (status === 'error') return <p className="px-4 py-6 text-center text-[13px] text-danger">{error}</p>;
  if (!stickers.length) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-[15px] font-semibold">No stickers yet</p>
        <p className="mt-1.5 text-[13px] text-text-2">
          Make one from a photo (cut out the person or thing), import a pack, add a GIF, or save one someone sent you (press and hold it → Save as sticker).
        </p>
        <Button className="mt-4" size="sm" icon={Plus} onClick={onCreate}>
          Create sticker
        </Button>
      </div>
    );
  }
  const sections = [
    ...(recent.length && (filter === 'all' || filter === 'recent') ? [{ name: 'Recent', items: recent, recent: true }] : []),
    ...packs.filter((p) => filter === 'all' || filter === p.name),
  ];
  const send = (s) => onSend(s.attachment, s.id);
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-2 px-1">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto" data-testid="sticker-pack-tabs">
          {[{ name: 'all', label: 'All' }, ...(recent.length ? [{ name: 'recent', label: 'Recent' }] : []), ...packs.map((p) => ({ name: p.name, label: p.name }))].map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setFilter(t.name)}
              className={cx('h-7 shrink-0 rounded-full border px-3 text-[12px] font-medium', filter === t.name ? 'border-accent-ink/50 bg-accent-ink/15 text-accent-ink' : 'border-line text-text-2')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setEditing((e) => !e)} className="shrink-0 text-[13px] font-medium text-accent-ink">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>
      {sections.map((p) => (
        <section key={`${p.recent ? 'r' : 'p'}:${p.name}`} aria-label={p.name} className="mt-2">
          <div className="flex items-center px-1 pb-1">
            <h4 className="flex-1 text-[11px] font-semibold tracking-wider text-text-3 uppercase">{p.name}</h4>
            {!p.recent && (
              <button type="button" aria-label={`Pack ${p.name} options`} onClick={() => setPackMenu(p.name)} className="grid h-6 w-6 place-items-center rounded-full text-text-3 active:bg-surface-2">
                <Icon as={MoreHorizontal} size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {p.items.map((s) => (
              <LibraryTile key={s.id} sticker={s} editing={editing && !p.recent} onPick={send} onRemove={remove} onMenu={(st, url) => setMenu({ sticker: st, url })} />
            ))}
          </div>
        </section>
      ))}
      <StickerMenu item={menu} onClose={() => setMenu(null)} onSend={send} />
      <ActionSheet
        open={Boolean(packMenu)}
        onClose={() => setPackMenu(null)}
        title={packMenu || 'Pack'}
        actions={[
          (canExportStickers() || exportNeedsUpdate()) && {
            icon: MessageCircle,
            label: exporting ? 'Adding to WhatsApp…' : 'Add to WhatsApp',
            hint: 'Use this pack in WhatsApp (3 to 30 still stickers)',
            onSelect: () => !exporting && toWhatsApp(packMenu),
          },
          {
            icon: Pencil,
            label: 'Rename pack',
            onSelect: () => {
              setNewName(packMenu);
              setRenaming(packMenu);
            },
          },
          { icon: Trash2, label: 'Delete pack', danger: true, onSelect: () => setConfirmDelete(packMenu) },
        ]}
      />
      <Sheet open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename pack">
        <div className="px-4 pb-4">
          <Field label="Pack name" value={newName} maxLength={40} autoFocus onChange={(e) => setNewName(e.target.value)} />
          <Button
            block
            className="mt-4"
            disabled={!newName.trim() || newName.trim() === renaming}
            onClick={async () => {
              try {
                await renamePack(renaming, newName.trim());
                if (filter === renaming) setFilter(newName.trim());
              } catch (err) {
                toast(err?.message || "Couldn't rename the pack", 'danger');
              }
              setRenaming(null);
            }}
          >
            Rename
          </Button>
        </div>
      </Sheet>
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete || 'this pack'}?`}
        body="Its stickers are removed from your library. Messages that already have them keep showing them."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const name = confirmDelete;
          setConfirmDelete(null);
          try {
            await removePack(name);
            setFilter('all');
          } catch (err) {
            toast(err?.message || "Couldn't delete the pack", 'danger');
          }
        }}
      />
    </div>
  );
}

function GiphyTab({ kind, onSend }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = (offset) => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    return searchGiphy(query, kind, offset)
      .then((data) => {
        if (mine !== seq.current) return;
        setResults((prev) => (offset ? [...prev, ...(data?.results || [])] : data?.results || []));
        setNext(data?.next ?? null);
      })
      .catch((err) => mine === seq.current && setError(err?.message || 'GIF search failed.'))
      .finally(() => mine === seq.current && setLoading(false));
  };

  useEffect(() => {
    setResults([]);
    load(0);
  }, [query, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (r, save) => {
    setBusyId(r.id);
    try {
      const data = await fromGiphy(r.id, kind, { save });
      if (save) toast('Added to your stickers');
      else onSend(data.attachment);
    } catch (err) {
      toast(err?.message || "That GIF couldn't be sent.", 'danger');
    } finally {
      setBusyId(null);
    }
  };

  const stickers = kind === 'stickers';
  return (
    <div className="px-3 pb-3">
      <SearchField value={q} onChange={setQ} placeholder={stickers ? 'Search GIPHY stickers' : 'Search GIFs'} className="mb-2" />
      {error && <p className="py-2 text-center text-[13px] text-danger">{error}</p>}
      {!loading && !error && !results.length && <p className="py-6 text-center text-[13px] text-text-2">Nothing found</p>}
      <div className={cx('grid gap-1', stickers ? 'grid-cols-4' : 'grid-cols-2')}>
        {results.map((r) => (
          <div key={r.id} className={cx('relative overflow-hidden rounded-xl', stickers ? 'aspect-square' : 'h-28 bg-surface-2')}>
            <button
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => pick(r, false)}
              aria-label={`Send ${r.title || (stickers ? 'sticker' : 'GIF')}`}
              className={cx('block h-full w-full', busyId && busyId !== r.id && 'opacity-50')}
            >
              <img
                src={r.preview.url}
                alt=""
                loading="lazy"
                draggable={false}
                referrerPolicy="no-referrer"
                className={cx('h-full w-full', stickers ? 'object-contain' : 'object-cover')}
              />
              {busyId === r.id && (
                <span className="absolute inset-0 grid place-items-center bg-surface/60">
                  <Spinner />
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={Boolean(busyId)}
              aria-label="Save to my stickers"
              onClick={() => pick(r, true)}
              className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full glass-ctl text-text-2"
            >
              <Icon as={BookmarkPlus} size={14} />
            </button>
          </div>
        ))}
      </div>
      {loading && (
        <div className="grid place-items-center py-4 text-text-2">
          <Spinner />
        </div>
      )}
      {!loading && next != null && (
        <Button block variant="secondary" size="sm" className="mt-2" onClick={() => load(next)}>
          Load more
        </Button>
      )}
      <p className="mt-2 text-right text-[10px] tracking-wider text-text-3 uppercase">Powered by GIPHY</p>
    </div>
  );
}

/** Emoji by category with the recent ones first; tapping one adds it to the message (the sheet stays open). */
function EmojiTab({ onPick }) {
  const [recent, setRecent] = useState(recentEmojis);
  const box = useRef(null);
  const sections = [...(recent.length ? [{ id: 'recent', label: 'Recent', icon: '🕘', emojis: recent }] : []), ...EMOJI_CATEGORIES];
  const jump = (id) => box.current?.querySelector(`[data-emoji-section="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  return (
    <div data-testid="emoji-tab">
      <div className="no-scrollbar mx-3 mb-1 flex gap-1 overflow-x-auto" role="tablist" aria-label="Emoji categories">
        {sections.map((c) => (
          <button key={c.id} type="button" aria-label={c.label} title={c.label} onClick={() => jump(c.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[20px] active:bg-surface-2">
            {c.icon}
          </button>
        ))}
      </div>
      <div ref={box} className="px-3 pb-3">
        {sections.map((c) => (
          <section key={c.id} data-emoji-section={c.id} aria-label={c.label} className="scroll-mt-2">
            <h4 className="px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-text-3 uppercase">{c.label}</h4>
            <div className="grid grid-cols-8 gap-0.5">
              {c.emojis.map((e, i) => (
                <button
                  key={`${c.id}-${i}`}
                  type="button"
                  aria-label={`Insert ${e}`}
                  onPointerDown={(ev) => ev.preventDefault()}
                  onClick={() => {
                    noteEmojiUsed(e);
                    onPick(e);
                    if (c.id !== 'recent') setRecent(recentEmojis());
                  }}
                  className="pressable grid aspect-square place-items-center rounded-xl text-[24px] active:bg-surface-2"
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * One picker for the composer, like a phone keyboard: Emoji, GIFs and Stickers. onSend(attachment)
 * sends a sticker or GIF right away; onEmoji(e) adds an emoji to the message (left open for more).
 */
export function StickerSheet({ open, onClose, onSend, onEmoji, initialTab }) {
  const { giphy, aiImages } = useStickers();
  const [aiOpen, setAiOpen] = useState(false);
  const [tab, setTab] = useState(initialTab || (onEmoji ? 'emoji' : 'mine'));
  useEffect(() => {
    if (open) setTab(initialTab || (onEmoji ? 'emoji' : 'mine'));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [makerFile, setMakerFile] = useState(null);
  const input = useRef(null);
  // Emoji | GIF | Stickers (| GIPHY stickers), like a phone keyboard. Without onSend (editing a
  // message) only emoji can be added.
  const tabs = [
    onEmoji && { value: 'emoji', label: 'Emoji' },
    onSend && giphy && { value: 'gifs', label: 'GIF' },
    onSend && { value: 'mine', label: 'Stickers' },
    onSend && giphy && { value: 'stickers', label: 'GIPHY' },
  ].filter(Boolean);
  const [importing, setImporting] = useState(null); // { done, total }
  const importInput = useRef(null);
  const send = (attachment, stickerId) => {
    noteStickerUsed(stickerId);
    onSend?.(attachment);
    onClose?.();
  };
  const create = () => input.current?.click();
  const runImport = async (files) => {
    try {
      const items = await filesToImport(files);
      if (!items.length) {
        toast('No stickers found in that file. Pick pictures, a .zip or a .wastickers pack.', 'danger');
        return;
      }
      setImporting({ done: 0, total: items.length });
      const { added, failed } = await importStickers(items, { onProgress: (done, total) => setImporting({ done, total }) });
      setTab('mine');
      toast(failed ? `Imported ${added}, ${failed} couldn't be added` : `Imported ${added} sticker${added === 1 ? '' : 's'}`, failed ? 'danger' : 'success');
    } catch (err) {
      toast(err?.message || "Couldn't import those stickers", 'danger');
    } finally {
      setImporting(null);
    }
  };

  return (
    <>
      <Sheet
        open={open && !makerFile && !aiOpen}
        onClose={onClose}
        full
        title={tab === 'emoji' ? 'Emoji' : tab === 'gifs' ? 'GIFs' : 'Stickers'}
      >
        <div data-testid="sticker-sheet">
          {tabs.length > 1 && <Segmented options={tabs} value={tab} onChange={setTab} label="Emoji, GIFs and stickers" className="mx-4 mb-2" size="sm" />}
          {tab === 'mine' && (
          <div className="mx-4 mb-3 grid auto-cols-fr grid-flow-col gap-2">
            {aiImages && (
              <Button size="sm" variant="secondary" icon={Sparkles} onClick={() => setAiOpen(true)} aria-label="AI fun picture">
                AI
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={Upload} onClick={() => importInput.current?.click()} aria-label="Import stickers" disabled={Boolean(importing)}>
              {importing ? `${importing.done}/${importing.total}` : 'Import'}
            </Button>
            <Button size="sm" variant="secondary" icon={Plus} onClick={create} aria-label="Create sticker">
              Create
            </Button>
          </div>
          )}
          {tab === 'emoji' ? (
            <EmojiTab onPick={(e) => onEmoji?.(e)} />
          ) : tab === 'mine' ? (
            <MyStickers onSend={send} onCreate={create} />
          ) : (
            <GiphyTab key={tab} kind={tab} onSend={send} />
          )}
        </div>
      </Sheet>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        data-testid="sticker-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setMakerFile(f);
        }}
      />
      <input
        ref={importInput}
        type="file"
        multiple
        accept="image/png,image/webp,image/gif,image/jpeg,.zip,.wastickers,application/zip"
        hidden
        data-testid="sticker-import"
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) runImport(files);
        }}
      />
      <AiPictureSheet
        open={open && aiOpen}
        onClose={() => setAiOpen(false)}
        onUse={(file) => {
          setAiOpen(false);
          setMakerFile(file);
        }}
      />
      {makerFile && (
        <StickerMakerSheet
          file={makerFile}
          canSend={Boolean(onSend)}
          onCancel={() => setMakerFile(null)}
          onDone={(sticker, { send: andSend }) => {
            setMakerFile(null);
            setTab('mine');
            if (andSend) send(sticker.attachment);
            else toast('Added to your stickers');
          }}
        />
      )}
    </>
  );
}

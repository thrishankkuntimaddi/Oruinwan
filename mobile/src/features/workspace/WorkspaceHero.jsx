// The workspace's cover and picture, like a profile header: the cover across the top and the
// square picture overlapping its lower edge. Owners and admins change them right here: tap the
// cover, or the + on the picture (cropped to a square first). Used on the Workspace screen,
// Admin → General and the workspace drawer.
import { useRef, useState } from 'react';
import { Camera, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { api, useSession } from '../../data/session.js';
import { toast } from '../../lib/bus.js';
import { Icon } from '../../ui/Icon.jsx';
import { ActionSheet } from '../../ui/Overlay.jsx';
import { SquareCropSheet } from '../../ui/SquareCropSheet.jsx';
import { cx } from '../../ui/cx.js';
import { WorkspaceTile } from './WorkspaceTile.jsx';

const TYPES = 'image/jpeg,image/png,image/webp,image/gif';

export function WorkspaceHero({ workspace, editable = false, size = 76, coverHeight = 120, className }) {
  const pictureInput = useRef(null);
  const coverInput = useRef(null);
  const [cropping, setCropping] = useState(null);
  const [busy, setBusy] = useState(null); // 'logo' | 'cover'
  const [menu, setMenu] = useState(null); // 'logo' | 'cover'
  const profile = workspace?.profile || {};
  const color = workspace?.color || '#b8956a';

  const save = async (kind, file) => {
    if (file && file.size > 5 * 1024 * 1024) return toast('Pictures can be at most 5 MB', 'danger');
    setBusy(kind);
    try {
      await api().setWorkspaceImage(workspace.id, kind, file);
      await useSession.getState().loadWorkspaces();
      toast(file ? (kind === 'logo' ? 'Workspace picture updated' : 'Cover updated') : kind === 'logo' ? 'Picture removed' : 'Cover removed', 'success');
      setCropping(null);
    } catch (err) {
      toast(err.message || 'Upload failed', 'danger');
    } finally {
      setBusy(null);
    }
    return undefined;
  };
  // With a picture already: change or remove. Without: straight to the picker.
  const tap = (kind) => {
    if (!editable) return;
    const has = kind === 'logo' ? profile.logoUrl : profile.coverUrl;
    if (has) setMenu(kind);
    else (kind === 'logo' ? pictureInput : coverInput).current?.click();
  };

  return (
    <div className={cx('relative', className)} data-testid="workspace-hero">
      <button
        type="button"
        onClick={() => tap('cover')}
        disabled={!editable}
        aria-label={editable ? (profile.coverUrl ? 'Change cover' : 'Add a cover') : 'Cover'}
        className="relative block w-full overflow-hidden rounded-card border border-line-soft text-left"
        style={{
          height: coverHeight,
          background: profile.coverUrl ? undefined : `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, rgb(var(--c-bg))))`,
        }}
        data-testid="workspace-hero-cover"
      >
        {profile.coverUrl && <img src={profile.coverUrl} alt="" className="h-full w-full object-cover" />}
        {editable && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur">
            <Icon as={busy === 'cover' ? ImagePlus : Camera} size={13} /> {busy === 'cover' ? 'Uploading…' : profile.coverUrl ? 'Change cover' : 'Add cover'}
          </span>
        )}
      </button>
      <div className="relative -mt-10 ml-4 inline-block">
        <button
          type="button"
          onClick={() => tap('logo')}
          disabled={!editable}
          aria-label={editable ? (profile.logoUrl ? 'Change workspace picture' : 'Add a workspace picture') : workspace?.name}
          className="block rounded-[18px] ring-4 ring-[rgb(var(--c-bg))]"
          data-testid="workspace-hero-picture"
        >
          <WorkspaceTile workspace={workspace} size={size} className="!rounded-[18px]" />
        </button>
        {editable && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gold text-on-accent ring-[3px] ring-[rgb(var(--c-bg))]"
          >
            <Icon as={Plus} size={15} />
          </span>
        )}
      </div>

      <input ref={pictureInput} type="file" accept={TYPES} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCropping(f); }} />
      <input ref={coverInput} type="file" accept={TYPES} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) save('cover', f); }} />
      <SquareCropSheet
        file={cropping}
        title="Workspace picture"
        busy={busy === 'logo'}
        onCancel={() => setCropping(null)}
        onDone={(blob) => save('logo', new File([blob], 'workspace.jpg', { type: 'image/jpeg' }))}
      />
      <ActionSheet
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        title={menu === 'logo' ? 'Workspace picture' : 'Cover'}
        actions={[
          { label: menu === 'logo' ? 'Change picture' : 'Change cover', icon: ImagePlus, onSelect: () => (menu === 'logo' ? pictureInput : coverInput).current?.click() },
          { label: menu === 'logo' ? 'Remove picture' : 'Remove cover', icon: Trash2, danger: true, onSelect: () => save(menu, null) },
        ]}
      />
    </div>
  );
}

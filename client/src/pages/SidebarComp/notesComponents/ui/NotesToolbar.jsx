import React from 'react';
import { Clock, Sparkles, Share2, Check, Trash2, MoreHorizontal, Copy, Download, Info } from 'lucide-react';

const BTN = {
  base: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 150ms ease' },
};

const NotesToolbar = ({
  formattedDate,
  showShareTooltip,
  showMenu,
  setShowMenu,
  handleAI,
  handleShare,
  handleDuplicate,
  handleDownloadPDF,
  setIsDeleteModalOpen,
  setShowInfoModal,
  menuRef,
  isPinned,
  handleToggleStar,
  handleToggleArchive,
}) => {
  return (
    <div style={{
      height: '52px', padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#0e0e0e', borderBottom: '1px solid var(--border-subtle)',
      flexShrink: 0, zIndex: 10, position: 'relative',
    }}>
      {/* Left: last edited */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        <Clock size={12} />
        <span>Last edited {formattedDate}</span>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

        {/* AI Button */}
        <button onClick={handleAI}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Sparkles size={13} />
          <span>AI Draft</span>
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--bg-active)', margin: '0 4px' }} />

        {/* Share */}
        <button onClick={handleShare}
          style={{ ...BTN.base, padding: '6px' }}
          title="Copy Link"
          onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
        >
          {showShareTooltip
            ? <Check size={17} style={{ color: '#34d399' }} />
            : <Share2 size={17} />}
        </button>

        {/* Delete */}
        <button onClick={() => setIsDeleteModalOpen(true)}
          style={{ ...BTN.base, padding: '6px' }}
          title="Delete Note"
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 size={17} />
        </button>

        {/* More ⋯ */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)}
            style={{ ...BTN.base, padding: '6px', background: showMenu ? 'rgba(255,255,255,0.07)' : 'transparent', color: showMenu ? '#e4e4e4' : 'rgba(228,228,228,0.35)' }}
            onMouseEnter={e => { if (!showMenu) { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { if (!showMenu) { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; } }}
          >
            <MoreHorizontal size={17} />
          </button>

          {showMenu && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', width: '192px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 50px rgba(0,0,0,0.7)', padding: '4px 0', zIndex: 20 }}>
              {[
                { label: 'Duplicate', Icon: Copy, action: handleDuplicate },
                { label: 'Download PDF', Icon: Download, action: handleDownloadPDF },
              ].map(({ label, Icon: Ic, action }) => (
                <button key={label} onClick={action}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Ic size={13} style={{ color: 'var(--text-muted)' }} /> {label}
                </button>
              ))}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
              <button onClick={() => { setShowInfoModal(true); setShowMenu(false); }}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 150ms ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Info size={13} style={{ color: 'var(--text-muted)' }} /> Note Info
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesToolbar;

import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Lock, Megaphone, Star } from 'lucide-react';

const ListItem = ({ item, isSelectionMode, selectedItems, setSelectedItems, toggleFavorite }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const currentPath = location.pathname;

    const isHome = location.pathname.includes('/home');
    const itemPath = item.type === 'channel'
        ? `/workspace/${workspaceId}${isHome ? '/home' : ''}/channel/${item.id}`
        : `/workspace/${workspaceId}${isHome ? '/home' : ''}/dm/${item.id}`;
    const isActive = currentPath === itemPath;
    const isSelected = selectedItems.has(item.id);

    const handleClick = (e) => {
        if (isSelectionMode) {
            e.stopPropagation();
            const newSelected = new Set(selectedItems);
            newSelected.has(item.id) ? newSelected.delete(item.id) : newSelected.add(item.id);
            setSelectedItems(newSelected);
        } else {
            navigate(itemPath);
        }
    };

    // Status color map
    const statusColor = {
        active: 'var(--state-success)', online: 'var(--state-success)',
        away: '#e59e0c', dnd: 'var(--state-danger)', busy: 'var(--state-danger)',
    }[item.status] || 'var(--border-default)';

    return (
        <div
            onClick={handleClick}
            style={{
                padding: '5px 10px 5px 14px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', cursor: 'pointer', position: 'relative',
                transition: 'background 150ms ease',
                background: isSelected
                    ? 'var(--bg-hover)'
                    : isActive
                        ? 'var(--bg-hover)'
                        : 'none',
                fontFamily: 'var(--font)',
            }}
            className="group"
            onMouseEnter={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { if (!isActive && !isSelected) e.currentTarget.style.background = 'none'; }}
        >
            {/* Active indicator bar */}
            {isActive && !isSelectionMode && (
                <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: '2px', background: 'var(--accent)', borderRadius: '0 2px 2px 0' }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: '8px' }}>
                {/* Selection checkbox */}
                {isSelectionMode && (
                    <div style={{
                        width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0,
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-default)',
                        background: isSelected ? 'var(--accent)' : 'var(--bg-input)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: '150ms ease',
                    }}>
                        {isSelected && <span style={{ width: '8px', height: '8px', background: '#0c0c0c', borderRadius: '1px', display: 'block' }} />}
                    </div>
                )}

                {/* Icon / Avatar */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.type === 'dm' ? (
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '11px',
                                background: isActive ? 'var(--bg-active)' : 'var(--bg-surface)',
                                border: `1px solid ${isActive ? 'var(--border-accent)' : 'var(--border-default)'}`,
                                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                transition: '150ms ease',
                            }}>
                                {item.label.charAt(0).toUpperCase()}
                            </div>
                            {/* Status dot */}
                            <div style={{
                                position: 'absolute', bottom: '-1px', right: '-1px',
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: statusColor,
                                border: '1.5px solid var(--bg-base)',
                            }} />
                        </div>
                    ) : (
                        <div style={{
                            width: '24px', height: '24px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1px solid ${isActive
                                ? 'var(--border-accent)'
                                : item.label.toLowerCase() === 'announcements'
                                    ? 'rgba(184,149,106,0.3)'
                                    : item.isPrivate
                                        ? 'var(--border-default)'
                                        : 'var(--border-subtle)'}`,
                            color: isActive
                                ? 'var(--accent)'
                                : item.label.toLowerCase() === 'announcements'
                                    ? 'var(--accent)'
                                    : 'var(--text-muted)',
                            transition: '150ms ease',
                        }}>
                            {item.isPrivate ? (
                                <Lock size={11} strokeWidth={2.5} />
                            ) : item.label.toLowerCase() === 'announcements' ? (
                                <Megaphone size={11} strokeWidth={2.5} />
                            ) : (
                                <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>#</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Label */}
                <span style={{
                    fontSize: '13px', fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'color 150ms ease', letterSpacing: '-0.01em',
                }}>
                    {item.type === 'channel' ? item.label.replace(/^#/, '') : item.label}
                </span>
            </div>

            {/* Favorite star */}
            {!isSelectionMode && (
                <button
                    onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}
                    style={{
                        width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: 'none', cursor: 'pointer', borderRadius: '2px',
                        color: item.isFavorite ? 'var(--accent)' : 'var(--text-muted)',
                        opacity: item.isFavorite ? 1 : 0.3,
                        transition: 'opacity 120ms ease, color 120ms ease', flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = item.isFavorite ? '1' : '0.3'; e.currentTarget.style.color = item.isFavorite ? 'var(--accent)' : 'var(--text-muted)'; }}
                    title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Star size={12} fill={item.isFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
                </button>
            )}
        </div>
    );
};

export default ListItem;

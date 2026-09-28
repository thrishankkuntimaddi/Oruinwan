import React from 'react';
import UserAvatarImage from '../../../../shared/components/ui/UserAvatarImage';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Lock, Megaphone, Star, Check } from 'lucide-react';
import '../../../layout/shell.css';

const PRESENCE = { active: 'is-online', online: 'is-online', away: 'is-away', dnd: 'is-busy', busy: 'is-busy' };

/** A channel or DM row in the Home panel. */
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
    const isAnnouncements = (item.label || '').toLowerCase() === 'announcements';

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

    const onKeyDown = (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e); }
    };

    const classes = ['gl-item', 'gl-shell-row'];
    if (isActive && !isSelectionMode) classes.push('is-active');
    if (isSelected) classes.push('is-selected');

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={onKeyDown}
            className={classes.join(' ')}
            aria-current={isActive && !isSelectionMode ? 'page' : undefined}
        >
            {isSelectionMode && (
                <span className={`gl-shell-check${isSelected ? ' is-on' : ''}`} aria-hidden="true">
                    {isSelected && <Check size={10} strokeWidth={3} />}
                </span>
            )}

            {item.type === 'dm' ? (
                <span className="gl-shell-avatar">
                    <UserAvatarImage
                        userId={item.userId}
                        name={item.label}
                        src={item.avatar}
                        size={24}
                        style={{ border: `1px solid ${isActive ? 'var(--gl-accent-line)' : 'var(--border-default)'}`, boxSizing: 'border-box' }}
                        initialStyle={{
                            background: isActive ? 'var(--gl-accent-soft)' : 'var(--bg-active)',
                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                    />
                    <span className={`gl-shell-presence ${PRESENCE[item.status] || ''}`} aria-hidden="true" />
                </span>
            ) : (
                <span className={`gl-shell-glyph${isAnnouncements ? ' gl-shell-glyph--accent' : ''}`} aria-hidden="true">
                    {item.isPrivate ? <Lock size={11} strokeWidth={2.5} />
                        : isAnnouncements ? <Megaphone size={11} strokeWidth={2.5} />
                            : '#'}
                </span>
            )}

            <span className="gl-shell-row-label">
                {item.type === 'channel' ? item.label.replace(/^#/, '') : item.label}
            </span>

            {!isSelectionMode && (
                <button
                    type="button"
                    className={`gl-shell-star${item.isFavorite ? ' is-on' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleFavorite(item.id); }}
                    title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={!!item.isFavorite}
                >
                    <Star size={12} fill={item.isFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
                </button>
            )}
        </div>
    );
};

export default ListItem;

import { Hash, Users, ArrowRight } from 'lucide-react';
import BrandMark from '../../../shared/components/ui/BrandMark';
import '../../../components/layout/shell.css';

/** Workspace home with nothing open: welcome + shortcuts to Channels and Messages. */
function EmptyState({ onNavigateChannels, onNavigateDMs }) {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    return (
        <div className="gl-shell-welcome gl-ambient">
            <div className="gl-shell-welcome-inner">
                <div className="gl-shell-brand-tile">
                    <BrandMark size={44} title="" />
                </div>

                <span className="gl-eyebrow">Workspace home</span>
                <h1 className="gl-display gl-shell-welcome-title">
                    Welcome to <span className="gl-sheen">Oruinwan</span>
                </h1>

                <p className="gl-shell-welcome-lead">
                    Your command centre for collaboration. Select a channel or direct message to start.
                </p>

                <div className="gl-shell-shortcuts">
                    {[
                        { label: 'Channels', sub: 'Team discussions', Icon: Hash, onClick: onNavigateChannels },
                        { label: 'Direct Messages', sub: 'Private chats', Icon: Users, onClick: onNavigateDMs },
                    ].map(({ label, sub, Icon, onClick }) => (
                        <button key={label} type="button" onClick={onClick} className="gl-card gl-card--interactive gl-shell-shortcut">
                            <span className="gl-shell-shortcut-mark" aria-hidden="true"><Icon size={16} /></span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span className="gl-shell-shortcut-title" style={{ display: 'block' }}>{label}</span>
                                <span className="gl-shell-shortcut-sub" style={{ display: 'block' }}>{sub}</span>
                            </span>
                            <ArrowRight size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true" />
                        </button>
                    ))}
                </div>

                <p className="gl-shell-kbd-hint">
                    Press <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd> <kbd>K</kbd> to search everything
                </p>
            </div>
        </div>
    );
}

export default EmptyState;

import React, { useState } from 'react';
import { Search, Grid, List as ListIcon, Plus, FileText, Clock } from 'lucide-react';
import CanvasCard from '../CanvasCard.jsx';

const COVER_COLORS = [
    '#b8956a', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#10B981', '#06B6D4', '#3B82F6', '#84CC16', '#F97316'
];

function StyledInput({ value, onChange, placeholder, inputRef, style = {} }) {
    return (
        <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{
                padding: '6px 10px', fontSize: '13px',
                border: '1px solid var(--border-default)',
                borderRadius: '2px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                transition: 'border-color 150ms ease',
                ...style,
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
        />
    );
}

function CreateModal({ onClose, onCreate }) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(COVER_COLORS[0]);
    const ref = React.useRef(null);
    React.useEffect(() => ref.current?.focus(), []);

    return (
        <div
            onClick={e => e.target === e.currentTarget && onClose()}
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }}
        >
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '2px', width: '380px', padding: '24px',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}>
                <h3 style={{
                    fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)',
                    margin: '0 0 4px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>New Canvas</h3>
                <p style={{
                    fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>Create a shared document for your team.</p>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{
                        display: 'block', fontSize: '9px', fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
                        marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Title</label>
                    <StyledInput
                        inputRef={ref}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Untitled canvas…"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{
                        display: 'block', fontSize: '9px', fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
                        marginBottom: '8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Cover Color</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {COVER_COLORS.map(c => (
                            <button key={c} onClick={() => setColor(c)} style={{
                                width: 24, height: 24, borderRadius: '2px',
                                background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
                                outline: color === c ? `2px solid ${c}` : '2px solid transparent',
                                outlineOffset: '2px', transition: 'transform 150ms ease',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            />
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '8px', fontSize: '13px', fontWeight: 400,
                        color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
                        border: '1px solid var(--border-default)', borderRadius: '2px',
                        cursor: 'pointer', transition: 'background-color 150ms ease',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                    >Cancel</button>
                    <button onClick={() => name.trim() && onCreate(name.trim(), color)} disabled={!name.trim()} style={{
                        flex: 1, padding: '8px', fontSize: '13px', fontWeight: 500,
                        color: '#0c0c0c', backgroundColor: color,
                        border: 'none', borderRadius: '2px',
                        cursor: name.trim() ? 'pointer' : 'not-allowed',
                        opacity: name.trim() ? 1 : 0.4,
                        transition: 'opacity 150ms ease',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>Create Canvas</button>
                </div>
            </div>
        </div>
    );
}

const CanvasDashboardView = ({
    tabs, dashboardView, dashboardSearch,
    onViewChange, onSearchChange, onCreate,
    onOpen, onDelete, onRename, onShare, channelName
}) => {
    const [showCreate, setShowCreate] = useState(false);
    const filtered = tabs.filter(t => t.name.toLowerCase().includes(dashboardSearch.toLowerCase()));

    const handleCreate = (name, coverColor) => { setShowCreate(false); onCreate(name, coverColor); };

    return (
        <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', overflowY: 'auto' }}>
            {}
            <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
                padding: '14px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} style={{ color: 'var(--accent)' }} />
                        <h1 style={{
                            fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif', margin: 0,
                        }}>Canvas</h1>
                        {channelName && (
                            <span style={{
                                fontSize: '13px', color: 'var(--text-muted)',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}>· #{(channelName || '').replace(/^#/, '')}</span>
                        )}
                    </div>
                    <p style={{
                        fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>
                        {tabs.length} document{tabs.length !== 1 ? 's' : ''}
                        {tabs.length >= 5 && <span style={{ marginLeft: '4px', color: 'var(--accent)' }}>· Max 5 reached</span>}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {}
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="text" placeholder="Search…" value={dashboardSearch}
                            onChange={e => onSearchChange(e.target.value)}
                            style={{
                                paddingLeft: '30px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px',
                                width: '160px', fontSize: '13px',
                                backgroundColor: 'var(--bg-active)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '2px', color: 'var(--text-primary)',
                                outline: 'none', transition: 'border-color 150ms ease',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        />
                    </div>

                    {}
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        backgroundColor: 'var(--bg-active)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '2px', padding: '2px',
                    }}>
                        {[{ view: 'grid', Icon: Grid }, { view: 'list', Icon: ListIcon }].map(({ view, Icon }) => (
                            <button key={view} onClick={() => onViewChange(view)} style={{
                                padding: '5px', borderRadius: '2px', background: 'none', border: 'none',
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                color: dashboardView === view ? 'var(--accent)' : 'var(--text-muted)',
                                backgroundColor: dashboardView === view ? 'var(--bg-hover)' : 'transparent',
                                transition: 'color 150ms ease, background-color 150ms ease',
                            }}>
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>

                    {}
                    {tabs.length < 5 && (
                        <button onClick={() => setShowCreate(true)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', fontSize: '13px', fontWeight: 500,
                            color: '#0c0c0c', backgroundColor: 'var(--accent)',
                            border: 'none', borderRadius: '2px', cursor: 'pointer',
                            transition: 'background-color 150ms ease',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                            New Canvas
                        </button>
                    )}
                </div>
            </div>

            {}
            <div style={{ padding: '24px' }}>
                {tabs.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '80px', textAlign: 'center' }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: '2px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px',
                            backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                            marginBottom: '20px',
                        }}>📄</div>
                        <h3 style={{
                            fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)',
                            margin: '0 0 8px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>No canvases yet</h3>
                        <p style={{
                            fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '260px',
                            margin: '0 0 24px', lineHeight: 1.65,
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            Create a shared document to brainstorm, plan projects, or document ideas with your team.
                        </p>
                        <button onClick={() => setShowCreate(true)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 20px', fontSize: '13px', fontWeight: 500,
                            color: '#0c0c0c', backgroundColor: 'var(--accent)',
                            border: 'none', borderRadius: '2px', cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        }}>
                            <Plus size={15} strokeWidth={2.5} /> Create First Canvas
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '60px', opacity: 0.5 }}>
                        <Search size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                            No canvases match "{dashboardSearch}"
                        </p>
                    </div>
                ) : (
                    <div style={dashboardView === 'grid'
                        ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }
                        : { display: 'flex', flexDirection: 'column', gap: '8px' }
                    }>
                        {filtered.map(tab => (
                            <CanvasCard key={tab._id} tab={tab} view={dashboardView}
                                onClick={() => onOpen(tab._id)}
                                onDelete={id => onDelete(id)}
                                onRename={(id, name) => onRename(id, name)}
                                onShare={id => onShare(id)} />
                        ))}
                        {dashboardView === 'grid' && tabs.length < 5 && (
                            <button onClick={() => setShowCreate(true)} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                minHeight: '160px',
                                backgroundColor: 'var(--bg-surface)',
                                border: '1px dashed var(--border-default)',
                                borderRadius: '2px', cursor: 'pointer',
                                gap: '8px', transition: 'border-color 150ms ease, background-color 150ms ease',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; }}
                            >
                                <div style={{
                                    width: 32, height: 32, borderRadius: '2px',
                                    backgroundColor: 'var(--bg-active)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Plus size={18} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <span style={{
                                    fontSize: '12px', color: 'var(--text-muted)',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}>New Canvas</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} tabCount={tabs.length} />
            )}
        </div>
    );
};

export default CanvasDashboardView;

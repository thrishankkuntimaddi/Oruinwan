import React, { useState } from 'react';
import { Grid, List as ListIcon, Plus, FileText, NotebookPen, ClipboardList, Scale, SearchX } from 'lucide-react';
import CanvasCard from '../CanvasCard.jsx';
import { Btn, Dialog, EmptyState, Field, SearchBox } from '../../../../components/ui/page';
import '../../messagingUi.css';

const MAX_CANVASES = 5;

// Stored on the canvas (user-chosen data). The first one is the theme's gold.
const COVER_COLORS = [
    { label: 'Gold', value: '#b8956a' }, { label: 'Violet', value: '#8B5CF6' }, { label: 'Pink', value: '#EC4899' },
    { label: 'Red', value: '#EF4444' }, { label: 'Amber', value: '#F59E0B' }, { label: 'Green', value: '#10B981' },
    { label: 'Cyan', value: '#06B6D4' }, { label: 'Blue', value: '#3B82F6' }, { label: 'Lime', value: '#84CC16' },
    { label: 'Orange', value: '#F97316' },
];

const STARTERS = [
    { name: 'Meeting notes', icon: NotebookPen, text: 'Agenda, decisions and follow-ups in one place.' },
    { name: 'Project brief', icon: ClipboardList, text: 'Goals, scope and owners the team can refer back to.' },
    { name: 'Decision log', icon: Scale, text: 'What was decided, when, and why.' },
];

function CreateDialog({ open, initialName = '', onClose, onCreate }) {
    const [name, setName] = useState(initialName);
    const [color, setColor] = useState(COVER_COLORS[0].value);
    React.useEffect(() => { if (open) { setName(initialName); setColor(COVER_COLORS[0].value); } }, [open, initialName]);
    const submit = () => { if (name.trim()) onCreate(name.trim(), color); };

    return (
        <Dialog
            open={open}
            title="New canvas"
            lead="A shared document everyone in this channel can edit."
            onClose={onClose}
            size="sm"
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                    <Btn variant="primary" icon={Plus} onClick={submit} disabled={!name.trim()}>Create canvas</Btn>
                </>
            )}
        >
            <Field label="Title" htmlFor="cv-new-title">
                <input
                    id="cv-new-title"
                    className="gl-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                    placeholder="e.g. Launch plan"
                    maxLength={80}
                />
            </Field>
            <Field label="Cover colour">
                <div className="cv-swatches" role="group" aria-label="Cover colour">
                    {COVER_COLORS.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            className="cv-swatch"
                            style={{ background: c.value }}
                            aria-pressed={color === c.value}
                            aria-label={c.label}
                            title={c.label}
                            onClick={() => setColor(c.value)}
                        />
                    ))}
                </div>
            </Field>
        </Dialog>
    );
}

const CanvasDashboardView = ({
    tabs, dashboardView, dashboardSearch,
    onViewChange, onSearchChange, onCreate,
    onOpen, onDelete, onRename, onShare, channelName
}) => {
    const [create, setCreate] = useState(null); // null | { name }
    const filtered = tabs.filter(t => t.name.toLowerCase().includes(dashboardSearch.toLowerCase()));
    const atLimit = tabs.length >= MAX_CANVASES;
    const channel = (channelName || '').replace(/^#/, '');

    const handleCreate = (name, coverColor) => { setCreate(null); onCreate(name, coverColor); };
    const openCreate = (name = '') => setCreate({ name });

    return (
        <div className="cv-dash">
            <div className="cv-dash-head">
                <div style={{ minWidth: 0 }}>
                    <h1 className="cv-dash-title"><FileText size={16} aria-hidden="true" /> Canvases</h1>
                    <p className="cv-dash-sub">
                        {tabs.length === 0
                            ? `Shared documents for ${channel ? `#${channel}` : 'this channel'}`
                            : `${tabs.length} of ${MAX_CANVASES} in ${channel ? `#${channel}` : 'this channel'}`}
                        {atLimit && ' · delete one to add another'}
                    </p>
                </div>

                {tabs.length > 0 && (
                    <div className="cv-dash-tools">
                        <SearchBox value={dashboardSearch} onChange={onSearchChange} placeholder="Search canvases" />
                        <div className="cv-seg" role="group" aria-label="Layout">
                            {[{ view: 'grid', Icon: Grid, label: 'Grid' }, { view: 'list', Icon: ListIcon, label: 'List' }].map(({ view, Icon, label }) => (
                                <button key={view} type="button" onClick={() => onViewChange(view)} aria-pressed={dashboardView === view} aria-label={label} title={label}>
                                    <Icon size={14} />
                                </button>
                            ))}
                        </div>
                        <Btn variant="primary" icon={Plus} onClick={() => openCreate()} disabled={atLimit} title={atLimit ? `A channel can have up to ${MAX_CANVASES} canvases` : undefined}>
                            New canvas
                        </Btn>
                    </div>
                )}
            </div>

            <div className="cv-dash-body">
                {tabs.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="No canvases yet"
                        text="A canvas is a document that lives in this channel: plans, notes and decisions everyone can edit together."
                        action={(
                            <>
                                <Btn variant="primary" icon={Plus} onClick={() => openCreate()}>New canvas</Btn>
                                <div className="cv-starters">
                                    {STARTERS.map(({ name, icon: Icon, text }) => (
                                        <button key={name} type="button" className="gl-card gl-card--interactive cv-starter" onClick={() => openCreate(name)}>
                                            <strong><Icon size={14} aria-hidden="true" /> {name}</strong>
                                            <span>{text}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={SearchX}
                        title="No canvases match"
                        text={`Nothing called "${dashboardSearch}" in this channel.`}
                        action={<Btn variant="ghost" onClick={() => onSearchChange('')}>Clear search</Btn>}
                    />
                ) : (
                    <div className={dashboardView === 'grid' ? 'cv-grid' : 'cv-list'}>
                        {filtered.map(tab => (
                            <CanvasCard key={tab._id} tab={tab} view={dashboardView}
                                onClick={() => onOpen(tab._id)}
                                onDelete={id => onDelete(id)}
                                onRename={(id, name) => onRename(id, name)}
                                onShare={id => onShare(id)} />
                        ))}
                        {dashboardView === 'grid' && !atLimit && !dashboardSearch && (
                            <button type="button" className="cv-new-tile" onClick={() => openCreate()}>
                                <Plus size={18} aria-hidden="true" />
                                New canvas
                            </button>
                        )}
                    </div>
                )}
            </div>

            <CreateDialog
                open={!!create}
                initialName={create?.name || ''}
                onClose={() => setCreate(null)}
                onCreate={handleCreate}
            />
        </div>
    );
};

export default CanvasDashboardView;

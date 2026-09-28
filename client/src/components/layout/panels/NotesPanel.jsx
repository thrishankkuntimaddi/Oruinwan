import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
    Plus, Search, Star, Archive, MoreHorizontal,
    ChevronRight, ChevronDown, ArchiveRestore,
    ArrowUpDown, BookOpen, Layers, Hash,
    FileText, Trash2, FolderPlus, Lightbulb,
    FolderOpen, Move, Users, ClipboardList,
    FolderKanban, Cpu, Megaphone, StickyNote,
    Check, X
} from "lucide-react";
import api from '@services/api';
import { useNotes, noteContentToText } from "../../../contexts/NotesContext";
import NoteTemplateModal from "../../../pages/SidebarComp/notesComponents/ui/NoteTemplateModal";
import logger from '../../../utils/logger';
import { formatDate as formatUserDate } from '../../../utils/userDateFormat';
import { getUserPreferences } from '../../../hooks/useUserPreferences';
import WorkspacePanel, { PanelSection, PanelEmpty } from '../WorkspacePanel';
import '../../../styles/gloss-x-panels.css';

const NOTE_TYPES = [
    { id: "note", Icon: FileText, label: "Document" },
    { id: "documentation", Icon: BookOpen, label: "Documentation" },
    { id: "brainstorm", Icon: Lightbulb, label: "Brainstorm" },
    { id: "meeting", Icon: Users, label: "Meeting Notes" },
    { id: "sop", Icon: ClipboardList, label: "SOP" },
    { id: "projectspec", Icon: FolderKanban, label: "Project Spec" },
    { id: "techdesign", Icon: Cpu, label: "Tech Design" },
    { id: "announcement", Icon: Megaphone, label: "Announcement" },
];

function useCanvasByChannel(workspaceId) {
    const [channels, setChannels] = useState([]);
    const load = useCallback(async () => {
        if (!workspaceId) return;
        try {
            
            const res = await api.get(`/api/channels/my?workspaceId=${workspaceId}`);
            const all = res.data?.channels || [];
            
            const withTabs = await Promise.all(all.map(async ch => {
                try {
                    const tr = await api.get(`/api/channels/${ch._id}/tabs`);
                    const tabs = tr.data?.tabs || [];
                    return { ...ch, canvasTabs: tabs };
                } catch {
                    return { ...ch, canvasTabs: [] };
                }
            }));
            
            setChannels(withTabs.filter(ch => ch.canvasTabs.length > 0));
        } catch (e) {
            logger.warn('[NotesPanel] useCanvasByChannel fetch failed:', e?.message);
        }
    }, [workspaceId]);
    useEffect(() => { load(); }, [load]);
    return { channels };
}

function formatDate(iso) {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return formatUserDate(iso, getUserPreferences().region, { year: false });
}

function getPreview(content) {
    return noteContentToText(content).slice(0, 60);
}

const SORTS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['a-z', 'A–Z'], ['z-a', 'Z–A']];

function FooterSection({ label, icon: Icon, count, isOpen, onToggle, children }) {
    return (
        <div className="gl-x-acc">
            <button type="button" className="gl-x-acc-head" onClick={onToggle} aria-expanded={isOpen}>
                {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                {Icon && <Icon size={11} />}
                <span style={{ flex: 1 }}>{label}</span>
                {count > 0 && <span className="gl-count">{count}</span>}
            </button>
            {isOpen && <div className="gl-x-acc-body">{children}</div>}
        </div>
    );
}

function DeleteDialog({ note, onConfirm, onCancel }) {
    return (
        <div className="gl-x-overlay">
            <div role="dialog" aria-modal="true" aria-label="Delete note" className="gl-card gl-x-dialog">
                <span className="gl-empty-mark" aria-hidden="true" style={{ color: 'var(--state-danger)', marginBottom: 0 }}><Trash2 size={18} /></span>
                <h3>Delete Note?</h3>
                <p>"{note?.title || 'Untitled'}" will be permanently deleted. This cannot be undone.</p>
                <div className="gl-x-dialog-actions">
                    <button type="button" className="gl-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="gl-btn gl-x-danger-solid" onClick={onConfirm}>Delete forever</button>
                </div>
            </div>
        </div>
    );
}

function MovePicker({ groups, noteGroup, onMove }) {
    return (
        <div className="gl-x-menu" style={{ position: 'absolute', right: '100%', top: 0, marginRight: '4px', width: '176px', zIndex: 70 }}>
            <p className="gl-x-menu-label" style={{ margin: 0 }}>Move to group</p>
            <button type="button" className={`gl-x-menu-item${!noteGroup ? ' is-active' : ''}`} onClick={() => onMove(null)}>
                <span style={{ flex: 1 }}>No group</span>{!noteGroup && <Check size={12} />}
            </button>
            {groups.map(g => (
                <button key={g} type="button" className={`gl-x-menu-item${noteGroup === g ? ' is-active' : ''}`} onClick={() => onMove(g)}>
                    <FolderOpen size={11} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g}</span>
                    {noteGroup === g && <Check size={12} />}
                </button>
            ))}
        </div>
    );
}

const NotesPanel = ({ title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const {
        allNotes, activeNotes, archivedNotes,
        addNote, updateNote, deleteNote,
        searchQuery, setSearchQuery,
        togglePin, toggleArchive,
        matchesSearch, getNoteAccess,
    } = useNotes();

    const { channels: canvasChannels } = useCanvasByChannel(workspaceId);

    
    const [activeTab, setActiveTab] = useState("workspace");

    
    const [wsFilter, setWsFilter] = useState("all");

    
    const GROUPS_KEY = `chttrix_note_groups_${workspaceId}`;
    const [groups, setGroups] = useState(() => {
        try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch { return []; }
    });

    
    useEffect(() => {
        const tagGroups = [...new Set(activeNotes.flatMap(n => n.tags || []).filter(Boolean))];
        setGroups(prev => {
            const merged = [...new Set([...prev, ...tagGroups])];
            if (merged.length !== prev.length) {
                localStorage.setItem(GROUPS_KEY, JSON.stringify(merged));
                return merged;
            }
            return prev;
        });
    }, [activeNotes, GROUPS_KEY]); 

    const [activeGroup, setActiveGroup] = useState(null); 
    const [showGroupInput, setShowGroupInput] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    
    const [sortOrder, setSortOrder] = useState("newest");
    const [showSortMenu, setShowSortMenu] = useState(false);

    
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [noteMenu, setNoteMenu] = useState(null); 
    const [showMovePicker, setShowMovePicker] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); 

    
    const [byTypeOpen, setByTypeOpen] = useState(false);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [activeTypeId, setActiveTypeId] = useState(null);
    const [openChannelId, setOpenChannelId] = useState(null);

    const sortMenuRef = useRef(null);
    const noteMenuRef = useRef(null);
    const groupInputRef = useRef(null);

    const activeId = location.pathname.split("/").pop();

    
    useEffect(() => {
        const h = (e) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false);
            if (noteMenuRef.current && !noteMenuRef.current.contains(e.target)) {
                setNoteMenu(null);
                setShowMovePicker(false);
            }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    
    useEffect(() => {
        if (showGroupInput) setTimeout(() => groupInputRef.current?.focus(), 50);
    }, [showGroupInput]);

    
    const displayNotes = (() => {
        let base = [...activeNotes];
        
        if (wsFilter === "favorites") base = base.filter(n => n.isPinned);
        
        if (activeGroup) base = base.filter(n => (n.tags || []).includes(activeGroup));
        
        // Title + plain text of the body (not the stored HTML/JSON).
        if (searchQuery) base = base.filter(n => matchesSearch(n, searchQuery));
        
        return base.sort((a, b) => {
            if (sortOrder === "newest") return new Date(b.updatedAt) - new Date(a.updatedAt);
            if (sortOrder === "oldest") return new Date(a.updatedAt) - new Date(b.updatedAt);
            if (sortOrder === "a-z") return (a.title || "").localeCompare(b.title || "");
            if (sortOrder === "z-a") return (b.title || "").localeCompare(a.title || "");
            return 0;
        });
    })();

    const notesByType = (typeId) =>
        activeNotes
            .filter(n => n.type === typeId && matchesSearch(n, searchQuery))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const displayArchived = searchQuery
        ? archivedNotes.filter(n => matchesSearch(n, searchQuery))
        : archivedNotes;

    const totalCanvas = canvasChannels.reduce((s, ch) => s + ch.canvasTabs.length, 0);

    
    const handleCreateGroup = () => {
        const name = newGroupName.trim();
        if (!name) { setShowGroupInput(false); return; }
        
        setGroups(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
            return next;
        });
        setActiveGroup(name);
        setNewGroupName("");
        setShowGroupInput(false);
    };

    
    const handleMove = async (groupName) => {
        if (!noteMenu) return;
        const note = allNotes.find(n => n.id === noteMenu.noteId);
        if (!note) return;
        const newTags = groupName
            ? [groupName, ...(note.tags || []).filter(t => !groups.includes(t) || t === groupName)]
            : (note.tags || []).filter(t => !groups.includes(t));
        await updateNote(note.id, { tags: newTags });
        setShowMovePicker(false);
        setNoteMenu(null);
    };

    
    const handleTemplateSelect = async (template) => {
        setShowTemplateModal(false);
        
        const TYPE_MAP = { blank: 'note', document: 'note' };
        const noteType = TYPE_MAP[template.id] || template.id || 'note';
        // One request: the note is created with the template's blocks.
        const stamp = Date.now().toString(36);
        const blocks = (template.blocks || []).map((b, i) => ({ ...b, id: `${stamp}-${i}` }));
        await addNote(template.title, noteType, { content: blocks.length ? JSON.stringify(blocks) : '' });
    };

    
    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteNote(deleteTarget.id);
        setDeleteTarget(null);
    };

    
    const ctxNote = noteMenu ? allNotes.find(n => n.id === noteMenu.noteId) : null;
    // Star / group / archive / delete are owner-only on the server.
    const ctxOwner = ctxNote ? getNoteAccess(ctxNote).isOwner : false;
    const openNoteMenu = (e, noteId) => {
        e.preventDefault();
        e.stopPropagation();
        setNoteMenu({ noteId, x: e.clientX, y: e.clientY });
        setShowMovePicker(false);
    };

    
    const renderNoteRow = (note) => {
        const typeConf = NOTE_TYPES.find(t => t.id === note.type) || NOTE_TYPES[0];
        const isActive = activeId === note.id;
        const preview = getPreview(note.content);
        const noteGroup_ = (note.tags || []).find(t => groups.includes(t)) || null;
        const { isOwner: ownsNote, canEdit: canEditNote } = getNoteAccess(note);
        const open = () => navigate(`/workspace/${workspaceId}/notes/${note.id}`);

        return (
            <div key={note.id} role="button" tabIndex={0} aria-current={isActive ? 'page' : undefined}
                className={`gl-item gl-x-tall${isActive ? ' is-active' : ''}`}
                onClick={open}
                onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }}
                onContextMenu={e => openNoteMenu(e, note.id)}
                style={{ userSelect: 'none' }}
            >
                <typeConf.Icon size={13} className="gl-x-item-icon" />
                <div className="gl-x-item-main">
                    <div className="gl-x-item-row">
                        <span className="gl-x-item-title">{note.title || 'Untitled'}</span>
                        <span className="gl-x-item-time">{formatDate(note.updatedAt)}</span>
                    </div>
                    {preview && <p className="gl-x-item-sub">{preview}</p>}
                    {(note.isPinned || !ownsNote || noteGroup_) && (
                        <div className="gl-x-item-tags">
                            {note.isPinned && <span className="gl-x-accent"><Star size={8} style={{ fill: 'currentColor' }} /> Starred</span>}
                            {!ownsNote && (
                                <span title={canEditNote ? 'Shared with you (can edit)' : 'Shared with you (view only)'}>
                                    <Users size={8} /> {note.owner?.username ? `@${note.owner.username}` : 'Shared'}{canEditNote ? '' : ' · view'}
                                </span>
                            )}
                            {noteGroup_ && <span><FolderOpen size={8} /> {noteGroup_}</span>}
                        </div>
                    )}
                </div>
                <button type="button" onClick={e => openNoteMenu(e, note.id)} className="gl-icon-btn gl-x-xs gl-x-reveal" title="Options" aria-label="Note options">
                    <MoreHorizontal size={13} />
                </button>
            </div>
        );
    };

    const allActive = wsFilter === 'all' && !activeGroup;
    const favActive = wsFilter === 'favorites' && !activeGroup;

    const headerActions = (
        <>
            <span style={{ position: 'relative', display: 'inline-flex' }} ref={sortMenuRef}>
                <button type="button" className="gl-icon-btn" onClick={() => setShowSortMenu(v => !v)} aria-expanded={showSortMenu} title="Sort notes" aria-label="Sort notes">
                    <ArrowUpDown size={14} />
                </button>
                {showSortMenu && (
                    <div className="gl-x-menu" role="menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '6px', minWidth: '132px', zIndex: 30 }}>
                        {SORTS.map(([v, l]) => (
                            <button key={v} type="button" role="menuitemradio" aria-checked={sortOrder === v}
                                className={`gl-x-menu-item${sortOrder === v ? ' is-active' : ''}`}
                                onClick={() => { setSortOrder(v); setShowSortMenu(false); }}>
                                <span style={{ flex: 1 }}>{l}</span>{sortOrder === v && <Check size={12} />}
                            </button>
                        ))}
                    </div>
                )}
            </span>
            <button type="button" className="gl-icon-btn" onClick={() => setShowTemplateModal(true)} title="New note" aria-label="New note">
                <Plus size={15} />
            </button>
        </>
    );

    const tools = (
        <>
            <div className="gl-tabs" role="tablist" aria-label="Notes source">
                {[
                    { id: 'workspace', label: 'Workspace', count: activeNotes.length },
                    { id: 'canvas', label: 'Channel Canvas', count: totalCanvas },
                ].map(tab => (
                    <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className="gl-tab" onClick={() => setActiveTab(tab.id)}>
                        {tab.label}<span className="gl-count">{tab.count}</span>
                    </button>
                ))}
            </div>
            <div className="gl-search">
                <Search size={12} />
                <input type="text" className="gl-input" placeholder="Search…" aria-label="Search notes" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingRight: searchQuery ? '30px' : undefined }} />
                {searchQuery && (
                    <button type="button" className="gl-icon-btn gl-x-xs" onClick={() => setSearchQuery('')} aria-label="Clear search"
                        style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}>
                        <X size={11} />
                    </button>
                )}
            </div>
            {activeTab === 'workspace' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="gl-x-chips" style={{ flex: 1 }}>
                            <button type="button" className={`gl-x-chip${allActive ? ' is-active' : ''}`} aria-pressed={allActive}
                                onClick={() => { setWsFilter('all'); setActiveGroup(null); }}>
                                All <span className="gl-count">{activeNotes.length}</span>
                            </button>
                            <button type="button" className={`gl-x-chip${favActive ? ' is-active' : ''}`} aria-pressed={favActive}
                                onClick={() => { setWsFilter('favorites'); setActiveGroup(null); }}>
                                <Star size={11} style={{ fill: favActive ? 'currentColor' : 'none' }} /> Starred
                            </button>
                            {groups.map(g => (
                                <button key={g} type="button" className={`gl-x-chip${activeGroup === g ? ' is-active' : ''}`} aria-pressed={activeGroup === g}
                                    onClick={() => setActiveGroup(activeGroup === g ? null : g)}>
                                    <FolderOpen size={11} /> {g}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="gl-icon-btn" onClick={() => setShowGroupInput(v => !v)} aria-pressed={showGroupInput} title="Create group" aria-label="Create group">
                            <FolderPlus size={14} />
                        </button>
                    </div>
                    {showGroupInput && (
                        <div className="gl-x-inline-field">
                            <input ref={groupInputRef} className="gl-input" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowGroupInput(false); }}
                                placeholder="Group name…" aria-label="Group name" />
                            <button type="button" className="gl-btn gl-btn--sm" onClick={handleCreateGroup}>Create</button>
                        </div>
                    )}
                </>
            )}
        </>
    );

    const footer = (
        <>
            <FooterSection
                label="By Type" icon={Layers}
                count={activeNotes.length}
                isOpen={byTypeOpen}
                onToggle={() => { setByTypeOpen(v => !v); if (!byTypeOpen) setArchiveOpen(false); }}
            >
                {NOTE_TYPES.map(t => {
                    const cnt = activeNotes.filter(n => n.type === t.id).length;
                    const isOpen = activeTypeId === t.id;
                    const tNotes = notesByType(t.id);
                    return (
                        <div key={t.id}>
                            <button type="button" className="gl-item" aria-pressed={isOpen} onClick={() => setActiveTypeId(isOpen ? null : t.id)}>
                                <span className="gl-x-caret">{isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</span>
                                <t.Icon size={13} className="gl-x-item-icon" />
                                <span style={{ flex: 1, fontSize: '12.5px' }}>{t.label}</span>
                                {cnt > 0 && <span className="gl-count">{cnt}</span>}
                            </button>
                            {isOpen && (
                                <div style={{ paddingLeft: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                                    {tNotes.length === 0
                                        ? <p className="gl-x-item-sub" style={{ padding: '6px 14px' }}>No {t.label} notes</p>
                                        : tNotes.map(renderNoteRow)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </FooterSection>

            <FooterSection
                label="Archive" icon={Archive}
                count={archivedNotes.length}
                isOpen={archiveOpen}
                onToggle={() => { setArchiveOpen(v => !v); if (!archiveOpen) setByTypeOpen(false); }}
            >
                {displayArchived.length === 0 ? (
                    <p className="gl-x-item-sub" style={{ padding: '12px 14px', textAlign: 'center' }}>Archive is empty</p>
                ) : (
                    displayArchived.map(note => {
                        const typeConf = NOTE_TYPES.find(t => t.id === note.type) || NOTE_TYPES[0];
                        const open = () => navigate(`/workspace/${workspaceId}/notes/${note.id}`);
                        return (
                            <div key={note.id} role="button" tabIndex={0} className="gl-item" onClick={open}
                                onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) open(); }}>
                                <typeConf.Icon size={12} className="gl-x-item-icon" style={{ opacity: 0.7 }} />
                                <span className="gl-x-item-title">{note.title || 'Untitled'}</span>
                                {getNoteAccess(note).isOwner && (
                                    <button type="button" className="gl-icon-btn gl-x-xs" title="Restore" aria-label="Restore note"
                                        onClick={e => { e.stopPropagation(); toggleArchive(note.id); }}>
                                        <ArchiveRestore size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </FooterSection>
        </>
    );

    return (
        <>
            <WorkspacePanel
                icon={BookOpen}
                title="Notes"
                subtitle={title}
                actions={headerActions}
                tools={tools}
                footer={footer}
                className="gl-x-flushfoot"
            >
                {activeTab === "workspace" ? (
                    <PanelSection label={activeGroup || 'Workspace Notes'} icon={activeGroup ? FolderOpen : undefined}>
                        {displayNotes.length === 0 ? (
                            <PanelEmpty
                                icon={StickyNote}
                                title={wsFilter === "favorites" ? "No starred notes" :
                                    activeGroup ? `No notes in "${activeGroup}"` :
                                        searchQuery ? `No results for "${searchQuery}"` : "No notes yet"}
                                text={!searchQuery && wsFilter === "all" && !activeGroup ? 'Docs, meeting notes and specs for the whole workspace.' : undefined}
                                action={!searchQuery && wsFilter === "all" && !activeGroup && (
                                    <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" onClick={() => setShowTemplateModal(true)}>
                                        <Plus size={12} /> Create first note
                                    </button>
                                )}
                            />
                        ) : displayNotes.map(renderNoteRow)}
                    </PanelSection>
                ) : (
                    <PanelSection label="Channel Canvases">
                        {canvasChannels.length === 0 ? (
                            <PanelEmpty icon={StickyNote} title="No canvas documents yet" text="Canvas tabs added to your channels show up here." />
                        ) : canvasChannels.map(ch => {
                            const isOpen = openChannelId === ch._id;
                            const chName = (ch.name || "channel").replace(/^#/, "");
                            const filtered = searchQuery
                                ? ch.canvasTabs.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                : ch.canvasTabs;
                            if (searchQuery && filtered.length === 0) return null;

                            return (
                                <div key={ch._id}>
                                    <button type="button" className="gl-item" aria-expanded={isOpen} onClick={() => setOpenChannelId(isOpen ? null : ch._id)}>
                                        <span className="gl-x-caret">{isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</span>
                                        <Hash size={12} className="gl-x-item-icon" />
                                        <span className="gl-x-item-title" style={{ fontWeight: 600 }}>{chName}</span>
                                        <span className="gl-count">{ch.canvasTabs.length}</span>
                                    </button>

                                    {isOpen && filtered.map(tab => {
                                        const isTabActive = activeId === tab._id;
                                        return (
                                            <button key={tab._id} type="button"
                                                className={`gl-item gl-x-tall gl-x-indent${isTabActive ? ' is-active' : ''}`}
                                                style={{ '--gl-x-depth': 1 }}
                                                onClick={() => navigate(`/workspace/${workspaceId}/channel/${ch._id}`, { state: { openTabId: tab._id } })}>
                                                <span className="gl-x-emoji">{tab.emoji || '📄'}</span>
                                                <span className="gl-x-item-main">
                                                    <span className="gl-x-item-title" style={{ display: 'block' }}>{tab.name || 'Untitled Canvas'}</span>
                                                    {tab.lastEditedAt && <span className="gl-x-item-time" style={{ display: 'block' }}>{formatDate(tab.lastEditedAt)}</span>}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </PanelSection>
                )}
            </WorkspacePanel>

            {noteMenu && ctxNote && (
                <div ref={noteMenuRef} className="gl-x-menu" role="menu"
                    style={{ position: 'fixed', zIndex: 50, width: '192px', left: Math.min(noteMenu.x, window.innerWidth - 200), top: Math.min(noteMenu.y, window.innerHeight - 220) }}
                >
                    <button type="button" className="gl-x-menu-item" onClick={() => { navigate(`/workspace/${workspaceId}/notes/${ctxNote.id}`); setNoteMenu(null); }}>
                        <FileText size={13} /> Open
                    </button>
                    {ctxOwner && (
                        <button type="button" className={`gl-x-menu-item${ctxNote.isPinned ? ' is-active' : ''}`} onClick={() => { togglePin(ctxNote.id); setNoteMenu(null); }}>
                            <Star size={13} /> {ctxNote.isPinned ? 'Unstar' : 'Star'}
                        </button>
                    )}

                    {ctxOwner && (<>
                        <div className="gl-x-menu-sep" />
                        <div style={{ position: 'relative' }}>
                            <button type="button" className="gl-x-menu-item" aria-expanded={showMovePicker} onClick={() => setShowMovePicker(v => !v)}>
                                <Move size={13} /> Move to…
                                <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
                            </button>
                            {showMovePicker && <MovePicker groups={groups} noteGroup={(ctxNote.tags || []).find(t => groups.includes(t)) || null} onMove={handleMove} />}
                        </div>
                        <button type="button" className="gl-x-menu-item" onClick={() => { toggleArchive(ctxNote.id); setNoteMenu(null); }}>
                            {ctxNote.isArchived ? <><ArchiveRestore size={13} /> Restore</> : <><Archive size={13} /> Archive</>}
                        </button>
                        <div className="gl-x-menu-sep" />
                        <button type="button" className="gl-x-menu-item gl-x-menu-item--danger" onClick={() => { setDeleteTarget(ctxNote); setNoteMenu(null); }}>
                            <Trash2 size={13} /> Delete
                        </button>
                    </>)}
                </div>
            )}

            {deleteTarget && (
                <DeleteDialog
                    note={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {showTemplateModal && (
                <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplateModal(false)} />
            )}
        </>
    );
};

export default NotesPanel;

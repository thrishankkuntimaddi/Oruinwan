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
const typeIconStyle = { color: 'var(--text-muted)', flexShrink: 0 };

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

function BottomPanel({ label, icon: Icon, count, isOpen, onToggle, children }) {
    return (
        <div style={{ borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            <button onClick={onToggle}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', textAlign: 'left', background: isOpen ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
            >
                {isOpen ? <ChevronDown size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                {Icon && <Icon size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', flex: 1, fontFamily: 'var(--font)' }}>{label}</span>
                {count > 0 && <span style={{ fontSize: '10px', background: 'var(--bg-active)', color: 'var(--text-muted)', padding: '1px 6px', fontWeight: 700, fontFamily: 'var(--font)' }}>{count}</span>}
            </button>
            {isOpen && <div style={{ maxHeight: '256px', overflowY: 'auto', scrollbarWidth: 'thin' }}>{children}</div>}
        </div>
    );
}

function DeleteDialog({ note, onConfirm, onCancel }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-overlay)' }}>
            <div role="dialog" aria-modal="true" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '320px', padding: '24px', margin: '0 16px', boxShadow: 'var(--card-shadow)', fontFamily: 'var(--font)' }}>
                <div style={{ width: '40px', height: '40px', background: 'var(--bg-active)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <Trash2 size={18} style={{ color: 'var(--state-danger)' }} />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'var(--font)' }}>Delete Note?</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>"{note?.title || 'Untitled'}" will be permanently deleted. This cannot be undone.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onCancel}
                        style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >Cancel</button>
                    <button onClick={onConfirm}
                        style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 700, color: '#fff', background: 'var(--state-danger)', border: 'none', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    >Delete forever</button>
                </div>
            </div>
        </div>
    );
}

function MovePicker({ groups, noteGroup, onMove }) {
    return (
        <div style={{ position: 'absolute', right: '100%', top: 0, marginRight: '4px', width: '176px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', boxShadow: 'var(--card-shadow)', padding: '4px 0', zIndex: 70 }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '6px 12px', fontFamily: 'var(--font)' }}>Move to group</p>
            <button onClick={() => onMove(null)}
                style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: !noteGroup ? 'var(--accent-dim)' : 'transparent', color: !noteGroup ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: !noteGroup ? 700 : 400, border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => { if (noteGroup) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (noteGroup) e.currentTarget.style.background = 'transparent'; }}
            >No group {!noteGroup && <Check size={12} />}</button>
            {groups.map(g => (
                <button key={g} onClick={() => onMove(g)}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: noteGroup === g ? 'var(--accent-dim)' : 'transparent', color: noteGroup === g ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: noteGroup === g ? 700 : 400, border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { if (noteGroup !== g) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (noteGroup !== g) e.currentTarget.style.background = 'transparent'; }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={11} style={{ color: 'var(--text-muted)' }} />{g}</span>
                    {noteGroup === g && <Check size={12} style={{ color: 'var(--accent)' }} />}
                </button>
            ))}
        </div>
    );
}

const NotesPanel = () => {
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

        return (
            <div key={note.id} onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                style={{ position: 'relative', cursor: 'pointer', background: isActive ? 'var(--accent-dim)' : 'transparent', borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 150ms ease', userSelect: 'none' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', paddingLeft: isActive ? '14px' : '12px' }}>
                    <typeConf.Icon size={13} style={{ ...typeIconStyle, marginTop: '2px', color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, fontFamily: 'var(--font)' }}>
                                {note.title || 'Untitled'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px', fontFamily: 'var(--font)' }}>{formatDate(note.updatedAt)}</span>
                        </div>
                        {preview && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{preview}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            {note.isPinned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'var(--accent)', fontWeight: 500 }}><Star size={8} style={{ fill: 'currentColor' }} /> Starred</span>}
                            {!ownsNote && (
                                <span title={canEditNote ? 'Shared with you (can edit)' : 'Shared with you (view only)'} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    <Users size={8} /> {note.owner?.username ? `@${note.owner.username}` : 'Shared'}{canEditNote ? '' : ' · view'}
                                </span>
                            )}
                            {noteGroup_ && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}><FolderOpen size={8} /> {noteGroup_}</span>}
                        </div>
                    </div>
                    <button onClick={e => openNoteMenu(e, note.id)}
                        style={{ opacity: 0, flexShrink: 0, padding: '3px', marginTop: '2px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms ease' }}
                        className="group-hover-show"
                        title="Options"
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                    >
                        <MoreHorizontal size={13} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)' }}>

                {}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>Notes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ position: 'relative' }} ref={sortMenuRef}>
                            <button onClick={() => setShowSortMenu(v => !v)}
                                style={{ padding: '5px', background: showSortMenu ? 'var(--border-default)' : 'transparent', border: 'none', color: showSortMenu ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => { if (!showSortMenu) e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                <ArrowUpDown size={13} />
                            </button>
                            {showSortMenu && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '120px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '4px 0', zIndex: 30 }}>
                                    {[['newest', 'Newest'], ['oldest', 'Oldest'], ['a-z', 'A–Z'], ['z-a', 'Z–A']].map(([v, l]) => (
                                        <button key={v} onClick={() => { setSortOrder(v); setShowSortMenu(false); }}
                                            style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: '12px', fontWeight: sortOrder === v ? 600 : 400, color: sortOrder === v ? 'var(--accent)' : 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowTemplateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--accent)', border: 'none', color: '#0c0c0c', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'opacity 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                            <Plus size={12} strokeWidth={2.5} /> New
                        </button>
                    </div>
                </div>

                {}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    {[
                        { id: 'workspace', label: 'Workspace', count: activeNotes.length },
                        { id: 'canvas', label: 'Channel Canvas', count: totalCanvas },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', fontFamily: 'var(--font)', transition: 'color 150ms ease' }}>
                            {tab.label}
                            <span style={{ fontSize: '10px', padding: '1px 5px', fontWeight: 700, background: activeTab === tab.id ? 'var(--accent-dim)' : 'var(--bg-active)', color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {tab.count}
                            </span>
                            {activeTab === tab.id && (
                                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)' }} />
                            )}
                        </button>
                    ))}
                </div>

                {}
                <div style={{ padding: '8px 12px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} size={11} />
                        <input type="text" placeholder="Search…" aria-label="Search notes" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', paddingLeft: '28px', paddingRight: '28px', paddingTop: '6px', paddingBottom: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }} />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={11} />
                            </button>
                        )}
                    </div>
                </div>

                {}

                {activeTab === "workspace" ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px 10px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flex: 1, minWidth: 0 }}>
                                {}
                                <button onClick={() => { setWsFilter('all'); setActiveGroup(null); }}
                                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: wsFilter === 'all' && !activeGroup ? 'var(--accent-dim)' : 'var(--bg-hover)', border: `1px solid ${wsFilter === 'all' && !activeGroup ? 'var(--border-accent)' : 'var(--border-subtle)'}`, color: wsFilter === 'all' && !activeGroup ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                    onMouseEnter={e => { if (!(wsFilter === 'all' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-active)'; }}
                                    onMouseLeave={e => { if (!(wsFilter === 'all' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                >
                                    All
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', background: wsFilter === 'all' && !activeGroup ? 'var(--border-accent)' : 'var(--border-default)', color: wsFilter === 'all' && !activeGroup ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font)' }}>{activeNotes.length}</span>
                                </button>

                                {}
                                <button onClick={() => { setWsFilter('favorites'); setActiveGroup(null); }}
                                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: wsFilter === 'favorites' && !activeGroup ? 'var(--accent-dim)' : 'var(--bg-hover)', border: `1px solid ${wsFilter === 'favorites' && !activeGroup ? 'var(--border-accent)' : 'var(--border-subtle)'}`, color: wsFilter === 'favorites' && !activeGroup ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                    onMouseEnter={e => { if (!(wsFilter === 'favorites' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-active)'; }}
                                    onMouseLeave={e => { if (!(wsFilter === 'favorites' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                >
                                    <Star size={11} style={{ fill: wsFilter === 'favorites' && !activeGroup ? 'currentColor' : 'none' }} /> Starred
                                </button>

                                {}
                                {groups.map(g => (
                                    <button key={g} onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: activeGroup === g ? 'var(--accent-dim)' : 'var(--bg-hover)', border: `1px solid ${activeGroup === g ? 'var(--border-accent)' : 'var(--border-default)'}`, borderRadius: '2px', color: activeGroup === g ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'var(--font)' }}
                                        onMouseEnter={e => { if (activeGroup !== g) e.currentTarget.style.background = 'var(--border-default)'; }}
                                        onMouseLeave={e => { if (activeGroup !== g) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    >
                                        <FolderOpen size={11} /> {g}
                                    </button>
                                ))}
                            </div>

                            {}
                            <button onClick={() => setShowGroupInput(v => !v)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: showGroupInput ? 'var(--accent-dim)' : 'var(--bg-hover)', border: `1px solid ${showGroupInput ? 'var(--border-accent)' : 'var(--border-default)'}`, color: showGroupInput ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease' }}
                                title="Create group"
                            >
                                <Plus size={13} strokeWidth={2.5} />
                            </button>
                        </div>

                        {}
                        {showGroupInput && (
                            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', padding: '6px 10px' }}>
                                    <FolderPlus size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <input ref={groupInputRef} value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowGroupInput(false); }}
                                        placeholder="Group name…"
                                        style={{ flex: 1, background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)' }}
                                    />
                                    <button onClick={handleCreateGroup}
                                        style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Create</button>
                                </div>
                            </div>
                        )}

                        {}
                        <div className="flex-1 overflow-y-auto px-3 pb-2">
                            {activeGroup && (
                                <p className="text-[10px] font-bold uppercase tracking-widest px-1 pt-1 pb-1.5 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                                    <FolderOpen size={10} /> {activeGroup}
                                </p>
                            )}
                            {!activeGroup && (
                                <p className="text-[10px] font-bold uppercase tracking-widest px-1 pt-1 pb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Workspace Notes
                                </p>
                            )}

                            {displayNotes.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2 text-center">
                                    <StickyNote size={22} style={{ color: 'var(--text-muted)' }} />
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                                        {wsFilter === "favorites" ? "No starred notes" :
                                            activeGroup ? `No notes in "${activeGroup}"` :
                                                searchQuery ? `No results for "${searchQuery}"` : "No notes yet"}
                                    </p>
                                    {!searchQuery && wsFilter === "all" && !activeGroup && (
                                        <button onClick={() => setShowTemplateModal(true)}
                                            style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                                            + Create first note
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {displayNotes.map(renderNoteRow)}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    
                    <div className="flex-1 overflow-y-auto px-3 pb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest px-1 pt-1 pb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Channel Canvases
                        </p>

                        {canvasChannels.length === 0 ? (
                            <div className="py-10 flex flex-col items-center gap-2 text-center">
                                <StickyNote size={22} style={{ color: 'var(--text-muted)' }} />
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>No canvas documents yet</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {canvasChannels.map(ch => {
                                    const isOpen = openChannelId === ch._id;
                                    const chName = (ch.name || "channel").replace(/^#/, "");
                                    const filtered = searchQuery
                                        ? ch.canvasTabs.filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                                        : ch.canvasTabs;
                                    if (searchQuery && filtered.length === 0) return null;

                                    return (
                                        <div key={ch._id}>
                                            <button onClick={() => setOpenChannelId(isOpen ? null : ch._id)}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', textAlign: 'left', background: isOpen ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                                                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? 'var(--bg-hover)' : 'transparent'; }}
                                            >
                                                {isOpen ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />}
                                                <Hash size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font)' }}>{chName}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--border-default)', padding: '1px 6px', fontFamily: 'var(--font)' }}>{ch.canvasTabs.length}</span>
                                            </button>

                                            {isOpen && (
                                                <div className="pl-5 space-y-0.5 pt-0.5 pb-1">
                                                    {filtered.map(tab => {
                                                        const isTabActive = activeId === tab._id;
                                                        return (
                                                            <button key={tab._id}
                                                                onClick={() => navigate(`/workspace/${workspaceId}/channel/${ch._id}`, { state: { openTabId: tab._id } })}
                                                                style={{ position: 'relative', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', background: isTabActive ? 'var(--accent-dim)' : 'transparent', borderLeft: isTabActive ? '2px solid var(--accent)' : '2px solid transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms ease' }}
                                                                onMouseEnter={e => { if (!isTabActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                                onMouseLeave={e => { if (!isTabActive) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span style={{ fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{tab.emoji || '📄'}</span>
                                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                                    <p style={{ fontSize: '12px', fontWeight: isTabActive ? 700 : 500, color: isTabActive ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                                                        {tab.name || 'Untitled Canvas'}
                                                                    </p>
                                                                    {tab.lastEditedAt && (
                                                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font)' }}>{formatDate(tab.lastEditedAt)}</p>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {}
                <div className="shrink-0">

                    {}
                    <BottomPanel
                        label="By Type" icon={Layers}
                        count={activeNotes.length}
                        isOpen={byTypeOpen}
                        onToggle={() => { setByTypeOpen(v => !v); if (!byTypeOpen) setArchiveOpen(false); }}
                    >
                        <div className="px-2 pb-2 space-y-0.5">
                            {NOTE_TYPES.map(t => {
                                const cnt = activeNotes.filter(n => n.type === t.id).length;
                                const isOpen = activeTypeId === t.id;
                                const tNotes = notesByType(t.id);
                                return (
                                    <div key={t.id}>
                                        <button onClick={() => setActiveTypeId(isOpen ? null : t.id)}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', textAlign: 'left', background: isOpen ? 'var(--accent-dim)' : 'transparent', borderLeft: isOpen ? '2px solid var(--accent)' : '2px solid transparent', border: 'none', cursor: 'pointer', color: isOpen ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 150ms ease' }}
                                            onMouseEnter={e => { if (!isOpen) e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { if (!isOpen) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                            <t.Icon size={13} style={typeIconStyle} />
                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: isOpen ? 700 : 500, fontFamily: 'var(--font)' }}>{t.label}</span>
                                            {cnt > 0 && (
                                                <span style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700, background: isOpen ? 'var(--accent-dim)' : 'var(--bg-active)', color: isOpen ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font)' }}>{cnt}</span>
                                            )}
                                        </button>

                                        {isOpen && (
                                            <div className="pl-4 space-y-0.5 pt-0.5 max-h-40 overflow-y-auto">
                                                {tNotes.length === 0 ? (
                                                    <p className="px-2 py-2" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No {t.label} notes</p>
                                                ) : tNotes.map(renderNoteRow)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </BottomPanel>

                    {}
                    <BottomPanel
                        label="Archive" icon={Archive}
                        count={archivedNotes.length}
                        isOpen={archiveOpen}
                        onToggle={() => { setArchiveOpen(v => !v); if (!archiveOpen) setByTypeOpen(false); }}
                    >
                        <div className="px-2 pb-2 space-y-0.5">
                            {displayArchived.length === 0 ? (
                                <p className="text-center py-4" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Archive is empty</p>
                            ) : (
                                displayArchived.map(note => {
                                    const typeConf = NOTE_TYPES.find(t => t.id === note.type) || NOTE_TYPES[0];
                                    return (
                                        <div key={note.id}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', cursor: 'pointer', transition: 'background 150ms ease' }}
                                            onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <typeConf.Icon size={12} style={{ ...typeIconStyle, opacity: 0.6 }} />
                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font)' }}>{note.title || 'Untitled'}</span>
                                            {getNoteAccess(note).isOwner && <button onClick={e => { e.stopPropagation(); toggleArchive(note.id); }}
                                                style={{ padding: '4px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', flexShrink: 0 }}
                                                title="Restore"
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                <ArchiveRestore size={12} />
                                            </button>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </BottomPanel>
                </div>
            </div>

            {}
            {noteMenu && ctxNote && (
                <div ref={noteMenuRef}
                    style={{ position: 'fixed', zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', fontFamily: 'var(--font)', boxShadow: 'var(--card-shadow)', padding: '4px 0', width: '192px', left: Math.min(noteMenu.x, window.innerWidth - 200), top: Math.min(noteMenu.y, window.innerHeight - 220) }}
                >
                    {[{ label: 'Open', Icon: FileText, action: () => { navigate(`/workspace/${workspaceId}/notes/${ctxNote.id}`); setNoteMenu(null); } },
                      ctxOwner && { label: ctxNote.isPinned ? 'Unstar' : 'Star', Icon: Star, action: () => { togglePin(ctxNote.id); setNoteMenu(null); }, amber: ctxNote.isPinned }]
                      .filter(Boolean)
                      .map(({ label, Icon: Ic, action, amber }) => (
                        <button key={label} onClick={action}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: amber ? 'var(--accent)' : 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        ><Ic size={13} style={{ color: amber ? 'var(--accent)' : 'var(--text-muted)' }} /> {label}</button>
                    ))}

                    {ctxOwner && (<>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />

                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowMovePicker(v => !v)}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Move size={13} style={{ color: 'var(--text-muted)' }} /> Move to…
                            <ChevronRight size={11} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                        </button>
                        {showMovePicker && <MovePicker groups={groups} noteGroup={(ctxNote.tags || []).find(t => groups.includes(t)) || null} onMove={handleMove} />}
                    </div>

                    {}
                    <button onClick={() => { toggleArchive(ctxNote.id); setNoteMenu(null); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        {ctxNote.isArchived ? <><ArchiveRestore size={13} style={{ color: 'var(--text-muted)' }} /> Restore</> : <><Archive size={13} style={{ color: 'var(--text-muted)' }} /> Archive</>}
                    </button>

                    <div style={{ height: '1px', background: 'var(--border-default)', margin: '3px 0' }} />

                    {}
                    <button onClick={() => { setDeleteTarget(ctxNote); setNoteMenu(null); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--state-danger)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <Trash2 size={13} style={{ color: 'var(--state-danger)' }} /> Delete
                    </button>
                    </>)}
                </div>
            )}

            {}
            {deleteTarget && (
                <DeleteDialog
                    note={deleteTarget}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {}
            {showTemplateModal && (
                <NoteTemplateModal onSelect={handleTemplateSelect} onClose={() => setShowTemplateModal(false)} />
            )}
        </>
    );
};

export default NotesPanel;

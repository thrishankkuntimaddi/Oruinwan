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
import { useNotes } from "../../../contexts/NotesContext";
import NoteTemplateModal from "../../../pages/SidebarComp/notesComponents/ui/NoteTemplateModal";

const NOTE_TYPES = [
    { id: "note", Icon: FileText, color: "text-sky-400", label: "Document" },
    { id: "brainstorm", Icon: Lightbulb, color: "text-amber-500", label: "Brainstorm" },
    { id: "meeting", Icon: Users, color: "text-emerald-500", label: "Meeting Notes" },
    { id: "sop", Icon: ClipboardList, color: "text-orange-500", label: "SOP" },
    { id: "projectspec", Icon: FolderKanban, color: "text-cyan-500", label: "Project Spec" },
    { id: "techdesign", Icon: Cpu, color: "text-slate-500", label: "Tech Design" },
    { id: "announcement", Icon: Megaphone, color: "text-rose-500", label: "Announcement" },
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
            console.warn('[NotesPanel] useCanvasByChannel fetch failed:', e?.message);
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
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPreview(content) {
    if (!content) return "";
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed))
            return parsed
                .filter(b => b.type === "text" || b.type === "heading")
                .map(b => (b.content || "").replace(/<[^>]*>/g, ""))
                .filter(Boolean).join(" ").slice(0, 60);
    } catch { }
    return content.replace(/<[^>]*>/g, "").slice(0, 60);
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
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', flex: 1, fontFamily: 'monospace' }}>{label}</span>
                {count > 0 && <span style={{ fontSize: '10px', background: 'var(--bg-active)', color: 'var(--text-muted)', padding: '1px 6px', fontWeight: 700, fontFamily: 'monospace' }}>{count}</span>}
            </button>
            {isOpen && <div style={{ maxHeight: '256px', overflowY: 'auto', scrollbarWidth: 'thin' }}>{children}</div>}
        </div>
    );
}

function DeleteDialog({ note, onConfirm, onCancel }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
            <div style={{ background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)', width: '320px', padding: '24px', margin: '0 16px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <Trash2 size={18} style={{ color: '#f87171' }} />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', fontFamily: 'Inter, system-ui, sans-serif' }}>Delete Note?</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>"{note?.title || 'Untitled'}" will be permanently deleted. This cannot be undone.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onCancel}
                        style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e4e4e4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >Cancel</button>
                    <button onClick={onConfirm}
                        style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: 700, color: '#0c0c0c', background: '#f87171', border: 'none', cursor: 'pointer' }}
                    >Delete</button>
                </div>
            </div>
        </div>
    );
}

function MovePicker({ groups, noteGroup, onMove, onClose }) {
    return (
        <div style={{ position: 'absolute', right: '100%', top: 0, marginRight: '4px', width: '176px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', padding: '4px 0', zIndex: 70 }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '6px 12px', fontFamily: 'monospace' }}>Move to group</p>
            <button onClick={() => onMove(null)}
                style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: !noteGroup ? 'rgba(184,149,106,0.1)' : 'transparent', color: !noteGroup ? '#b8956a' : 'rgba(228,228,228,0.6)', fontWeight: !noteGroup ? 700 : 400, border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                onMouseEnter={e => { if (noteGroup) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (noteGroup) e.currentTarget.style.background = 'transparent'; }}
            >No group {!noteGroup && <Check size={12} />}</button>
            {groups.map(g => (
                <button key={g} onClick={() => onMove(g)}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: noteGroup === g ? 'rgba(184,149,106,0.1)' : 'transparent', color: noteGroup === g ? '#b8956a' : 'rgba(228,228,228,0.6)', fontWeight: noteGroup === g ? 700 : 400, border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                    onMouseEnter={e => { if (noteGroup !== g) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (noteGroup !== g) e.currentTarget.style.background = 'transparent'; }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FolderOpen size={11} style={{ color: 'var(--text-muted)' }} />{g}</span>
                    {noteGroup === g && <Check size={12} style={{ color: '#b8956a' }} />}
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
        
        if (searchQuery)
            base = base.filter(n =>
                n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.content?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        
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
            .filter(n => n.type === typeId && (!searchQuery || n.title?.toLowerCase().includes(searchQuery.toLowerCase())))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const displayArchived = searchQuery
        ? archivedNotes.filter(n => n.title?.toLowerCase().includes(searchQuery.toLowerCase()))
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
        
        const TYPE_MAP = { blank: 'note', document: 'documentation' };
        const noteType = TYPE_MAP[template.id] || template.id || 'note';
        const newNote = await addNote(template.title, noteType);
        if (!newNote) return;
        if (template.blocks?.length > 0) {
            const blocks = template.blocks.map(b => ({ ...b, id: Date.now() + Math.random() }));
            await updateNote(newNote.id, { title: template.title, content: JSON.stringify(blocks), type: noteType });
        }
    };

    
    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteNote(deleteTarget.id);
        setDeleteTarget(null);
    };

    
    const ctxNote = noteMenu ? allNotes.find(n => n.id === noteMenu.noteId) : null;
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

        return (
            <div key={note.id} onClick={() => navigate(`/workspace/${workspaceId}/notes/${note.id}`)}
                style={{ position: 'relative', cursor: 'pointer', background: isActive ? 'rgba(184,149,106,0.08)' : 'transparent', borderLeft: isActive ? '2px solid #b8956a' : '2px solid transparent', transition: 'all 150ms ease', userSelect: 'none' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 12px', paddingLeft: isActive ? '14px' : '12px' }}>
                    <typeConf.Icon size={13} style={{ marginTop: '2px', flexShrink: 0 }} className={typeConf.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? '#b8956a' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, fontFamily: 'Inter, system-ui, sans-serif' }}>
                                {note.title || 'Untitled'}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px', fontFamily: 'monospace' }}>{formatDate(note.updatedAt)}</span>
                        </div>
                        {preview && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{preview}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            {note.isPinned && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: '#b8956a', fontWeight: 500 }}><Star size={8} style={{ fill: 'currentColor' }} /> Starred</span>}
                            {noteGroup_ && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: 'rgba(167,139,250,0.7)', fontWeight: 500 }}><FolderOpen size={8} /> {noteGroup_}</span>}
                        </div>
                    </div>
                    <button onClick={e => openNoteMenu(e, note.id)}
                        style={{ opacity: 0, flexShrink: 0, padding: '3px', marginTop: '2px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms ease' }}
                        className="group-hover-show"
                        title="Options"
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#e4e4e4'; }}
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
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>Notes</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ position: 'relative' }} ref={sortMenuRef}>
                            <button onClick={() => setShowSortMenu(v => !v)}
                                style={{ padding: '5px', background: showSortMenu ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', color: showSortMenu ? '#e4e4e4' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                onMouseLeave={e => { if (!showSortMenu) e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}>
                                <ArrowUpDown size={13} />
                            </button>
                            {showSortMenu && (
                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '120px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 0', zIndex: 30 }}>
                                    {[['newest', 'Newest'], ['oldest', 'Oldest'], ['a-z', 'A–Z'], ['z-a', 'Z–A']].map(([v, l]) => (
                                        <button key={v} onClick={() => { setSortOrder(v); setShowSortMenu(false); }}
                                            style={{ width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: '12px', fontWeight: sortOrder === v ? 600 : 400, color: sortOrder === v ? '#b8956a' : 'rgba(228,228,228,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowTemplateModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#b8956a', border: 'none', color: '#0c0c0c', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'opacity 150ms ease' }}
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
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 4px', fontSize: '11px', fontWeight: activeTab === tab.id ? 700 : 400, color: activeTab === tab.id ? '#b8956a' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', fontFamily: 'Inter, system-ui, sans-serif', transition: 'color 150ms ease' }}>
                            {tab.label}
                            <span style={{ fontSize: '10px', padding: '1px 5px', fontWeight: 700, background: activeTab === tab.id ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)', color: activeTab === tab.id ? '#b8956a' : 'var(--text-muted)' }}>
                                {tab.count}
                            </span>
                            {activeTab === tab.id && (
                                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: '#b8956a' }} />
                            )}
                        </button>
                    ))}
                </div>

                {}
                <div style={{ padding: '8px 12px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} size={11} />
                        <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', paddingLeft: '28px', paddingRight: '28px', paddingTop: '6px', paddingBottom: '6px', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }} />
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
                                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: wsFilter === 'all' && !activeGroup ? 'rgba(184,149,106,0.15)' : 'var(--bg-hover)', border: `1px solid ${wsFilter === 'all' && !activeGroup ? 'rgba(184,149,106,0.35)' : 'var(--border-subtle)'}`, color: wsFilter === 'all' && !activeGroup ? '#b8956a' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    onMouseEnter={e => { if (!(wsFilter === 'all' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-active)'; }}
                                    onMouseLeave={e => { if (!(wsFilter === 'all' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                >
                                    All
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', background: wsFilter === 'all' && !activeGroup ? 'rgba(184,149,106,0.2)' : 'rgba(255,255,255,0.07)', color: wsFilter === 'all' && !activeGroup ? '#b8956a' : 'rgba(228,228,228,0.3)', fontFamily: 'monospace' }}>{activeNotes.length}</span>
                                </button>

                                {}
                                <button onClick={() => { setWsFilter('favorites'); setActiveGroup(null); }}
                                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: wsFilter === 'favorites' && !activeGroup ? 'rgba(184,149,106,0.15)' : 'var(--bg-hover)', border: `1px solid ${wsFilter === 'favorites' && !activeGroup ? 'rgba(184,149,106,0.35)' : 'var(--border-subtle)'}`, color: wsFilter === 'favorites' && !activeGroup ? '#b8956a' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    onMouseEnter={e => { if (!(wsFilter === 'favorites' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-active)'; }}
                                    onMouseLeave={e => { if (!(wsFilter === 'favorites' && !activeGroup)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                >
                                    <Star size={11} style={{ fill: wsFilter === 'favorites' && !activeGroup ? 'currentColor' : 'none' }} /> Starred
                                </button>

                                {}
                                {groups.map(g => (
                                    <button key={g} onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, background: activeGroup === g ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${activeGroup === g ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`, color: activeGroup === g ? '#a78bfa' : 'rgba(228,228,228,0.45)', cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                        onMouseEnter={e => { if (activeGroup !== g) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                        onMouseLeave={e => { if (activeGroup !== g) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                    >
                                        <FolderOpen size={11} /> {g}
                                    </button>
                                ))}
                            </div>

                            {}
                            <button onClick={() => setShowGroupInput(v => !v)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: showGroupInput ? 'rgba(184,149,106,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showGroupInput ? 'rgba(184,149,106,0.3)' : 'rgba(255,255,255,0.08)'}`, color: showGroupInput ? '#b8956a' : 'rgba(228,228,228,0.4)', cursor: 'pointer', transition: 'all 150ms ease' }}
                                title="Create group"
                            >
                                <Plus size={13} strokeWidth={2.5} />
                            </button>
                        </div>

                        {}
                        {showGroupInput && (
                            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px' }}>
                                    <FolderPlus size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <input ref={groupInputRef} value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowGroupInput(false); }}
                                        placeholder="Group name…"
                                        style={{ flex: 1, background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    />
                                    <button onClick={handleCreateGroup}
                                        style={{ fontSize: '11px', fontWeight: 700, color: '#b8956a', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}>Create</button>
                                </div>
                            </div>
                        )}

                        {}
                        <div className="flex-1 overflow-y-auto px-3 pb-2">
                            {activeGroup && (
                                <p className="text-[9.5px] font-bold uppercase tracking-widest text-indigo-400 px-1 pt-1 pb-1.5 flex items-center gap-1">
                                    <FolderOpen size={10} /> {activeGroup}
                                </p>
                            )}
                            {!activeGroup && (
                                <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-1 pt-1 pb-1.5">
                                    Workspace Notes
                                </p>
                            )}

                            {displayNotes.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2 text-center">
                                    <StickyNote size={22} className="text-gray-200 dark:text-gray-700" />
                                    <p className="text-[11.5px] text-gray-400 dark:text-gray-500">
                                        {wsFilter === "favorites" ? "No starred notes" :
                                            activeGroup ? `No notes in "${activeGroup}"` :
                                                searchQuery ? `No results for "${searchQuery}"` : "No notes yet"}
                                    </p>
                                    {!searchQuery && wsFilter === "all" && !activeGroup && (
                                        <button onClick={() => setShowTemplateModal(true)}
                                            style={{ fontSize: '11px', fontWeight: 700, color: '#b8956a', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
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
                        <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600 px-1 pt-1 pb-1.5">
                            Channel Canvases
                        </p>

                        {canvasChannels.length === 0 ? (
                            <div className="py-10 flex flex-col items-center gap-2 text-center">
                                <StickyNote size={22} className="text-gray-200 dark:text-gray-700" />
                                <p className="text-[11.5px] text-gray-400">No canvas documents yet</p>
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
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', textAlign: 'left', background: isOpen ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms ease' }}
                                                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? 'rgba(255,255,255,0.05)' : 'transparent'; }}
                                            >
                                                {isOpen ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} />}
                                                <Hash size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{chName}</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', padding: '1px 6px', fontFamily: 'monospace' }}>{ch.canvasTabs.length}</span>
                                            </button>

                                            {isOpen && (
                                                <div className="pl-5 space-y-0.5 pt-0.5 pb-1">
                                                    {filtered.map(tab => {
                                                        const isTabActive = activeId === tab._id;
                                                        return (
                                                            <button key={tab._id}
                                                                onClick={() => navigate(`/workspace/${workspaceId}/channel/${ch._id}`, { state: { openTabId: tab._id } })}
                                                                style={{ position: 'relative', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', background: isTabActive ? 'rgba(184,149,106,0.08)' : 'transparent', borderLeft: isTabActive ? '2px solid #b8956a' : '2px solid transparent', border: 'none', cursor: 'pointer', transition: 'all 150ms ease' }}
                                                                onMouseEnter={e => { if (!isTabActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                                onMouseLeave={e => { if (!isTabActive) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                <span style={{ fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>{tab.emoji || '📄'}</span>
                                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                                    <p style={{ fontSize: '12px', fontWeight: isTabActive ? 700 : 500, color: isTabActive ? '#b8956a' : '#e4e4e4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                                                        {tab.name || 'Untitled Canvas'}
                                                                    </p>
                                                                    {tab.lastEditedAt && (
                                                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>{formatDate(tab.lastEditedAt)}</p>
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
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', textAlign: 'left', background: isOpen ? 'rgba(184,149,106,0.08)' : 'transparent', borderLeft: isOpen ? '2px solid #b8956a' : '2px solid transparent', border: 'none', cursor: 'pointer', color: isOpen ? '#b8956a' : 'var(--text-secondary)', transition: 'all 150ms ease' }}
                                            onMouseEnter={e => { if (!isOpen) e.currentTarget.style.color = 'var(--text-primary)'; }}
                                            onMouseLeave={e => { if (!isOpen) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                            <t.Icon size={13} className={`flex-shrink-0 ${t.color}`} />
                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: isOpen ? 700 : 500, fontFamily: 'Inter, system-ui, sans-serif' }}>{t.label}</span>
                                            {cnt > 0 && (
                                                <span style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700, background: isOpen ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)', color: isOpen ? '#b8956a' : 'var(--text-muted)', fontFamily: 'monospace' }}>{cnt}</span>
                                            )}
                                        </button>

                                        {isOpen && (
                                            <div className="pl-4 space-y-0.5 pt-0.5 max-h-40 overflow-y-auto">
                                                {tNotes.length === 0 ? (
                                                    <p className="text-[11px] text-gray-400 px-2 py-2 italic">No {t.label} notes</p>
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
                                <p className="text-[11.5px] text-center text-gray-400 py-4 italic">Archive is empty</p>
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
                                            <typeConf.Icon size={12} className={`flex-shrink-0 ${typeConf.color}`} style={{ opacity: 0.5 }} />
                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif' }}>{note.title || 'Untitled'}</span>
                                            <button onClick={e => { e.stopPropagation(); toggleArchive(note.id); }}
                                                style={{ padding: '4px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', flexShrink: 0 }}
                                                title="Restore"
                                                onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                                <ArchiveRestore size={12} />
                                            </button>
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
                    style={{ position: 'fixed', zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--card-shadow)', padding: '4px 0', width: '192px', left: Math.min(noteMenu.x, window.innerWidth - 200), top: Math.min(noteMenu.y, window.innerHeight - 220) }}
                >
                    {[{ label: 'Open', Icon: FileText, action: () => { navigate(`/workspace/${workspaceId}/notes/${ctxNote.id}`); setNoteMenu(null); } },
                      { label: ctxNote.isPinned ? 'Unstar' : 'Star', Icon: Star, action: () => { togglePin(ctxNote.id); setNoteMenu(null); }, amber: ctxNote.isPinned }]
                      .map(({ label, Icon: Ic, action, amber }) => (
                        <button key={label} onClick={action}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: amber ? '#b8956a' : 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        ><Ic size={13} style={{ color: amber ? '#b8956a' : 'var(--text-muted)' }} /> {label}</button>
                    ))}

                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />

                    {}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowMovePicker(v => !v)}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Move size={13} style={{ color: 'var(--text-muted)' }} /> Move to…
                            <ChevronRight size={11} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                        </button>
                        {showMovePicker && <MovePicker groups={groups} noteGroup={(ctxNote.tags || []).find(t => groups.includes(t)) || null} onMove={handleMove} onClose={() => setShowMovePicker(false)} />}
                    </div>

                    {}
                    <button onClick={() => { toggleArchive(ctxNote.id); setNoteMenu(null); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        {ctxNote.isArchived ? <><ArchiveRestore size={13} style={{ color: 'var(--text-muted)' }} /> Restore</> : <><Archive size={13} style={{ color: 'var(--text-muted)' }} /> Archive</>}
                    </button>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />

                    {}
                    <button onClick={() => { setDeleteTarget(ctxNote); setNoteMenu(null); }}
                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <Trash2 size={13} style={{ color: '#f87171' }} /> Delete
                    </button>
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

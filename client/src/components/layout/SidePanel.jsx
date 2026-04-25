import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import CreateChannelModal from "../messagesComp/CreateChannelModal";

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

const SidePanel = ({ title = "Workspace", children }) => {
    return (
        <div className="w-full h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col text-gray-700 dark:text-gray-300">
            {}
            <div className="h-12 flex items-center justify-between px-4 font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors group">
                <div className="flex items-center">
                    {title} <span className="ml-2 text-xs text-gray-500">▼</span>
                </div>
                <button
                    className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-all"
                    title="New Message"
                    onClick={(e) => { e.stopPropagation();  }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>

            {}
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {children}
            </div>
        </div>
    );
};

export const ChannelList = () => {
    const { } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({
        favorites: true,
        channels: true,
        dms: true,
    });

    
    React.useEffect(() => {
        const fetchChannels = async () => {
            if (!workspaceId) return;

            try {
                setLoading(true);
                const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/channels`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const data = await res.json();

                if (data.channels) {
                    setChannels(data.channels);
                }
            } catch (err) {
                console.error('Failed to fetch channels:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchChannels();
    }, [workspaceId]);

    
    const filterChannels = () => {
        const userId = user?.id || user?._id; 

        if (!userId) return []; 

        return channels.filter(channel => {
            
            if (channel.isDefault) {
                return true;
            }

            
            if (!channel.isPrivate && channel.isDiscoverable) {
                return true;
            }

            
            const isMember = channel.members?.some(m => {
                const memberId = m.user?._id || m.user || m._id || m;
                return String(memberId) === String(userId);
            });

            return isMember;
        });
    };

    const filteredChannels = filterChannels();

    const toggle = (section) => {
        setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ label, isOpen, onClick, onAdd }) => (
        <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer' }}
            className="group"
        >
            <div
                onClick={onClick}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}
            >
                <span style={{
                    fontSize: '9px', color: 'var(--text-muted)',
                    transition: 'transform 150ms ease',
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                }}>▶</span>
                <span style={{
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                    {label}
                </span>
            </div>
            {onAdd && (
                <button
                    onClick={onAdd}
                    title={`Add ${label}`}
                    style={{
                        width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', borderRadius: '2px',
                        transition: 'color 150ms ease, background 150ms ease',
                        fontSize: '16px', lineHeight: 1, padding: 0,
                        flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; e.currentTarget.style.background = 'rgba(184,149,106,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            )}
        </div>
    );

    const Item = ({ icon, label, channelPath, active, hasUnread }) => (
        <div
            onClick={() => navigate(`/workspace/${workspaceId}${channelPath}`)}
            className={`px-4 py-1 mx-2 rounded cursor-pointer flex items-center justify-between group ${active
                ? "bg-blue-100 text-blue-700 font-medium"
                : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
        >
            <div className="flex items-center truncate">
                <span className="mr-2 opacity-70 text-lg">{icon}</span>
                <span className="truncate">{label}</span>
            </div>
            {hasUnread && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
        </div>
    );

    return (
        <div className="space-y-6">
            {}
            <div>
                <SectionHeader
                    label="Channels"
                    isOpen={expanded.channels}
                    onClick={() => toggle("channels")}
                    onAdd={(e) => { e.stopPropagation(); setShowCreateChannelModal(true); }}
                />
                {expanded.channels && (
                    <div className="mt-1 space-y-0.5">
                        {loading ? (
                            <div className="px-2 space-y-0.5 animate-pulse">
                                {[65, 50, 80, 45, 70].map((w, i) => (
                                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                                        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                                        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded" style={{width:`${w}%`}} />
                                    </div>
                                ))}
                            </div>
                        ) : filteredChannels.length > 0 ? (
                            filteredChannels.map(channel => (
                                <Item
                                    key={channel._id}
                                    icon={channel.isDefault ? "📢" : "#"}
                                    label={channel.name}
                                    channelPath={`/channel/${channel._id}`}
                                />
                            ))
                        ) : (
                            <div className="px-4 py-2 text-xs text-gray-400">No channels available</div>
                        )}
                    </div>
                )}
            </div>

            {}
            <div>
                <SectionHeader
                    label="Direct Messages"
                    isOpen={expanded.dms}
                    onClick={() => toggle("dms")}
                    onAdd={(e) => { e.stopPropagation();  }}
                />
                {expanded.dms && (
                    <div className="mt-1 space-y-0.5">
                        <Item icon="👤" label="Sarah Connor" channelPath="/dm/sarah" active />
                        <Item icon="👤" label="Thrishank" channelPath="/dm/john" />
                        <Item icon="👤" label="Alice Smith" channelPath="/dm/alice" hasUnread />
                    </div>
                )}
            </div>

            {}
            {showCreateChannelModal && (
                <CreateChannelModal
                    workspaceId={workspaceId}
                    onClose={() => setShowCreateChannelModal(false)}
                    onCreated={(channel) => {
                        
                        setChannels(prev => [...prev, channel]);
                        navigate(`/workspace/${workspaceId}/channel/${channel._id}`);
                    }}
                />
            )}
        </div>
    );
};

export default SidePanel;

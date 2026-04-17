import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import api from '@services/api';
import { AuthContext } from "../../contexts/AuthContext";
import { getErrorMessage } from "../../utils/apiHelpers";
import { getAvatarUrl } from "../../utils/avatarUtils";
import { Search, X } from "lucide-react";

const T = {
  bg:      'var(--bg-surface)',
  base:    'var(--bg-base)',
  surface: 'var(--bg-hover)',
  border:  'var(--border-default)',
  accent:  '#b8956a',
  accentBg:'var(--accent-dim)',
  text:    'var(--text-primary)',
  muted:   'var(--text-muted)',
  font:    'Inter, system-ui, sans-serif',
};

export default function NewDMModal({ onClose, onStart }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { accessToken, user } = useContext(AuthContext);
  const { workspaceId } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const token = accessToken || localStorage.getItem("accessToken");
        if (!token && !user) { setLoading(false); return; }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let res;
        if (debouncedQuery.trim()) {
          res = await api.get(`/api/search/contacts`, { params: { workspaceId, query: debouncedQuery }, headers });
          setUsers(res.data.contacts || []);
        } else if (workspaceId) {
          res = await api.get(`/api/workspaces/${workspaceId}/members`, { headers });
          const membersList = res.data.members || [];
          const mapped = membersList.map(m => ({
            _id: m._id, username: m.username || m.email, email: m.email || "",
            about: m.profile?.about || m.about || "", profilePicture: m.profilePicture || null,
            status: m.status || "offline", userStatus: m.userStatus || null, role: m.role || "member",
          }));
          setUsers(mapped);
        } else {
          setUsers([]);
        }
        setLoading(false);
      } catch (err) {
        setError(getErrorMessage(err));
        setLoading(false);
      }
    }
    load();
  }, [accessToken, user, workspaceId, debouncedQuery]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: T.bg, border: `1px solid ${T.border}`, width: '480px', maxHeight: '600px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: T.text, fontFamily: T.font, margin: 0 }}>New Message</h3>
            <p style={{ fontSize: '12px', color: T.muted, fontFamily: T.font, marginTop: '2px' }}>Start a direct conversation</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: T.muted }} />
            <input
              type="text"
              placeholder="Search people across workspace..."
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '30px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontSize: '13px', outline: 'none', fontFamily: T.font, boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(184,149,106,0.4)'}
              onBlur={e => e.currentTarget.style.borderColor = T.border}
            />
          </div>
        </div>

        {/* User List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '10px' }}>
              <div style={{ width: '22px', height: '22px', border: `2px solid ${T.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '12px', color: T.muted, fontFamily: T.font }}>Loading members...</span>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', color: '#f87171', padding: '32px 16px', fontSize: '13px', fontFamily: T.font }}>{error}</div>
          )}

          {!loading && !error && users.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '8px' }}>
              <span style={{ fontSize: '28px' }}>👥</span>
              <p style={{ fontSize: '13px', fontWeight: 600, color: T.muted, fontFamily: T.font }}>No members found</p>
              {searchQuery && <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: T.font }}>Try a different search term</p>}
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div style={{ padding: '8px' }}>
              <div style={{ padding: '4px 10px 6px', fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font }}>
                {searchQuery ? "Results" : "Workspace Members"}
              </div>
              {users.map((u) => (
                <div
                  key={u._id}
                  onClick={() => onStart(u)}
                  className="dm-row"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', transition: 'background 150ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = T.accentBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={getAvatarUrl(u)}
                      alt={u.username}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${T.border}` }}
                      onError={(e) => { e.target.src = getAvatarUrl({ username: u.username }); }}
                    />
                    <span style={{
                      position: 'absolute', bottom: '0', right: '0', width: '9px', height: '9px', borderRadius: '50%',
                      border: '2px solid var(--bg-surface)',
                      background: u.status === 'online' ? '#34d399' : 'var(--border-default)',
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.font }}>
                        {u.username}
                      </span>
                      {u.role === 'owner' && (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', color: T.accent, fontFamily: T.font, flexShrink: 0 }}>Owner</span>
                      )}
                      {u.role === 'admin' && (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', fontFamily: T.font, flexShrink: 0 }}>Admin</span>
                      )}
                    </div>
                    {u.email && (
                      <div style={{ fontSize: '11px', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.font, marginTop: '1px' }}>{u.email}</div>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onStart(u); }}
                    style={{ flexShrink: 0, padding: '4px 10px', background: T.accent, border: 'none', color: '#000', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: T.font, transition: 'opacity 150ms ease', opacity: 0 }}
                    className="dm-msg-btn"
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .dm-row:hover .dm-msg-btn { opacity: 1 !important; }`}</style>
    </div>
  );
}

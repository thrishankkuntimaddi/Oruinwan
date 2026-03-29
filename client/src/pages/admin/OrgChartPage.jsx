import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { API_BASE } from '@services/api';
import { useAuth } from '../../contexts/AuthContext';

const DEPT_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];

function getColor(idx) { return DEPT_COLORS[idx % DEPT_COLORS.length]; }

function OrgNode({ node, color, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.teams && node.teams.length > 0) || (node.children && node.children.length > 0);

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 24, position: 'relative' }}>
      {depth > 0 && (
        <div style={{ position: 'absolute', left: -16, top: 24, width: 16, height: 1, background: '#e5e7eb' }} />
      )}
      <div
        style={{ background: '#fff', border: `2px solid ${color}`, borderRadius: 12, padding: '12px 16px', display: 'inline-flex', alignItems: 'center', gap: 10, cursor: hasChildren ? 'pointer' : 'default', minWidth: 160, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', userSelect: 'none', transition: 'box-shadow 0.2s' }}
        onClick={() => hasChildren && setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 16px ${color}40`}
        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
      >
        <span style={{ fontSize: 18 }}>{node.icon || (depth === 0 ? '🏢' : depth === 1 ? '📂' : '👥')}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{node.name}</div>
          {node.memberCount !== undefined && <div style={{ fontSize: 11, color: '#9ca3af' }}>{node.memberCount} members</div>}
          {node.lead && <div style={{ fontSize: 11, color: '#9ca3af' }}>Lead: {node.lead.username}</div>}
        </div>
        {hasChildren && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: color, fontWeight: 700 }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && hasChildren && (
        <div style={{ marginTop: 12, paddingLeft: 24, borderLeft: `2px dashed ${color}40`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(node.teams || []).map((team, ti) => (
            <OrgNode key={team.id} node={team} color={getColor(ti + 3)} depth={depth + 1} />
          ))}
          {(node.children || []).map((child, ci) => (
            <OrgNode key={child.id} node={child} color={getColor(ci + 1)} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolve companyId from auth context — same pattern as Analytics.jsx
  const companyId = typeof user?.companyId === 'object'
    ? user?.companyId?._id || user?.companyId?.id
    : user?.companyId;

  const fetchOrgChart = useCallback(async () => {
    if (!companyId) {
      setError('No company found. Org chart is available for company accounts only.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data: orgData } = await api.get(
        `/api/companies/${companyId}/org-chart`
      );
      setData(orgData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load org chart');
    } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchOrgChart(); }, [fetchOrgChart]);

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif', minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Org Chart</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              {data ? `${data.company?.name} · ${data.totalEmployees} employees · ${data.departments?.length} departments` : 'Company structure visualization'}
            </p>
          </div>
          <button
            id="refresh-org-btn"
            onClick={fetchOrgChart}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            ↻ Refresh
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>Loading org chart…</div>}
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, color: '#dc2626' }}>{error}</div>}

        {data && !loading && (
          <>
            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Employees', value: data.totalEmployees, icon: '👤', color: '#6366f1' },
                { label: 'Departments', value: data.departments?.length || 0, icon: '📂', color: '#8b5cf6' },
                { label: 'Unassigned', value: data.unassignedCount || 0, icon: '⚠️', color: '#f59e0b' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 24px', border: '1.5px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 160px', minWidth: 140 }}>
                  <span style={{ fontSize: 24 }}>{stat.icon}</span>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Company root node */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 32, border: '1.5px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
              {/* Company Header */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', padding: '14px 24px', borderRadius: 14, color: '#fff', marginBottom: 32 }}>
                <span style={{ fontSize: 28 }}>🏢</span>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{data.company?.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{data.company?.industry || 'Company'}</div>
                </div>
              </div>

              {/* Department tree */}
              {data.departments?.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: 14 }}>No departments found. Add departments from the Departments page.</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(data.departments || []).map((dept, idx) => (
                  <OrgNode key={dept.id} node={dept} color={getColor(idx)} depth={1} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

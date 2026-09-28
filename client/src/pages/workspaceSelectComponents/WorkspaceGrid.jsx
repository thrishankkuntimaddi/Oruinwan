import React from 'react';
import { User, ArrowRight, Plus, Shield, Lock, Crown, Users, Bell, SearchX, PauseCircle } from 'lucide-react';
import { WorkspaceIcon } from '../../utils/workspaceIcons';
import { getCreatePolicy } from './createPolicy';

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ROLE_ICON = { owner: Crown, admin: Shield, member: User };

const STATUS_LABEL = { suspended: 'Suspended', invited: 'Invited', pending: 'Pending' };

function WorkspaceCard({ ws, unread, onOpen }) {
    const role = ws.isOwner ? 'owner' : (ws.role || 'member');
    const RoleIcon = ROLE_ICON[role] || User;
    const status = ws.membershipStatus && ws.membershipStatus !== 'active' ? ws.membershipStatus : null;
    const members = ws.members;

    return (
        <button
            type="button"
            onClick={() => onOpen(ws.id)}
            className={`gl-card gl-card--interactive gl-wsp-card${status ? ' is-suspended' : ''}`}
            style={ws.color ? { '--wsp-tint': ws.color } : undefined}
            aria-label={`Open ${ws.name}${status ? ` (${STATUS_LABEL[status] || status})` : ''}`}
        >
            <div className="gl-wsp-card__top">
                <span className={`gl-wsp-tile${ws.color ? '' : ' is-plain'}`} style={ws.color ? { background: ws.color } : undefined} aria-hidden="true">
                    <WorkspaceIcon icon={ws.icon} size={20} />
                </span>
                <span className="gl-wsp-badges">
                    {status && (
                        <span className="gl-wsp-badge is-warn"><PauseCircle size={11} /> {STATUS_LABEL[status] || status}</span>
                    )}
                    <span data-testid="ws-role" className={`gl-wsp-badge is-${role}`}>
                        <RoleIcon size={11} /> {ROLE_LABEL[role] || 'Member'}
                    </span>
                </span>
            </div>

            <h3 className="gl-wsp-card__name">{ws.name}</h3>
            {ws.description && <p className="gl-wsp-card__desc">{ws.description}</p>}

            <div className="gl-wsp-card__meta">
                <span><Users size={12} /> {members} member{members !== 1 && 's'}</span>
                {unread > 0 && (
                    <span className="is-unread" title="Unread notifications"><Bell size={12} /> {unread > 99 ? '99+' : unread} unread</span>
                )}
            </div>

            <div className="gl-wsp-card__foot">
                <span>{ws.isOwner ? 'Created by you' : ws.ownerName && ws.ownerName !== 'Unknown' ? `Owned by ${ws.ownerName}` : 'Workspace'}</span>
                <span className="gl-wsp-card__open">Open <ArrowRight size={13} /></span>
            </div>
        </button>
    );
}

export function CreateTile({ user, workspaces, onCreateClick }) {
    const { isLimitReached, isCompanyMember, companyName } = getCreatePolicy(user, workspaces);

    if (isCompanyMember) {
        return (
            <div className="gl-wsp-create is-locked" aria-disabled="true">
                <span className="gl-wsp-create__mark"><Lock size={18} /></span>
                <span className="gl-wsp-create__title">Create Workspace</span>
                <span className="gl-wsp-create__text">
                    Only admins &amp; owners can create workspaces in <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{companyName}</strong>.
                </span>
                <span className="gl-wsp-create__hint"><Shield size={11} /> Contact your Admin or Owner</span>
            </div>
        );
    }

    return (
        <button type="button" className="gl-wsp-create" onClick={() => { if (!isLimitReached) onCreateClick(); }} disabled={isLimitReached}>
            <span className="gl-wsp-create__mark">{isLimitReached ? <Shield size={18} /> : <Plus size={20} />}</span>
            <span className="gl-wsp-create__title">{isLimitReached ? 'Plan Limit Reached' : 'Create New Workspace'}</span>
            <span className="gl-wsp-create__text">
                {isLimitReached ? 'You have reached the limit of 3 workspaces on the personal plan.' : 'Start a new project or team'}
            </span>
        </button>
    );
}

const WorkspaceGrid = ({ workspaces, allWorkspaces = workspaces, query = '', unreadByWs = {}, onWorkspaceClick, onCreateClick, onClearSearch, user }) => (
    <div className="gl-wsp-grid">
        {workspaces.map(ws => (
            <WorkspaceCard key={ws.id} ws={ws} unread={unreadByWs[String(ws.id)] || 0} onOpen={onWorkspaceClick} />
        ))}

        {query && workspaces.length === 0 && (
            <div className="gl-card gl-empty gl-wsp-noresults">
                <span className="gl-empty-mark"><SearchX size={18} /></span>
                <p className="gl-empty-title">No workspaces match “{query}”</p>
                <p className="gl-empty-text">Check the spelling, or clear the search to see all of them.</p>
                <button type="button" className="gl-btn gl-btn--sm" style={{ marginTop: 8 }} onClick={onClearSearch}>Clear search</button>
            </div>
        )}

        {!query && <CreateTile user={user} workspaces={allWorkspaces} onCreateClick={onCreateClick} />}
    </div>
);

export default WorkspaceGrid;

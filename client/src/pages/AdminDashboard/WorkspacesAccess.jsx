import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { Panel, Btn, Chip, EmptyState, ErrorState, LoadingState } from '../../components/company-dash/dashUi';
import '../admin/admin.css';

/** Company workspaces with department and active member counts. */
const WorkspacesAccess = ({ data, loading, error, onRetry }) => {
    const navigate = useNavigate();
    const workspaces = data?.workspaces || [];

    return (
        <Panel
            title="Workspaces"
            icon={Briefcase}
            flush
            action={<Btn size="sm" variant="ghost" onClick={() => navigate('/admin/workspaces')}>Manage</Btn>}
        >
            {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState /> : workspaces.length === 0 ? (
                <EmptyState icon={Briefcase} title="No workspaces yet" text="Workspaces created in the company appear here." />
            ) : (
                <div className="cd-list">
                    {workspaces.map((ws) => {
                        const active = (ws.members || []).filter((m) => !m.status || m.status === 'active').length;
                        return (
                            <button
                                type="button"
                                className="cd-list-row ad-rowbtn"
                                key={ws._id}
                                onClick={() => navigate('/admin/workspaces')}
                            >
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{ws.name}</div>
                                    <div className="cd-cell-sub">{ws.department?.name || 'Company-wide'}{ws.isArchived ? ' · archived' : ''}</div>
                                </div>
                                <Chip>{active} {active === 1 ? 'member' : 'members'}</Chip>
                            </button>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
};

export default WorkspacesAccess;

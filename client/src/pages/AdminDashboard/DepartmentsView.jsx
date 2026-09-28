import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building } from 'lucide-react';
import { Panel, Btn, Chip, EmptyState, ErrorState, LoadingState } from '../../components/company-dash/dashUi';

/** Departments with their managers and headcount. */
const DepartmentsView = ({ data, loading, error, onRetry }) => {
    const navigate = useNavigate();
    const departments = data?.departments || [];

    return (
        <Panel
            title="Departments"
            icon={Building}
            flush
            action={<Btn size="sm" variant="ghost" onClick={() => navigate('/admin/departments')}>Manage</Btn>}
        >
            {error ? <ErrorState message={error} onRetry={onRetry} /> : loading ? <LoadingState /> : departments.length === 0 ? (
                <EmptyState
                    icon={Building}
                    title="No departments yet"
                    text="Group people into departments to give managers a scope."
                    action={<Btn size="sm" onClick={() => navigate('/admin/departments')}>Create department</Btn>}
                />
            ) : (
                <div className="cd-list">
                    {departments.map((d) => {
                        const managers = (d.managers || []).map((m) => m?.username).filter(Boolean);
                        const count = d.userCount ?? d.members?.length ?? 0;
                        return (
                            <div className="cd-list-row" key={d._id}>
                                <div className="cd-grow">
                                    <div className="cd-cell-title">{d.name}</div>
                                    <div className="cd-cell-sub">{managers.length ? `Managed by ${managers.join(', ')}` : 'No manager assigned'}</div>
                                </div>
                                <Chip>{count} {count === 1 ? 'person' : 'people'}</Chip>
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
};

export default DepartmentsView;

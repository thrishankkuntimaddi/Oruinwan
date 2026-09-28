import React from 'react';
import { Users, Pencil, Trash2 } from 'lucide-react';
import { IconBtn } from '../company-dash/dashUi';
import '../../pages/admin/admin.css';

/** Department summary card with optional edit / delete. */
const DepartmentCard = ({ department, onEdit, onDelete, onClick }) => (
    <article className={`gl-card ad-card${onClick ? ' gl-card--interactive' : ''}`} onClick={onClick}>
        <div className="ad-card-head">
            <div style={{ minWidth: 0, flex: 1 }}>
                <h3 className="ad-card-title">{department.name}</h3>
                {department.description && <p className="ad-card-desc">{department.description}</p>}
            </div>
            {onEdit && <IconBtn label={`Edit ${department.name}`} onClick={(e) => { e.stopPropagation(); onEdit(department); }}><Pencil size={14} /></IconBtn>}
            {onDelete && <IconBtn label={`Delete ${department.name}`} className="cd-btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(department); }}><Trash2 size={14} /></IconBtn>}
        </div>
        <div className="ad-card-stats">
            <span><Users size={12} style={{ verticalAlign: '-2px' }} /> <strong>{department.memberCount ?? department.members?.length ?? 0}</strong> members</span>
            {department.workspaceCount > 0 && <span><strong>{department.workspaceCount}</strong> workspace{department.workspaceCount > 1 ? 's' : ''}</span>}
        </div>
    </article>
);

export default DepartmentCard;

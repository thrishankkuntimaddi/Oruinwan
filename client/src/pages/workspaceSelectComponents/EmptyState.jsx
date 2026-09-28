import React from 'react';
import { Plus, Link2, Layers, Lock } from 'lucide-react';

/** No workspaces yet: invite the user to create one (or join via an invite). */
const EmptyState = ({ canCreate, isCompanyMember, isLimitReached, companyName, onCreateClick, onJoinClick }) => (
    <section className="gl-card gl-wsp-empty" aria-labelledby="gl-wsp-empty-title">
        <div className="gl-wsp-empty__mark">{isCompanyMember ? <Lock size={26} /> : <Layers size={26} />}</div>
        <h2 id="gl-wsp-empty-title" className="gl-wsp-empty__title">
            {isCompanyMember ? 'No workspaces yet' : 'Your first workspace starts here'}
        </h2>
        <p className="gl-wsp-empty__text">
            {isCompanyMember
                ? <>Workspaces in {companyName} are created by admins and owners. Ask one of them to add you, or open an invite link you’ve received.</>
                : isLimitReached
                    ? 'You have reached the limit of 3 workspaces on the personal plan.'
                    : 'A workspace is home for a team: channels, direct messages, tasks, notes and files in one place.'}
        </p>
        <div className="gl-wsp-empty__actions">
            {canCreate && (
                <button type="button" className="gl-btn gl-btn--primary gl-btn--lg" onClick={onCreateClick}>
                    <Plus size={16} /> Create New Workspace
                </button>
            )}
            <button type="button" className="gl-btn gl-btn--lg" onClick={onJoinClick}>
                <Link2 size={15} /> Join with invite
            </button>
        </div>
        {canCreate && (
            <div className="gl-wsp-empty__steps">
                <div className="gl-wsp-empty__step"><b>01</b><span>Name it and pick an icon and colour.</span></div>
                <div className="gl-wsp-empty__step"><b>02</b><span>Confirm you as the owner.</span></div>
                <div className="gl-wsp-empty__step"><b>03</b><span>Invite your team, now or later.</span></div>
            </div>
        )}
    </section>
);

export default EmptyState;

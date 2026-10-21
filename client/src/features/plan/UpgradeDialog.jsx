import React from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, Btn } from '../../components/ui/page';
import { COMING_SOON_LINE, UPGRADE_TITLE } from './planLimit';
import './plan.css';

/**
 * "Free plan limit reached": the server's message, the coming-soon line,
 * "See plans" (→ /pricing) and "Close". Presentational; PlanLimitProvider opens it.
 */
export default function UpgradeDialog({ open, message, onSeePlans, onClose }) {
    return (
        <Dialog
            open={open}
            title={UPGRADE_TITLE}
            onClose={onClose}
            size="sm"
            footer={(
                <>
                    <Btn variant="ghost" onClick={onClose}>Close</Btn>
                    <Btn variant="primary" icon={Sparkles} onClick={onSeePlans} data-autofocus="true">See plans</Btn>
                </>
            )}
        >
            <div className="pl-upgrade" data-testid="plan-upgrade-dialog">
                <p className="pl-upgrade-message">{message}</p>
                {!String(message || '').includes(COMING_SOON_LINE) && (
                    <p className="pl-upgrade-soon">{COMING_SOON_LINE}</p>
                )}
            </div>
        </Dialog>
    );
}

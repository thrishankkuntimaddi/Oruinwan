import React from 'react';
import { ArrowRightLeft, PhoneCall } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import { callTitle } from '../HuddleContext';
import { deviceLabel } from '../callDevice';

/** "in #general", "in a direct message", "in a call". */
export function whereText(current) {
    if (!current) return 'in a call';
    if (current.channelName) return `in ${callTitle({ channelName: current.channelName })}`;
    if (current.dmId) return 'in a direct message call';
    return 'in a call';
}

/** The words of a "switch?" / "move here?" question. */
export function conflictText(conflict) {
    const c = conflict?.current;
    if (conflict?.kind === 'move') {
        return {
            title: 'Move the call here?',
            body: `You're in this call on ${deviceLabel(c?.device)}. Move it to this device? There may be a second of silence while it connects.`,
            yes: 'Move here',
            no: 'Not now',
        };
    }
    const where = whereText(c);
    const on = c?.here ? '' : ` on ${deviceLabel(c?.device)}`;
    return {
        title: 'Switch calls?',
        body: `You're already ${where}${on}. Leave it and join this one?`,
        yes: 'Switch',
        no: 'Stay',
    };
}

/** Asked before a second call, or before taking over a call from another device. */
export function ConflictDialog({ conflict, onAnswer }) {
    if (!conflict) return null;
    const t = conflictText(conflict);
    return (
        <Modal
            isOpen
            size="sm"
            title={t.title}
            onClose={() => onAnswer(false)}
            footer={(
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="gl-btn" data-testid="call-conflict-no" onClick={() => onAnswer(false)}>{t.no}</button>
                    <button type="button" className="gl-btn gl-btn--primary" data-testid="call-conflict-yes" onClick={() => onAnswer(true)}>{t.yes}</button>
                </div>
            )}
        >
            <p data-testid="call-conflict" style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{t.body}</p>
        </Modal>
    );
}

/** "In a call on your phone · Move here", while my call runs on another device. */
export function ElsewherePill({ call, onMove }) {
    if (!call) return null;
    return (
        <div className="hw-pill cs-elsewhere" data-testid="call-elsewhere" role="region" aria-label="You are in a call on another device">
            <PhoneCall size={14} className="cs-success" />
            <span className="hw-pill-title">In a call on {deviceLabel(call.device)}</span>
            <button type="button" className="gl-btn gl-btn--primary gl-btn--sm" data-testid="call-move-here" onClick={onMove}>
                <ArrowRightLeft size={13} /> Move here
            </button>
        </div>
    );
}

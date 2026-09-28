import React from 'react';
import { Activity } from 'lucide-react';
import { Panel, Meter } from '../company-dash/dashUi';

/**
 * Small metric list with bars. It used to show invented numbers (2.4h, 94%,
 * 99.9%); now it only renders what the caller passes:
 *   metrics = [{ label, value: '2.4h', percent: 75, tone }]
 */
const PulseWidget = ({ className = '', title = 'Pulse', metrics = [] }) => {
    if (!metrics.length) return null;
    return (
        <Panel title={title} icon={Activity} className={className}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metrics.map((m) => (
                    <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span className="cd-muted">{m.label}</span>
                            <strong>{m.value}</strong>
                        </div>
                        {m.percent !== undefined && <Meter value={m.percent} tone={m.tone} label={m.label} />}
                    </div>
                ))}
            </div>
        </Panel>
    );
};

export default PulseWidget;

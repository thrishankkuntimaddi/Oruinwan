import React, { useContext } from 'react';
import { Headphones } from 'lucide-react';
import { HuddleContext } from '../HuddleContext';

/** A "huddle live here" marker for a channel or DM row in the sidebar lists. */
export default function LiveHuddleMark({ channelId, dmId, size = 12 }) {
    const ctx = useContext(HuddleContext);
    const live = (ctx?.liveHuddles || []).find(h => (channelId ? String(h.channelId) === String(channelId) : dmId && String(h.dmId) === String(dmId)));
    if (!live) return null;
    const people = live.participants?.length || 0;
    const label = people ? `Huddle live · ${people} in it` : 'Huddle live';
    return (
        <span data-testid="live-huddle-mark" title={label} aria-label={label}
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: 'var(--state-success)', marginLeft: 'auto' }}>
            <Headphones size={size} strokeWidth={2.4} />
        </span>
    );
}

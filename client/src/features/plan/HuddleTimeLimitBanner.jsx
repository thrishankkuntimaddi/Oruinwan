import React, { useContext, useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { HuddleContext } from '../huddles/HuddleContext';
import { useOptionalSocket } from '../../contexts/SocketContext';
import './plan.css';

export const TIME_LIMIT_ENDED_MESSAGE = "This call ended at the free plan's 30-minute limit. Your notes are saved in the meeting notes.";

/** Banner text for a huddle:time_warning payload. */
export function timeWarningText(payload) {
    const max = payload?.maxMinutes || 30;
    const left = payload?.minutesLeft;
    if (left === 1) return `1 minute left — free plan calls end at ${max} minutes`;
    return `${left || 5} minutes left — free plan calls end at ${max} minutes`;
}

/** "4:32" until `endsAt` (null when unknown or past). */
export function timeLeftLabel(endsAt, now = Date.now()) {
    if (!endsAt) return null;
    const ms = new Date(endsAt).getTime() - now;
    if (Number.isNaN(ms) || ms <= 0) return null;
    const secs = Math.ceil(ms / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/**
 * Free plan call length: a banner at 25 and 29 minutes (`huddle:time_warning`)
 * with a live countdown, and a clear message when the server ends the call at
 * the limit (`huddle:ended` reason 'time_limit'). Lives beside the app-wide call.
 */
export default function HuddleTimeLimitBanner() {
    const ctx = useContext(HuddleContext);
    const socket = useOptionalSocket()?.socket || null;
    const [warning, setWarning] = useState(null); // { huddleId, text, endsAt }
    const [ended, setEnded] = useState(null); // message
    const [now, setNow] = useState(Date.now());
    const mine = useRef(new Set());
    const endsAtRef = useRef({}); // huddleId -> endsAt from huddle:roster timeLimit

    const currentId = ctx?.active ? ctx.huddleId : null;
    useEffect(() => { if (currentId) mine.current.add(String(currentId)); }, [currentId]);

    useEffect(() => {
        if (!socket) return undefined;
        const onRoster = ({ huddleId, timeLimit } = {}) => {
            if (!huddleId) return;
            mine.current.add(String(huddleId));
            if (timeLimit?.endsAt) endsAtRef.current[String(huddleId)] = timeLimit.endsAt;
        };
        const onWarning = (payload = {}) => {
            const id = String(payload.huddleId || '');
            if (id) mine.current.add(id);
            setEnded(null);
            setWarning({ huddleId: id, text: payload.message && !payload.minutesLeft ? payload.message : timeWarningText(payload), endsAt: payload.endsAt || endsAtRef.current[id] || null });
        };
        const onEnded = ({ huddleId, reason, message } = {}) => {
            const id = String(huddleId || '');
            if (!mine.current.has(id)) return;
            setWarning((w) => (w && (!w.huddleId || w.huddleId === id) ? null : w));
            if (reason === 'time_limit') setEnded(message || TIME_LIMIT_ENDED_MESSAGE);
            mine.current.delete(id);
            delete endsAtRef.current[id];
        };
        socket.on('huddle:roster', onRoster);
        socket.on('huddle:time_warning', onWarning);
        socket.on('huddle:ended', onEnded);
        return () => {
            socket.off('huddle:roster', onRoster);
            socket.off('huddle:time_warning', onWarning);
            socket.off('huddle:ended', onEnded);
        };
    }, [socket]);

    // Leaving the call yourself clears the warning.
    useEffect(() => { if (!currentId) setWarning(null); }, [currentId]);

    useEffect(() => {
        if (!warning?.endsAt) return undefined;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [warning?.endsAt]);

    if (ended) {
        return (
            <div className="pl-time-banner gl-liquid gl-liquid--strong" role="status" data-testid="huddle-time-ended">
                <span className="pl-time-banner-icon"><Clock size={15} /></span>
                <span className="pl-time-banner-text">{ended}</span>
                <button type="button" className="gl-icon-btn" aria-label="Dismiss" title="Dismiss" onClick={() => setEnded(null)}><X size={14} /></button>
            </div>
        );
    }
    if (!warning) return null;
    const left = timeLeftLabel(warning.endsAt, now);
    return (
        <div className="pl-time-banner gl-liquid gl-liquid--strong" role="status" aria-live="polite" data-testid="huddle-time-warning"
            data-tone={/^1 minute/.test(warning.text) ? 'danger' : undefined}>
            <span className="pl-time-banner-icon"><Clock size={15} /></span>
            <span className="pl-time-banner-text">
                {warning.text}
                {left && <span className="pl-time-banner-left">· {left}</span>}
            </span>
            <button type="button" className="gl-icon-btn" aria-label="Dismiss" title="Dismiss" onClick={() => setWarning(null)}><X size={14} /></button>
        </div>
    );
}

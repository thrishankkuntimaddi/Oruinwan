import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import { toggleHelp, useHelpState, useHelpEntryPoint } from './helpStore';

/**
 * Opens Oruinwan Help: article search, topics, keyboard shortcuts, what's new,
 * contact support and your requests. Also enables the "?" shortcut while mounted.
 * Props: `className` (defaults to the gloss icon button), `size` (icon size).
 */
export default function HelpButton({ className = 'gl-icon-btn', size = 18 }) {
    const navigate = useNavigate();
    const { open } = useHelpState();
    useHelpEntryPoint(navigate);

    return (
        <button
            type="button"
            className={className}
            onClick={() => toggleHelp()}
            title="Help (?)"
            aria-label="Help"
            aria-haspopup="dialog"
            aria-expanded={open}
        >
            <CircleHelp size={size} aria-hidden="true" />
        </button>
    );
}

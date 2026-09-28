import React from 'react';
import { createRoot } from 'react-dom/client';
import HelpPanel from './HelpPanel';

let root = null;

/** Mounts the Help panel in its own root on <body> (once). */
export function mountHelpHost() {
    if (root) return root;
    const node = document.createElement('div');
    node.id = 'oruinwan-help-root';
    document.body.appendChild(node);
    root = createRoot(node);
    root.render(<HelpPanel />);
    return root;
}

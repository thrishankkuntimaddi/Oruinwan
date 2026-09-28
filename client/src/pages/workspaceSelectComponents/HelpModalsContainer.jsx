import { useEffect } from 'react';
import { openHelp } from '../../components/help/helpStore';

/**
 * Deprecated: the /workspaces page now uses <HelpButton /> (components/help).
 * Kept as a thin adapter so any old caller opens the shared Help panel instead
 * of the placeholder modals that used to live here.
 */
const VIEWS = {
    academy: { view: 'home' },
    shortcuts: { view: 'shortcuts' },
    whatsnew: { view: 'whatsnew' },
    bug: { view: 'contact', category: 'problem' },
    contact: { view: 'contact', category: 'question' },
};

const HelpModalsContainer = ({ activeModal, onClose }) => {
    useEffect(() => {
        if (!activeModal) return;
        openHelp(VIEWS[activeModal] || { view: 'home' });
        onClose?.();
    }, [activeModal, onClose]);
    return null;
};

export default HelpModalsContainer;

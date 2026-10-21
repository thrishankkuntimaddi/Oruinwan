import { FileText, Lightbulb, Users, ClipboardList, FolderKanban, Cpu, Megaphone } from 'lucide-react';

/**
 * Note type → icon + label: the one set of type names used by the editor header, the notes
 * home, the Notes side panel and (mirrored in mobile/src/data/constants.js) the phone app.
 * `documentation` is an older alias of `note` and shows as "Document" too.
 */
export const NOTE_TYPE_CONFIG = {
    note: { Icon: FileText, label: 'Document' },
    documentation: { Icon: FileText, label: 'Document' },
    brainstorm: { Icon: Lightbulb, label: 'Brainstorm' },
    meeting: { Icon: Users, label: 'Meeting' },
    sop: { Icon: ClipboardList, label: 'SOP' },
    projectspec: { Icon: FolderKanban, label: 'Project spec' },
    techdesign: { Icon: Cpu, label: 'Tech design' },
    announcement: { Icon: Megaphone, label: 'Announcement' },
};

export const noteTypeOf = (type) => NOTE_TYPE_CONFIG[type] || NOTE_TYPE_CONFIG.note;

/** The type a note is listed under ("documentation" and unknown types count as "note"). */
export const noteTypeGroup = (type) => (type && type !== 'documentation' && NOTE_TYPE_CONFIG[type] ? type : 'note');

/** Distinct types for lists and pickers (no aliases), in display order. */
export const NOTE_TYPE_LIST = Object.entries(NOTE_TYPE_CONFIG)
    .filter(([id]) => id !== 'documentation')
    .map(([id, conf]) => ({ id, ...conf }));

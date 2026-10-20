import { FileText, Lightbulb, Users, ClipboardList, FolderKanban, Cpu, Megaphone } from 'lucide-react';

/** Note type → icon + label, shared by the editor header and the notes home. */
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

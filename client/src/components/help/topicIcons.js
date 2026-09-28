import {
    Rocket, MessageSquare, Sparkles, CheckSquare, NotebookPen, Headphones,
    FolderOpen, Bell, ShieldCheck, UserCog,
} from 'lucide-react';

/** Icon per help topic id (see content/helpArticles.js). */
export const TOPIC_ICONS = {
    'getting-started': Rocket,
    messaging: MessageSquare,
    ai: Sparkles,
    tasks: CheckSquare,
    notes: NotebookPen,
    huddles: Headphones,
    files: FolderOpen,
    notifications: Bell,
    security: ShieldCheck,
    account: UserCog,
};

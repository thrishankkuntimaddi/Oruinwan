import React from 'react';
import {
    Rocket, Briefcase, Zap, Palette, Microscope, Globe, Shield, TrendingUp,
    Lightbulb, Flame, Target, Trophy, Sparkles, Folder,
} from 'lucide-react';

/**
 * The one workspace icon set (create modal, settings, sidebar, /workspaces grid).
 * Workspaces store the option `id`; older rows used a few other spellings
 * (aliases below) and the server default is the 📁 emoji.
 */
export const WORKSPACE_ICON_OPTIONS = [
    { id: 'rocket',     name: 'Rocket',     Icon: Rocket },
    { id: 'briefcase',  name: 'Briefcase',  Icon: Briefcase },
    { id: 'zap',        name: 'Zap',        Icon: Zap },
    { id: 'palette',    name: 'Palette',    Icon: Palette },
    { id: 'microscope', name: 'Microscope', Icon: Microscope },
    { id: 'globe',      name: 'Globe',      Icon: Globe },
    { id: 'shield',     name: 'Shield',     Icon: Shield },
    { id: 'trending',   name: 'Trending',   Icon: TrendingUp },
    { id: 'lightbulb',  name: 'Lightbulb',  Icon: Lightbulb },
    { id: 'flame',      name: 'Flame',      Icon: Flame },
    { id: 'target',     name: 'Target',     Icon: Target },
    { id: 'trophy',     name: 'Trophy',     Icon: Trophy },
    { id: 'sparkles',   name: 'Sparkles',   Icon: Sparkles },
];

const BY_ID = Object.fromEntries(WORKSPACE_ICON_OPTIONS.map((o) => [o.id, o.Icon]));
const ALIASES = {
    flask: Microscope,
    trend: TrendingUp,
    trendingUp: TrendingUp,
    bulb: Lightbulb,
    '🚀': Rocket,
    '📁': Folder,
    folder: Folder,
};

export const DEFAULT_WORKSPACE_ICON = 'folder';

// Brand accent first (the default), then a few distinct team colours.
export const WORKSPACE_COLORS = ['#b8956a', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#5c5852', '#14b8a6', '#f43f5e'];
export const DEFAULT_WORKSPACE_COLOR = WORKSPACE_COLORS[0];

/** Lucide component for a stored icon value (unknown values fall back to a folder). */
export function workspaceIconComponent(icon) {
    return BY_ID[icon] || ALIASES[icon] || Folder;
}

/** True when the stored value is a custom emoji we should render as text. */
function isCustomEmoji(icon) {
    return typeof icon === 'string' && icon.length > 0 && icon.length <= 8
        && !BY_ID[icon] && !ALIASES[icon] && /\p{Extended_Pictographic}/u.test(icon);
}

/** Renders a workspace's icon at the given size. */
export function WorkspaceIcon({ icon, size = 18, strokeWidth, style }) {
    if (isCustomEmoji(icon)) {
        return <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.95), lineHeight: 1, ...style }}>{icon}</span>;
    }
    const Cmp = workspaceIconComponent(icon);
    return <Cmp size={size} strokeWidth={strokeWidth} style={style} />;
}

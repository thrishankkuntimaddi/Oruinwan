// The first-run tour: which steps, when it starts on its own, where its card goes, and a tiny
// store so "Take the tour again" (Help) can open it from anywhere. The UI is FirstRunTour.jsx.
//
// Shown once per account: preferences.tour.done is saved on the server (PUT /api/auth/me), so
// finishing or skipping on one device hides it on the others (the phone app reads the same flag).

/** Each step points at an element marked data-tour="<target>"; none (or hidden) = centred card. */
export const TOUR_STEPS = [
    { target: 'workspace', title: 'Your workspace', body: 'Switch between workspaces, or create a new one, from here.' },
    { target: 'channels', title: 'Channels', body: 'Conversations for a team or topic that everyone in the workspace can join.' },
    { target: 'messages', title: 'Direct messages', body: 'Private chats with one person or a small group. Start one with the pen icon on Home.' },
    { target: 'search', title: 'Search everything', body: 'Find messages, files and people. Press ⌘K (Ctrl+K) from anywhere.' },
    { target: 'agents', title: 'Agents & tools', body: 'Chat with Claude or other AI agents, run workflows and connect your apps.' },
    // Huddles can be switched off by the workspace admins: when the side rail is on screen (its
    // Agents button is) but Huddles isn't, the step is left out.
    { target: 'huddles', title: 'Huddles', body: 'Start a quick voice or video call with your team.', optionalBeside: 'agents' },
    { target: 'profile', title: 'You’re all set', body: 'Your profile and settings live here. You can take this tour again any time from Help.' },
];

/** True once the account finished or skipped the tour (on any device). */
export const tourDone = (user) => user?.preferences?.tour?.done === true;

/**
 * Whether the tour should open by itself now: a signed-in account that hasn't seen it, inside a
 * workspace, with nothing blocking in front (the unlock-encryption dialog, the create-workspace
 * wizard, any other modal), and not already closed in this session (in case saving failed).
 */
export function shouldAutoStart({ user, workspaceId, blocked = false, closedThisSession = false }) {
    if (!user || !workspaceId || blocked || closedThisSession) return false;
    return !tourDone(user);
}

/**
 * The steps to show. A step with `optionalBeside` is dropped when that neighbour is on screen but
 * the step's own element isn't (the feature is switched off). When neither is on screen (a
 * phone-sized layout without the rail) it stays, as a centred card like the others.
 */
export function visibleSteps(steps, isVisible) {
    return steps.filter((s) => !s.optionalBeside || isVisible(s.target) || !isVisible(s.optionalBeside));
}

/** Next index for 'next' | 'back'; null when moving past the last step (= finished). */
export function moveStep(index, count, dir) {
    if (dir === 'back') return Math.max(0, index - 1);
    return index + 1 >= count ? null : index + 1;
}

/**
 * Where the card goes beside a highlighted rect: right of it (the side rail), else below, above,
 * left; clamped inside the viewport with a margin. No rect = centred.
 * rect/card: { top, left, width, height } / { width, height }; viewport: { width, height }.
 */
export function placeCard(rect, card, viewport, gap = 14, margin = 12) {
    const clampX = (x) => Math.max(margin, Math.min(x, viewport.width - card.width - margin));
    const clampY = (y) => Math.max(margin, Math.min(y, viewport.height - card.height - margin));
    if (!rect) {
        return { placement: 'center', top: clampY((viewport.height - card.height) / 2), left: clampX((viewport.width - card.width) / 2) };
    }
    const right = rect.left + rect.width + gap;
    const below = rect.top + rect.height + gap;
    const above = rect.top - gap - card.height;
    const left = rect.left - gap - card.width;
    if (right + card.width + margin <= viewport.width) return { placement: 'right', left: right, top: clampY(rect.top + rect.height / 2 - card.height / 2) };
    if (below + card.height + margin <= viewport.height) return { placement: 'bottom', top: below, left: clampX(rect.left + rect.width / 2 - card.width / 2) };
    if (above >= margin) return { placement: 'top', top: above, left: clampX(rect.left + rect.width / 2 - card.width / 2) };
    if (left >= margin) return { placement: 'left', left, top: clampY(rect.top + rect.height / 2 - card.height / 2) };
    return { placement: 'center', top: clampY((viewport.height - card.height) / 2), left: clampX((viewport.width - card.width) / 2) };
}

// ── Store: open/closed, shared by the tour UI and "Take the tour again" ──
let state = { open: false, replay: false, closedThisSession: false };
const listeners = new Set();
const set = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
};

export const tourStore = {
    get: () => state,
    subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
    /** Opens the tour (from Help, or automatically). `replay` = asked for again from Help. */
    start({ replay = false } = {}) {
        set({ open: true, replay });
    },
    close() {
        set({ open: false, replay: false, closedThisSession: true });
    },
    /** Tests only. */
    reset() {
        state = { open: false, replay: false, closedThisSession: false };
    },
};

/** "Take the tour again" in Help. */
export const startTour = () => tourStore.start({ replay: true });

// Lets the profile popover put an @mention chip into the right message box.
// Composers (FooterInput) mark their root with `data-composer-root` and listen
// for COMPOSER_MENTION_EVENT on it. A mention clicked inside a thread goes to
// that thread's composer; anywhere else it goes to the conversation's composer.

export const COMPOSER_MENTION_EVENT = 'oruinwan:composer:mention';
const THREAD_SCOPE = '[data-testid="thread-panel"]';

/** The composer root element a mention seen at `anchor` should go to, or null. */
export function findComposerFor(anchor) {
    if (typeof document === 'undefined') return null;
    const all = Array.from(document.querySelectorAll('[data-composer-root]'));
    if (!all.length) return null;

    const thread = anchor?.closest?.(THREAD_SCOPE);
    if (thread) {
        const inThread = all.find((c) => thread.contains(c));
        if (inThread) return inThread;
    }
    const main = all.filter((c) => !c.closest(THREAD_SCOPE));
    const pool = main.length ? main : all;
    // Prefer the composer closest to the anchor in the tree (same chat column).
    for (let el = anchor?.parentElement; el; el = el.parentElement) {
        const hit = pool.find((c) => el.contains(c));
        if (hit) return hit;
    }
    return pool[pool.length - 1];
}

/** Insert "@username" as a chip into the composer for `anchor`. Returns false when there is none. */
export function insertMentionIntoComposer(username, anchor) {
    const target = findComposerFor(anchor);
    if (!target || !username) return false;
    target.dispatchEvent(new CustomEvent(COMPOSER_MENTION_EVENT, { detail: { username } }));
    return true;
}

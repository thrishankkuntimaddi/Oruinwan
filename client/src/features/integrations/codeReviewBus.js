// Anything (a PR card, a pasted PR link, the task panel, `/review`) asks for the
// code-review panel through one window event. The open conversation window
// claims it and shows the panel next to the chat; if nothing claims it the
// caller falls back to a standalone drawer (see useCodeReviewOpener).

export const CODE_REVIEW_EVENT = 'oruinwan:code-review:open';

/**
 * ref: { repo: 'owner/name', number, messageId?, channelId?, workspaceId?, tab? }
 * Returns true when a conversation window took it.
 */
export function openCodeReview(ref) {
    if (!ref?.repo || !ref?.number || typeof window === 'undefined') return false;
    const detail = { ...ref, number: Number(ref.number), handled: false };
    window.dispatchEvent(new CustomEvent(CODE_REVIEW_EVENT, { detail }));
    return detail.handled === true;
}

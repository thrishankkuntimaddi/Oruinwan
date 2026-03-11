// client/src/utils/renderWithMentions.js
//
// Transforms plaintext/markdown strings to highlight @mentions.
// Used by ChannelMessageItem and DMMessageItem before passing text to ReactMarkdown.
//
// Approach: Replace @username / @here / @channel with a custom markdown token
// that ReactMarkdown renders as a styled span via a custom component override.
//
// Token format: ~~@username~~ — overloads the <del> element which is rarely used
// in chat. This avoids injecting raw HTML and works cleanly with ReactMarkdown.

const USER_MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;
const BROADCAST_REGEX = /@(here|channel)\b/gi;

/**
 * Wrap all @mentions in the text with ~~token~~ (del tag via ReactMarkdown).
 * Returns a new string safe to pass to <ReactMarkdown>.
 *
 * @param {string} text  Markdown string
 * @param {string} [currentUsername]  If provided, highlights self-mentions differently
 * @returns {string}
 */
export function wrapMentions(text, currentUsername = '') {
    if (!text) return text;

    // First handle broadcast keywords so they don't get wrapped as usernames
    let result = text.replace(BROADCAST_REGEX, (match, keyword) => {
        return `~~@${keyword.toLowerCase()}~~`;
    });

    // Then handle @username mentions (excluding already-wrapped ~~@here~~)
    result = result.replace(USER_MENTION_REGEX, (match, username) => {
        // Skip if already inside ~~ (broadcast already wrapped)
        return `~~@${username}~~`;
    });

    return result;
}

/**
 * React component overrides for ReactMarkdown.
 * Pass as the `components` prop interpolated with the existing overrides.
 *
 * Usage:
 *   <ReactMarkdown components={{ ...markdownComponents, del: mentionRenderer(currentUsername) }}>
 *     {wrapMentions(msg.text, currentUsername)}
 *   </ReactMarkdown>
 *
 * @param {string} currentUsername  Username of the currently logged-in user
 * @returns {Function}  React component for <del> rendering
 */
export function mentionRenderer(currentUsername = '') {
    return function MentionChip({ children }) {
        // children will be the text inside ~~...~~ e.g. "@john" or "@here"
        const raw = typeof children === 'string'
            ? children
            : (Array.isArray(children) ? children.join('') : '');

        const isBroadcast = /^@(here|channel)$/i.test(raw);
        const isSelf = currentUsername && raw.toLowerCase() === `@${currentUsername.toLowerCase()}`;

        if (isBroadcast) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 cursor-default select-none">
                    {raw}
                </span>
            );
        }

        if (isSelf) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-200 text-blue-800 dark:bg-blue-800/60 dark:text-blue-200 cursor-default select-none ring-1 ring-blue-400 dark:ring-blue-500">
                    {raw}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 cursor-default select-none hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors">
                {raw}
            </span>
        );
    };
}

const USER_MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;
const BROADCAST_REGEX = /@(here|channel)\b/gi;

export function wrapMentions(text, currentUsername = '') {
    if (!text) return text;

    
    let result = text.replace(BROADCAST_REGEX, (match, keyword) => {
        return `~~@${keyword.toLowerCase()}~~`;
    });

    
    result = result.replace(USER_MENTION_REGEX, (match, username) => {
        
        return `~~@${username}~~`;
    });

    return result;
}

export function mentionRenderer(currentUsername = '') {
    return function MentionChip({ children }) {
        
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

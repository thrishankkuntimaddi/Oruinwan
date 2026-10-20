/**
 * Turns "Website redesign!" into "website-redesign": the channel the server creates for a
 * project. Keep in step with projectChannelName in server/src/features/workspaces/workspace.controller.js.
 */
export function projectChannelName(project) {
    return String(project || '')
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 60)
        .replace(/[-_]+$/g, '');
}

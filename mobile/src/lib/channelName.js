/**
 * Turns "Website redesign!" into "website-redesign": the channel the server creates for a
 * project. Same rule as server/src/features/workspaces/workspace.controller.js projectChannelName.
 */
export function projectChannelName(project) {
  return String(project || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 60)
    .replace(/[-_]+$/g, '');
}

/** The channels a new workspace starts with: #general, #random and the project's channel. */
export function startingChannels(project) {
  const name = projectChannelName(project);
  return ['general', 'random', ...(name && !['general', 'random'].includes(name) ? [name] : [])];
}

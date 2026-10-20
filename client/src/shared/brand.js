// Single source of truth for user-facing brand strings.
// Some internal identifiers keep a legacy `chttrix` prefix (roles like `chttrix_admin`, storage
// keys, webhook headers) because renaming them would break existing data and integrations.
// Old `/chttrix-admin` and `/chttrix-docs` URLs redirect.
export const BRAND = {
    name: 'Oruinwan',
    company: 'Oruinwan Inc.',
    ai: 'Oruinwan AI',
    tagline: 'The collaboration platform for teams that ship.',
    description: 'Oruinwan brings channels, DMs, huddles, tasks, notes and AI into one encrypted workspace.',
    year: new Date().getFullYear(),
};

export default BRAND;

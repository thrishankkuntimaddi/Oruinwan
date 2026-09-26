// Single source of truth for user-facing brand strings.
// The product was previously called "Chttrix"; internal identifiers (roles like
// `chttrix_admin`, storage keys) are unchanged. Old `/chttrix-admin` and `/chttrix-docs` URLs redirect.
export const BRAND = {
    name: 'Oruinwan',
    company: 'Oruinwan Inc.',
    ai: 'Oruinwan AI',
    formerName: 'Chttrix',
    tagline: 'The collaboration platform for teams that ship.',
    description: 'Oruinwan brings channels, DMs, huddles, tasks, notes and AI into one encrypted workspace.',
    year: new Date().getFullYear(),
};

export default BRAND;

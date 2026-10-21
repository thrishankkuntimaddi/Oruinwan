// Category helpers shared by the Knowledge page and its tests.

/** Filter value for pages without a category. */
export const UNCATEGORISED = 'none';

/** A page's category id as a string, or UNCATEGORISED. */
export const catKey = (p) => (p?.categoryId ? String(p.categoryId?._id || p.categoryId) : UNCATEGORISED);

/** Pages narrowed to a category filter ('' = all, 'none' = without a category). */
export function filterByCategory(pages, category) {
    if (!category) return pages;
    return pages.filter((p) => catKey(p) === category);
}

/** categoryId -> page count, plus 'none' for pages without one. */
export function countByCategory(pages) {
    const m = {};
    pages.forEach((p) => { const k = catKey(p); m[k] = (m[k] || 0) + 1; });
    return m;
}

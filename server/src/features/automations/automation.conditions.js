'use strict';

/**
 * Automation conditions and template interpolation. Pure, unit tested.
 *
 * A condition is { field, operator, value }. `field` is a dot path into the
 * event data (e.g. "priority", "event.pull_request.base.ref", "tags").
 *
 * Operators
 *   equals / not_equals     case-insensitive string comparison
 *   contains / not_contains substring (strings) or element (arrays), case-insensitive
 *   greater_than / less_than numbers, else ISO dates
 *   in                      value is an array or comma-separated list; matches if the field
 *                           (or any element of an array field) is in it
 *   exists                  value true (default) → field present and not empty; false → missing
 *   matches                 regular expression (case-insensitive unless "/pattern/flags" is given)
 *
 * A missing field never matches, except `not_contains` (true) and `exists: false` (true).
 */

const OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'exists', 'matches'];

const MAX_PATTERN_LENGTH = 200;
const MAX_REGEX_INPUT = 2000;
const MAX_CONDITIONS = 20;

const getPath = (obj, path) => String(path || '').split('.').reduce(
    (o, k) => (o !== null && o !== undefined && typeof o === 'object' && o[k] !== undefined ? o[k] : undefined),
    obj,
);

const lower = (v) => String(v).toLowerCase();

function toList(value) {
    if (Array.isArray(value)) return value.map((v) => lower(v).trim());
    return String(value ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function toComparable(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return null;
    if (v instanceof Date) return v.getTime();
    const s = String(v).trim();
    if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const t = Date.parse(s);
        if (!Number.isNaN(t)) return t;
    }
    return null;
}

/**
 * Patterns that can take exponential time (nested quantifiers such as (a+)+,
 * (\w*)*, (a|aa)+) and back-references are refused. Plus a length cap on the
 * pattern and on the text it runs against.
 */
function unsafePatternReason(pattern) {
    if (typeof pattern !== 'string' || !pattern) return 'Pattern is empty';
    if (pattern.length > MAX_PATTERN_LENGTH) return `Pattern longer than ${MAX_PATTERN_LENGTH} characters`;
    if (/\\[1-9]|\\k</.test(pattern)) return 'Back-references are not allowed';
    if (/\([^()]*[+*][^()]*\)\s*[+*{]/.test(pattern)) return 'Nested quantifiers are not allowed';
    if (/\([^()]*\|[^()]*\)\s*[+*{]/.test(pattern)) return 'Quantified alternations are not allowed';
    if (/\{\s*\d{4,}/.test(pattern)) return 'Repetition counts above 999 are not allowed';
    return null;
}

const regexCache = new Map();

/** RegExp for a condition value ("pattern" or "/pattern/flags"), or throws with a reason. */
function compileRegex(value) {
    const raw = String(value ?? '');
    if (regexCache.has(raw)) return regexCache.get(raw);
    let pattern = raw;
    let flags = 'i';
    const literal = raw.match(/^\/(.*)\/([imsu]*)$/s);
    if (literal) {
        pattern = literal[1];
        flags = literal[2];
    }
    const reason = unsafePatternReason(pattern);
    if (reason) throw new Error(reason);
    const re = new RegExp(pattern, flags);
    if (regexCache.size > 500) regexCache.clear();
    regexCache.set(raw, re);
    return re;
}

function evaluateCondition(condition, data) {
    const { field, operator, value } = condition || {};
    const actual = getPath(data, field);
    const missing = actual === undefined || actual === null;

    if (operator === 'exists') {
        const want = !(value === false || lower(value ?? 'true') === 'false');
        const present = !missing && actual !== '' && !(Array.isArray(actual) && actual.length === 0);
        return want ? present : !present;
    }
    if (operator === 'not_contains') {
        if (missing) return true;
        return !evaluateCondition({ field, operator: 'contains', value }, data);
    }
    if (missing) return false;

    switch (operator) {
        case 'equals':
            return Array.isArray(actual) ? false : lower(actual) === lower(value);
        case 'not_equals':
            return Array.isArray(actual) ? true : lower(actual) !== lower(value);
        case 'contains':
            if (Array.isArray(actual)) return actual.some((a) => lower(a) === lower(value));
            return lower(actual).includes(lower(value));
        case 'greater_than':
        case 'less_than': {
            const a = toComparable(actual);
            const b = toComparable(value);
            if (a === null || b === null) return false;
            return operator === 'greater_than' ? a > b : a < b;
        }
        case 'in': {
            const list = toList(value);
            const vals = Array.isArray(actual) ? actual : [actual];
            return vals.some((v) => list.includes(lower(v)));
        }
        case 'matches': {
            let re;
            try { re = compileRegex(value); } catch { return false; }
            const text = (Array.isArray(actual) ? actual.join(' ') : String(actual)).slice(0, MAX_REGEX_INPUT);
            re.lastIndex = 0;
            return re.test(text);
        }
        default:
            return false;
    }
}

/** All conditions (logic 'all', default) or at least one ('any'). No conditions → true. */
function evaluateConditions(automation, data) {
    const conditions = automation?.conditions || [];
    if (conditions.length === 0) return true;
    if (automation.conditionLogic === 'any') return conditions.some((c) => evaluateCondition(c, data));
    return conditions.every((c) => evaluateCondition(c, data));
}

/** Throws a 400 error describing the first invalid condition. */
function validateConditions(conditions) {
    const bad = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
    if (conditions === undefined || conditions === null) return [];
    if (!Array.isArray(conditions)) throw bad('conditions must be an array');
    if (conditions.length > MAX_CONDITIONS) throw bad(`At most ${MAX_CONDITIONS} conditions`);
    return conditions.map((c, i) => {
        if (!c || typeof c.field !== 'string' || !c.field.trim()) throw bad(`Condition ${i + 1}: field is required`);
        if (!OPERATORS.includes(c.operator)) throw bad(`Condition ${i + 1}: unknown operator "${c.operator}"`);
        let value = c.value;
        if (c.operator !== 'exists' && (value === undefined || value === null || value === '')) {
            throw bad(`Condition ${i + 1}: value is required for ${c.operator}`);
        }
        if (c.operator === 'matches') {
            try { compileRegex(value); } catch (err) { throw bad(`Condition ${i + 1}: invalid pattern — ${err.message}`); }
        }
        if (c.operator === 'in' && !Array.isArray(value)) value = String(value);
        if (Array.isArray(value)) value = value.map(String).slice(0, 100);
        else if (value !== undefined && value !== null && typeof value !== 'boolean') value = String(value).slice(0, 500);
        return { field: c.field.trim(), operator: c.operator, value };
    });
}

const UNRESOLVED = /\{\{[^}]+\}\}/;

/** "{{path}}" placeholders replaced from `data`; unknown paths are left as they are. */
function interpolate(template, data) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{\{([^}]+)\}\}/g, (whole, path) => {
        const val = getPath(data, path.trim());
        if (val === undefined || val === null) return whole;
        if (typeof val === 'object') {
            try { return JSON.stringify(val); } catch { return whole; }
        }
        return String(val);
    });
}

/** Recursively interpolate strings inside objects and arrays. */
function interpolateDeep(value, data, depth = 0) {
    if (depth > 8) return value;
    if (typeof value === 'string') return interpolate(value, data);
    if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, data, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = interpolateDeep(v, data, depth + 1);
        return out;
    }
    return value;
}

/** A config value that is set and fully resolved (no "{{...}}" left). */
function resolved(v) {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim() !== '' && !UNRESOLVED.test(v);
    return true;
}

module.exports = {
    OPERATORS,
    evaluateCondition,
    evaluateConditions,
    validateConditions,
    compileRegex,
    unsafePatternReason,
    interpolate,
    interpolateDeep,
    resolved,
    getPath,
};

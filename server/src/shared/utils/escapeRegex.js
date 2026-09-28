'use strict';

/** Escape a user-supplied string so it can be embedded literally in a RegExp. */
function escapeRegex(text) {
    return String(text == null ? '' : text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" RegExp built from untrusted input. */
function safeRegex(text, flags = 'i') {
    return new RegExp(escapeRegex(String(text == null ? '' : text).trim()), flags);
}

module.exports = { escapeRegex, safeRegex };

// client/src/hooks/useMentionAutocomplete.js
//
// React hook that detects when a user types "@" in a contentEditable element
// and provides a filtered suggestion list + insertion helpers.
//
// Works with the uncontrolled contentEditable div in footerInput.jsx by
// reading cursor position from window.getSelection() on each input event.

import { useState, useCallback, useRef } from 'react';

/**
 * @param {Array<{_id: string, username: string, profilePicture?: string}>} members
 *   Workspace member list to search against
 */
export function useMentionAutocomplete(members = []) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Stores the partial query after "@" so we can replace it on selection
    const queryRef = useRef('');

    /**
     * Call this on every `input` event of the contentEditable element.
     * Scans back from the cursor to find an active @query.
     */
    const handleMentionInput = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;

        // Only handle text nodes
        if (node.nodeType !== Node.TEXT_NODE) {
            setShowSuggestions(false);
            return;
        }

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        // Walk backwards from cursor to find the most recent @
        let atIndex = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                atIndex = i;
                break;
            }
            // Space or newline breaks the mention token
            if (text[i] === ' ' || text[i] === '\n') break;
        }

        if (atIndex === -1) {
            setShowSuggestions(false);
            return;
        }

        const query = text.slice(atIndex + 1, cursorPos).toLowerCase();
        queryRef.current = query;

        // Don't show suggestions for @here / @channel
        if (query === 'here' || query === 'channel') {
            setShowSuggestions(false);
            return;
        }

        const filtered = members
            .filter(m => m.username?.toLowerCase().startsWith(query))
            .slice(0, 8); // Cap at 8 suggestions

        if (filtered.length > 0) {
            setSuggestions(filtered);
            setSelectedIndex(0);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [members]);

    /**
     * Handle keyboard navigation inside the suggestions dropdown.
     * Returns true if the key was consumed (caller should prevent default).
     */
    const handleMentionKeyDown = useCallback((e) => {
        if (!showSuggestions) return false;

        if (e.key === 'ArrowDown') {
            setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
            return true;
        }
        if (e.key === 'ArrowUp') {
            setSelectedIndex(i => Math.max(i - 1, 0));
            return true;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
            // Let the caller invoke selectSuggestion(selectedIndex)
            return true;
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return true;
        }
        return false;
    }, [showSuggestions, suggestions.length]);

    /**
     * Insert the selected member's username into the contentEditable.
     * Replaces the "@query" fragment at the cursor with "@username ".
     */
    const selectSuggestion = useCallback((member, editableRef) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        // Find the @ that started this mention
        let atIndex = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') { atIndex = i; break; }
            if (text[i] === ' ' || text[i] === '\n') break;
        }
        if (atIndex === -1) return;

        // Replace @query with @username (styled span + trailing space)
        const before = text.slice(0, atIndex);
        const after = text.slice(cursorPos);

        // Build a mention chip span + a zero-width space so cursor lands after it
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'mention-chip inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 cursor-default select-none';
        mentionSpan.contentEditable = 'false';
        mentionSpan.dataset.mention = member.username;
        mentionSpan.textContent = `@${member.username}`;

        // Replace text node content and insert span
        node.textContent = before;
        const parentEl = node.parentNode;
        if (!parentEl) return;

        // Insert span after the text node
        if (node.nextSibling) {
            parentEl.insertBefore(mentionSpan, node.nextSibling);
        } else {
            parentEl.appendChild(mentionSpan);
        }

        // Insert a text node with a space after the span for continued typing
        const spaceNode = document.createTextNode('\u00a0'); // non-breaking space
        if (mentionSpan.nextSibling) {
            parentEl.insertBefore(spaceNode, mentionSpan.nextSibling);
        } else {
            parentEl.appendChild(spaceNode);
        }

        // Also append remaining text
        if (after) {
            const afterNode = document.createTextNode(after);
            if (spaceNode.nextSibling) {
                parentEl.insertBefore(afterNode, spaceNode.nextSibling);
            } else {
                parentEl.appendChild(afterNode);
            }
        }

        // Move cursor after the space
        const newRange = document.createRange();
        newRange.setStartAfter(spaceNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        setShowSuggestions(false);

        // Trigger onChange so parent state stays in sync
        if (editableRef?.current) {
            editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, []);

    /**
     * Extract all @mention usernames from the contentEditable DOM.
     * Call this at send time to build the mentionText for the backend.
     */
    const extractMentionText = useCallback((editableRef) => {
        if (!editableRef?.current) return '';
        // Get innerText which collapses our chips into their text content
        return editableRef.current.innerText || '';
    }, []);

    return {
        showSuggestions,
        suggestions,
        selectedIndex,
        setSelectedIndex,
        handleMentionInput,
        handleMentionKeyDown,
        selectSuggestion,
        extractMentionText,
        closeSuggestions: () => setShowSuggestions(false),
    };
}

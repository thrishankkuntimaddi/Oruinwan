import { useState, useCallback, useRef } from 'react';

/**
 * Where the "@" of the mention being typed is, or -1. Names can have spaces, so the query may
 * run past a space ("@varshitha gaj") while it still starts someone's username.
 */
export function mentionStart(text, cursorPos, members = []) {
    for (let i = cursorPos - 1; i >= 0 && cursorPos - i <= 60; i--) {
        const c = text[i];
        if (c === '\n') return -1;
        if (c !== '@') continue;
        if (i > 0 && /[\p{L}\p{N}_@/]/u.test(text[i - 1])) return -1;
        const query = text.slice(i + 1, cursorPos).toLowerCase().replace(/[\s\u00a0]+/g, ' ');
        if (!/\s/.test(query)) return i;
        return (members || []).some((m) => String(m?.username || '').toLowerCase().replace(/\s+/g, ' ').startsWith(query)) ? i : -1;
    }
    return -1;
}

export function useMentionAutocomplete(members = [], { includeBroadcast = false, assistants = [] } = {}) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    const queryRef = useRef('');

    
    const handleMentionInput = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;

        
        if (node.nodeType !== Node.TEXT_NODE) {
            setShowSuggestions(false);
            return;
        }

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        
        const atIndex = mentionStart(text, cursorPos, members);

        if (atIndex === -1) {
            setShowSuggestions(false);
            return;
        }

        const query = text.slice(atIndex + 1, cursorPos).toLowerCase().replace(/[\s\u00a0]+/g, ' ');
        queryRef.current = query;

        // Channels also offer @here (online members) and @channel (everyone).
        const broadcast = includeBroadcast
            ? [{ _id: '@here', username: 'here', isBroadcast: true, name: 'Notify online members' },
               { _id: '@channel', username: 'channel', isBroadcast: true, name: 'Notify everyone in this channel' }]
                .filter(b => b.username.startsWith(query) && b.username !== query)
            : [];

        // Oruinwan AI can be mentioned anywhere: "@Oruinwan …" gets an answer in the conversation.
        const assistant = ('oruinwan'.startsWith(query) || 'ai'.startsWith(query)) && query !== 'oruinwan'
            ? [{ _id: '@oruinwan', username: 'Oruinwan', isBroadcast: true, isAssistant: true, profilePicture: '/icons/oruinwan-128.png', name: 'Ask Oruinwan AI to answer here' }]
            : [];
        // Models the workspace connected: @claude, @chatgpt, @gemini, @grok.
        for (const a of assistants) {
            if (a.id === 'default' || !a.mention || !a.mention.startsWith(query) || a.mention === query) continue;
            assistant.push({ _id: `@${a.mention}`, username: a.mention, isBroadcast: true, isAssistant: true, profilePicture: `/icons/ai/${a.id}.svg`, name: `Ask ${a.name} to answer here` });
        }

        // Names starting with the query first, then names containing it.
        const lower = (m) => (m.username || '').toLowerCase();
        const starts = members.filter(m => lower(m).startsWith(query));
        const contains = members.filter(m => !lower(m).startsWith(query) && lower(m).includes(query));
        const filtered = [...assistant, ...starts, ...contains, ...broadcast].slice(0, 8);

        if (filtered.length > 0) {
            setSuggestions(filtered);
            setSelectedIndex(0);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [members, includeBroadcast, assistants]);

    
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
            
            return true;
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return true;
        }
        return false;
    }, [showSuggestions, suggestions.length]);

    
    const selectSuggestion = useCallback((member, editableRef) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent || '';
        const cursorPos = range.startOffset;

        
        const atIndex = mentionStart(text, cursorPos, members);
        if (atIndex === -1) return;

        
        const before = text.slice(0, atIndex);
        const after = text.slice(cursorPos);

        
        const mentionSpan = document.createElement('span');
        mentionSpan.className = 'mention-chip inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 cursor-default select-none';
        mentionSpan.contentEditable = 'false';
        mentionSpan.dataset.mention = member.username;
        mentionSpan.textContent = `@${member.username}`;

        
        node.textContent = before;
        const parentEl = node.parentNode;
        if (!parentEl) return;

        
        if (node.nextSibling) {
            parentEl.insertBefore(mentionSpan, node.nextSibling);
        } else {
            parentEl.appendChild(mentionSpan);
        }

        
        const spaceNode = document.createTextNode('\u00a0'); 
        if (mentionSpan.nextSibling) {
            parentEl.insertBefore(spaceNode, mentionSpan.nextSibling);
        } else {
            parentEl.appendChild(spaceNode);
        }

        
        if (after) {
            const afterNode = document.createTextNode(after);
            if (spaceNode.nextSibling) {
                parentEl.insertBefore(afterNode, spaceNode.nextSibling);
            } else {
                parentEl.appendChild(afterNode);
            }
        }

        
        const newRange = document.createRange();
        newRange.setStartAfter(spaceNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        setShowSuggestions(false);

        
        if (editableRef?.current) {
            editableRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, [members]);

    
    const extractMentionText = useCallback((editableRef) => {
        if (!editableRef?.current) return '';
        
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

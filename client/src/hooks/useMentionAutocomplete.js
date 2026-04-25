import { useState, useCallback, useRef } from 'react';

export function useMentionAutocomplete(members = []) {
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

        
        let atIndex = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                atIndex = i;
                break;
            }
            
            if (text[i] === ' ' || text[i] === '\n') break;
        }

        if (atIndex === -1) {
            setShowSuggestions(false);
            return;
        }

        const query = text.slice(atIndex + 1, cursorPos).toLowerCase();
        queryRef.current = query;

        
        if (query === 'here' || query === 'channel') {
            setShowSuggestions(false);
            return;
        }

        const filtered = members
            .filter(m => m.username?.toLowerCase().startsWith(query))
            .slice(0, 8); 

        if (filtered.length > 0) {
            setSuggestions(filtered);
            setSelectedIndex(0);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    }, [members]);

    
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

        
        let atIndex = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') { atIndex = i; break; }
            if (text[i] === ' ' || text[i] === '\n') break;
        }
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
    }, []);

    
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

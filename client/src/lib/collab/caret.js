/** Caret position inside a contentEditable element, as a character offset in its text. */
export function getCaretOffset(node) {
    if (typeof window === 'undefined' || !node) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !node.contains(sel.focusNode)) return null;
    try {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.setEnd(sel.focusNode, sel.focusOffset);
        return range.toString().length;
    } catch {
        return null;
    }
}

/** Put the caret at a character offset inside a contentEditable element. */
export function setCaretOffset(node, offset) {
    if (typeof window === 'undefined' || !node || offset == null) return;
    const sel = window.getSelection();
    if (!sel) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let target = null;
    let at = 0;
    while (walker.nextNode()) {
        const len = walker.currentNode.textContent.length;
        if (remaining <= len) { target = walker.currentNode; at = remaining; break; }
        remaining -= len;
    }
    const range = document.createRange();
    if (target) {
        range.setStart(target, at);
    } else {
        range.selectNodeContents(node);
        range.collapse(false);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

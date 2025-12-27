import React, { useRef, useState, useEffect } from 'react';
import ContentEditable from 'react-contenteditable';
import {
    Bold, Italic, Underline, Strikethrough,
    Heading1, Heading2, Heading3,
    List, ListOrdered, Link, Code, Quote,
    AlignLeft, AlignCenter, AlignRight,
    Undo, Redo, Type, Palette, Minus
} from 'lucide-react';

export default function CanvasTab({ tab, onSave, connected, socket, channelId, currentUserId }) {
    const [content, setContent] = useState(tab.content || "");
    const [saving, setSaving] = useState(false);
    const contentRef = useRef(tab.content || "");
    const saveTimeoutRef = useRef(null);
    const editorRef = useRef(null);
    const isRemoteUpdate = useRef(false);

    // Listen for incoming content updates from other users
    useEffect(() => {
        if (!socket || !connected) return;

        const handleTabUpdate = (data) => {
            // Only update if this is the same tab and not from current user
            if (data.tabId === tab._id && data.updatedBy !== currentUserId) {
                isRemoteUpdate.current = true;
                setContent(data.content || "");
                contentRef.current = data.content || "";

                // Brief flash to indicate remote update
                setSaving(true);
                setTimeout(() => setSaving(false), 500);
            }
        };

        socket.on('tab-updated', handleTabUpdate);

        return () => {
            socket.off('tab-updated', handleTabUpdate);
        };
    }, [socket, connected, tab._id, currentUserId]);

    // Sync content when tab changes
    useEffect(() => {
        if (!isRemoteUpdate.current) {
            setContent(tab.content || "");
            contentRef.current = tab.content || "";
        }
        isRemoteUpdate.current = false;
    }, [tab.content, tab._id]);

    // Debounced save
    const handleChange = (evt) => {
        const newContent = evt.target.value;
        setContent(newContent);
        contentRef.current = newContent;

        setSaving(true);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            onSave(tab._id, { content: newContent });
            setSaving(false);
        }, 1500);
    };

    // Formatting helpers
    const execFormat = (cmd, value = null) => {
        document.execCommand(cmd, false, value);
        editorRef.current?.focus();
    };

    const insertLink = () => {
        const url = prompt('Enter URL:');
        if (url) execFormat('createLink', url);
    };

    const toolbarButtons = [
        // Text Formatting
        { icon: Bold, cmd: 'bold', title: 'Bold (Ctrl+B)', group: 'text' },
        { icon: Italic, cmd: 'italic', title: 'Italic (Ctrl+I)', group: 'text' },
        { icon: Underline, cmd: 'underline', title: 'Underline (Ctrl+U)', group: 'text' },
        { icon: Strikethrough, cmd: 'strikeThrough', title: 'Strikethrough', group: 'text' },
        { divider: true },

        // Headings
        { icon: Heading1, cmd: 'formatBlock', value: '<H1>', title: 'Heading 1', group: 'heading' },
        { icon: Heading2, cmd: 'formatBlock', value: '<H2>', title: 'Heading 2', group: 'heading' },
        { icon: Heading3, cmd: 'formatBlock', value: '<H3>', title: 'Heading 3', group: 'heading' },
        { icon: Type, cmd: 'formatBlock', value: '<P>', title: 'Paragraph', group: 'heading' },
        { divider: true },

        // Lists
        { icon: List, cmd: 'insertUnorderedList', title: 'Bullet List', group: 'list' },
        { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered List', group: 'list' },
        { divider: true },

        // Alignment
        { icon: AlignLeft, cmd: 'justifyLeft', title: 'Align Left', group: 'align' },
        { icon: AlignCenter, cmd: 'justifyCenter', title: 'Align Center', group: 'align' },
        { icon: AlignRight, cmd: 'justifyRight', title: 'Align Right', group: 'align' },
        { divider: true },

        // Special
        { icon: Link, action: insertLink, title: 'Insert Link', group: 'insert' },
        { icon: Code, cmd: 'formatBlock', value: '<PRE>', title: 'Code Block', group: 'insert' },
        { icon: Quote, cmd: 'formatBlock', value: '<BLOCKQUOTE>', title: 'Quote', group: 'insert' },
        { icon: Minus, cmd: 'insertHorizontalRule', title: 'Divider', group: 'insert' },
        { divider: true },

        // Undo/Redo
        { icon: Undo, cmd: 'undo', title: 'Undo (Ctrl+Z)', group: 'history' },
        { icon: Redo, cmd: 'redo', title: 'Redo (Ctrl+Y)', group: 'history' },
    ];

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/10 h-full">
            {/* Horizontal Toolbar */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 overflow-x-auto no-scrollbar">
                    {/* Toolbar Buttons */}
                    <div className="flex items-center gap-0.5">
                        {toolbarButtons.map((btn, idx) =>
                            btn.divider ? (
                                <div key={idx} className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1.5" />
                            ) : (
                                <button
                                    key={idx}
                                    onClick={() => btn.action ? btn.action() : execFormat(btn.cmd, btn.value)}
                                    className="
                                        p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 
                                        rounded-lg 
                                        text-gray-600 dark:text-gray-400 
                                        hover:text-blue-600 dark:hover:text-blue-400
                                        transition-all duration-200
                                        disabled:opacity-30 disabled:cursor-not-allowed
                                        active:scale-95
                                    "
                                    title={btn.title}
                                    disabled={!connected}
                                >
                                    <btn.icon size={18} strokeWidth={2} />
                                </button>
                            )
                        )}
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 ml-4">
                        {!connected && (
                            <span className="px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full whitespace-nowrap">
                                Offline
                            </span>
                        )}
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${saving
                                ? 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                                : 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                            }`}>
                            {saving ? 'Syncing...' : 'Synced'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto">
                    {/* Canvas Paper */}
                    <div className="bg-white dark:bg-gray-900 shadow-2xl rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[calc(100vh-200px)]">
                        {/* Header */}
                        <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800">
                            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                                {tab.name}
                            </h1>
                        </div>

                        {/* Editor */}
                        <div className="p-8 md:p-12 relative">
                            <ContentEditable
                                innerRef={editorRef}
                                html={content}
                                disabled={!connected}
                                onChange={handleChange}
                                className="
                                    prose prose-lg dark:prose-invert max-w-none 
                                    focus:outline-none 
                                    prose-headings:font-bold 
                                    prose-h1:text-4xl prose-h1:mb-4 prose-h1:mt-8 first:prose-h1:mt-0
                                    prose-h2:text-3xl prose-h2:mb-3 prose-h2:mt-6
                                    prose-h3:text-2xl prose-h3:mb-2 prose-h3:mt-4
                                    prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
                                    prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                                    prose-strong:text-gray-900 dark:prose-strong:text-gray-100
                                    prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                    prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg
                                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-950/20 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:my-4 prose-blockquote:not-italic
                                    prose-ul:my-4 prose-ol:my-4
                                    prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:my-1
                                    prose-hr:border-gray-300 dark:prose-hr:border-gray-700 prose-hr:my-8
                                    min-h-[500px]
                                "
                                data-placeholder="✨ Start writing your canvas..."
                            />

                            {/* Empty State */}
                            {!content && (
                                <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                    <Palette size={64} className="mx-auto mb-4 text-gray-200 dark:text-gray-800" />
                                    <p className="text-gray-400 dark:text-gray-600 text-xl font-medium">Start creating...</p>
                                    <p className="text-gray-300 dark:text-gray-700 text-sm mt-2">Use the toolbar above to format</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-400 dark:text-gray-600">
                            💡 <span className="font-medium">Tip:</span> Use <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl+B</kbd> for bold, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl+I</kbd> for italic
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

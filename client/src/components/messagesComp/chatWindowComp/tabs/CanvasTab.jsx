import React, { useRef, useState, useEffect } from 'react';
import ContentEditable from 'react-contenteditable';
import {
    Bold, Italic, Underline, Strikethrough,
    Heading1, Heading2, Heading3,
    List, ListOrdered, Link, Code, Quote,
    AlignLeft, AlignCenter, AlignRight,
    Undo, Redo, Type, Minus,
    FileText, WifiOff, PenTool, Eraser, MousePointer, Maximize, Minimize
} from 'lucide-react';

export default function CanvasTab({ tab, onSave, connected, socket, channelId, currentUserId }) {
    const [content, setContent] = useState(tab.content || "");
    const [drawingData, setDrawingData] = useState(tab.drawingData || []);
    const [mode, setMode] = useState('text'); // 'text' | 'draw'
    const [saving, setSaving] = useState(false);

    // Text Refs
    const contentRef = useRef(tab.content || "");
    const saveTimeoutRef = useRef(null);
    const editorRef = useRef(null);
    const isRemoteUpdate = useRef(false);

    // Drawing Refs
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);
    const currentStroke = useRef([]);

    // Full Screen Ref
    const containerRef = useRef(null);
    const [isFullScreen, setIsFullScreen] = useState(false);

    // Toggle Full Screen
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
        };
    }, []);

    // Listen for incoming content updates from other users
    useEffect(() => {
        if (!socket || !connected) return;

        const handleTabUpdate = (data) => {
            // Only update if this is the same tab and not from current user
            if (data.tabId === tab._id && data.updatedBy !== currentUserId) {
                isRemoteUpdate.current = true;

                if (data.content !== undefined) {
                    setContent(data.content || "");
                    contentRef.current = data.content || "";
                }

                if (data.drawingData !== undefined) {
                    setDrawingData(data.drawingData || []);
                    drawCanvas(data.drawingData || []);
                }

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

    // Sync content when tab or drawingData changes
    useEffect(() => {
        if (!isRemoteUpdate.current) {
            setContent(tab.content || "");
            contentRef.current = tab.content || "";
            if (tab.drawingData) {
                setDrawingData(tab.drawingData);
                drawCanvas(tab.drawingData);
            }
        }
        isRemoteUpdate.current = false;
    }, [tab.content, tab.drawingData, tab._id]);

    // Initial Draw on Mount / Mode Change
    useEffect(() => {
        if (mode === 'draw') {
            // Slight delay to ensure canvas is mounted
            setTimeout(() => drawCanvas(drawingData), 50);
        }
    }, [mode, drawingData]);

    // --- Text Handlers ---
    const handleChange = (evt) => {
        const newContent = evt.target.value;
        setContent(newContent);
        contentRef.current = newContent;
        triggerSave({ content: newContent });
    };

    // --- Drawing Handlers ---
    const startDrawing = (e) => {
        if (mode !== 'draw') return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        isDrawing.current = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        currentStroke.current = [{ x, y }];

        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = '#000'; // Default black
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const draw = (e) => {
        if (!isDrawing.current || mode !== 'draw') return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        currentStroke.current.push({ x, y });

        const ctx = canvas.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing.current || mode !== 'draw') return;
        isDrawing.current = false;

        const newStroke = {
            points: currentStroke.current,
            color: '#000',
            width: 2
        };

        const newDrawingData = [...drawingData, newStroke];
        setDrawingData(newDrawingData);
        triggerSave({ drawingData: newDrawingData });
    };

    const clearCanvas = () => {
        if (window.confirm('Clear all drawings?')) {
            setDrawingData([]);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            triggerSave({ drawingData: [] });
        }
    };

    const drawCanvas = (data) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        data.forEach(stroke => {
            if (stroke.points.length < 1) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.color || '#000';
            ctx.lineWidth = stroke.width || 2;
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
    };

    // --- Common Save Logic ---
    const triggerSave = (updates) => {
        setSaving(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        // Merge updates with current state to ensure we don't lose one type of data
        const payload = {
            content: contentRef.current,
            drawingData: drawingData,
            ...updates
        };

        saveTimeoutRef.current = setTimeout(() => {
            onSave(tab._id, payload);
            setSaving(false);
        }, 1500); // 1.5s debounce
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
        // Mode Switcher
        { icon: MousePointer, action: () => setMode('text'), title: 'Text Mode', active: mode === 'text', group: 'mode' },
        { icon: PenTool, action: () => setMode('draw'), title: 'Draw Mode', active: mode === 'draw', group: 'mode' },
        { divider: true },

        // Text Formatting (Only show in text mode)
        ...(mode === 'text' ? [
            { icon: Bold, cmd: 'bold', title: 'Bold (Ctrl+B)', group: 'text' },
            { icon: Italic, cmd: 'italic', title: 'Italic (Ctrl+I)', group: 'text' },
            { icon: Underline, cmd: 'underline', title: 'Underline (Ctrl+U)', group: 'text' },
            { icon: Strikethrough, cmd: 'strikeThrough', title: 'Strikethrough', group: 'text' },
            { divider: true },

            { icon: Heading1, cmd: 'formatBlock', value: '<H1>', title: 'Heading 1', group: 'heading' },
            { icon: Heading2, cmd: 'formatBlock', value: '<H2>', title: 'Heading 2', group: 'heading' },
            { icon: Heading3, cmd: 'formatBlock', value: '<H3>', title: 'Heading 3', group: 'heading' },
            { icon: Type, cmd: 'formatBlock', value: '<P>', title: 'Paragraph', group: 'heading' },
            { divider: true },

            { icon: List, cmd: 'insertUnorderedList', title: 'Bullet List', group: 'list' },
            { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Numbered List', group: 'list' },
            { divider: true },

            { icon: AlignLeft, cmd: 'justifyLeft', title: 'Align Left', group: 'align' },
            { icon: AlignCenter, cmd: 'justifyCenter', title: 'Align Center', group: 'align' },
            { icon: AlignRight, cmd: 'justifyRight', title: 'Align Right', group: 'align' },
            { divider: true },

            { icon: Link, action: insertLink, title: 'Insert Link', group: 'insert' },
            { icon: Code, cmd: 'formatBlock', value: '<PRE>', title: 'Code Block', group: 'insert' },
            { icon: Quote, cmd: 'formatBlock', value: '<BLOCKQUOTE>', title: 'Quote', group: 'insert' },
            { icon: Minus, cmd: 'insertHorizontalRule', title: 'Divider', group: 'insert' },
            { divider: true },

            { icon: Undo, cmd: 'undo', title: 'Undo (Ctrl+Z)', group: 'history' },
            { icon: Redo, cmd: 'redo', title: 'Redo (Ctrl+Y)', group: 'history' },
        ] : [
            // Drawing Toolbar (Only show in draw mode)
            { icon: Eraser, action: clearCanvas, title: 'Clear Canvas', group: 'draw' },
        ]),

        { divider: true },
        // View Controls
        { icon: isFullScreen ? Minimize : Maximize, action: toggleFullScreen, title: isFullScreen ? 'Exit Full Screen' : 'Full Screen', group: 'view' },
    ];

    return (
        <div ref={containerRef} className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/10 h-full">
            {/* Horizontal Toolbar */}
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300">
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
                                    className={`
                                        p-2 rounded-lg transition-all duration-200 active:scale-95
                                        ${btn.active
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-bold shadow-inner'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400'}
                                    `}
                                    title={btn.title}
                                >
                                    <btn.icon size={18} strokeWidth={2} />
                                </button>
                            )
                        )}
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 ml-4">
                        {!connected && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full whitespace-nowrap animate-pulse">
                                <WifiOff size={12} />
                                Offline
                            </span>
                        )}
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${saving
                            ? 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                            : 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30'
                            }`}>
                            {saving ? 'Saving...' : 'Saved'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto">
                    {/* Canvas Paper */}
                    <div className={`bg-white dark:bg-gray-900 shadow-xl shadow-blue-900/5 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden min-h-[calc(100vh-200px)] relative group ${mode === 'draw' ? 'cursor-crosshair' : ''}`}>

                        {/* Text Editor (Hidden in Draw Mode? No, Overlay) */}
                        {/* We overlay the canvas on top of text when in draw mode, or switch visibility. 
                            Let's keep text visible but disable interaction in draw mode to prevent confusion, 
                            OR allow both. Simpler to overlay canvas logic.
                        */}

                        {/* Header */}
                        <div className="px-10 pt-10 pb-4 select-none">
                            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
                                {tab.name}
                            </h1>
                            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 font-medium flex items-center gap-2">
                                <FileText size={14} />
                                Shared Document Canvas {mode === 'draw' ? '(Drawing Mode)' : ''}
                            </p>
                        </div>

                        <div className="relative px-10 pb-12 min-h-[800px]">
                            {/* Text Layer */}
                            <ContentEditable
                                innerRef={editorRef}
                                html={content}
                                disabled={mode === 'draw'} // Disable text editing while drawing
                                onChange={handleChange}
                                className={`
                                    prose prose-lg dark:prose-invert max-w-none 
                                    focus:outline-none 
                                    min-h-[500px]
                                    prose-headings:font-bold prose-headings:tracking-tight
                                    prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-8 first:prose-h1:mt-0
                                    prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-8 prose-h2:text-gray-800 dark:prose-h2:text-gray-100
                                    prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-6
                                    prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
                                    prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                                    prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-bold
                                    prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:font-mono prose-code:text-sm
                                    prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-xl prose-pre:shadow-lg
                                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 dark:prose-blockquote:bg-blue-900/10 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:my-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                                    prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                                    prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                                    prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:my-1.5 prose-li:pl-1
                                    prose-hr:border-gray-200 dark:prose-hr:border-gray-800 prose-hr:my-8
                                    selection:bg-blue-100 dark:selection:bg-blue-900/50 selection:text-blue-900 dark:selection:text-blue-100
                                    ${mode === 'draw' ? 'pointer-events-none opacity-50' : ''}
                                `}
                                data-placeholder="Type '/' to browse commands..."
                            />

                            {/* Paint Layer (Overlay) */}
                            {/* We use strict absolute positioning covering the whole editor area */}
                            <canvas
                                ref={canvasRef}
                                width={800} // Hardcoded for POC, should be dynamic or responsive
                                height={1200}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                className={`absolute top-0 left-0 w-full h-full z-10 touch-none ${mode === 'draw' ? 'block' : 'pointer-events-none'}`}
                                style={{
                                    // Make sure it sits on top of text when drawing, but lets clicks through when not
                                    // Pointer events controlled by class above
                                    opacity: mode === 'draw' ? 1 : 0.7 // slightly fade drawing when typing? Or keep clear.
                                }}
                            />

                            {/* Empty State */}
                            {!content && mode === 'text' && (
                                <div className="absolute top-0 left-0 right-0 pointer-events-none opacity-40 mt-10 ml-10">
                                    <p className="text-2xl font-medium text-gray-300 dark:text-gray-600">Start writing or drawing...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Tips */}
                    <div className="mt-8 text-center pb-8 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Real-time collaboration enabled
                            </span>
                            <span className="mx-3 text-gray-300 dark:text-gray-700">|</span>
                            {mode === 'text' ? 'Markdown shortcuts supported' : 'Freehand drawing active'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

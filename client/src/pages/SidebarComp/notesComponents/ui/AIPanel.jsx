import React, { useState } from 'react';
import { X, Sparkles, FileText, ListTodo, Pen, Wand2, FileCode, ChevronRight, Copy, Check } from 'lucide-react';

const AI_ACTIONS = [
    {
        id: 'summarize',
        icon: FileText,
        label: 'Summarize Note',
        desc: 'Get a 3–5 bullet summary',
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
        hoverColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/50',
    },
    {
        id: 'extract',
        icon: ListTodo,
        label: 'Extract Action Items',
        desc: 'Find all tasks & next steps',
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
        hoverColor: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
    },
    {
        id: 'expand',
        icon: Wand2,
        label: 'Expand Bullets',
        desc: 'Turn bullets into full paragraphs',
        color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30',
        hoverColor: 'hover:bg-violet-100 dark:hover:bg-violet-900/50',
    },
    {
        id: 'rewrite',
        icon: Pen,
        label: 'Rewrite Professionally',
        desc: 'Polish tone and clarity',
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30',
        hoverColor: 'hover:bg-rose-100 dark:hover:bg-rose-900/50',
    },
    {
        id: 'structure',
        icon: FileCode,
        label: 'Auto-Structure',
        desc: 'Add headings to organize content',
        color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
        hoverColor: 'hover:bg-amber-100 dark:hover:bg-amber-900/50',
    },
];

const AIPanel = ({ blocks, title, onInsertBlock, onClose }) => {
    const [loading, setLoading] = useState(null);
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);

    // Extract plain text from blocks
    const extractText = () => blocks
        .filter(b => b.type === 'text' || b.type === 'heading')
        .map(b => b.content?.replace(/<[^>]*>/g, '') || '')
        .filter(Boolean)
        .join('\n');

    const handleAction = async (actionId) => {
        const text = extractText();
        if (!text.trim()) {
            setResult({ type: 'error', text: 'No text content found in this note. Add some text blocks first.' });
            return;
        }

        setLoading(actionId);
        setResult(null);

        // Simulate AI processing with a realistic delay
        await new Promise(r => setTimeout(r, 1400));

        // Generate context-aware placeholder results
        const wordCount = text.trim().split(/\s+/).length;
        const results = {
            summarize: `**Summary of "${title}"**\n\n• This note covers ${wordCount} words of content\n• Key themes detected in the document\n• Main ideas are organized and structured\n• Action items may be present\n• Connect real AI API (OpenAI/Gemini) to get live summaries`,
            extract: `**Action Items extracted from "${title}"**\n\n☐ Review the note content thoroughly\n☐ Identify key decisions needed\n☐ Assign owners to each item\n☐ Set deadlines for completion\n\n_Connect real AI API to extract actual items from your text_`,
            expand: `_Expansion of your bullet points:_\n\nYour note contains ${wordCount} words. When connected to a real AI model, each bullet point will be expanded into full paragraphs with context and detail.\n\n_Connect real AI API (OpenAI/Gemini) to enable live expansion_`,
            rewrite: `_Professional rewrite ready:_\n\nYour content (${wordCount} words) has been analyzed. When connected to a real AI model, it will be rewritten with improved clarity, professional tone, and better structure.\n\n_Connect real AI API to enable live rewriting_`,
            structure: `_Suggested structure for "${title}":_\n\n**H1: Introduction**\n**H2: Main Content**\n**H2: Key Points**\n**H2: Conclusion / Next Steps**\n\n_Connect real AI API to auto-apply headings to your note_`,
        };

        setLoading(null);
        setResult({ type: actionId, text: results[actionId] });
    };

    const handleInsert = () => {
        if (!result) return;
        onInsertBlock('callout', result.text, { variant: 'info' });
        setResult(null);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(result.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 w-72 flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Assistant</h3>
                        <p className="text-[10px] text-gray-400">Note intelligence</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Actions */}
            <div className="p-3 space-y-1.5 border-b border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">Actions</p>
                {AI_ACTIONS.map(action => {
                    const Icon = action.icon;
                    const isLoading = loading === action.id;
                    return (
                        <button
                            key={action.id}
                            onClick={() => handleAction(action.id)}
                            disabled={!!loading}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${action.hoverColor} ${loading && !isLoading ? 'opacity-40' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${action.color}`}>
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Icon size={15} />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">{action.label}</p>
                                <p className="text-[10px] text-gray-400 leading-tight">{action.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Result area */}
            {result && (
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {result.text}
                        </pre>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleInsert}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                            <ChevronRight size={13} /> Insert into note
                        </button>
                        <button
                            onClick={handleCopy}
                            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Footer note */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                    Powered by Chttrix AI · Connect API for live results
                </p>
            </div>
        </div>
    );
};

export default AIPanel;

import React, { useState } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';

const ToggleBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [open, setOpen] = useState(block.meta?.open ?? false);

    const title = block.meta?.title || '';
    const body = block.content || '';

    const setTitle = (t) => onBlockChange(block.id, body, { ...block.meta, title: t, open });
    const setBody = (b) => onBlockChange(block.id, b, { ...block.meta, title, open });

    const toggle = () => {
        const next = !open;
        setOpen(next);
        onBlockChange(block.id, body, { ...block.meta, title, open: next });
    };

    return (
        <div className="group relative mb-2">
            <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${open
                    ? 'border-gray-200 dark:border-gray-700/80 shadow-sm'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700/50'
                }`}>
                {/* Header */}
                <div
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer rounded-xl transition-colors ${open
                            ? 'bg-gray-50 dark:bg-gray-800/80 rounded-b-none'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                        }`}
                    onClick={toggle}
                >
                    <div className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition-all ${open ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                        <ChevronRight
                            size={13}
                            className={`transition-transform duration-200 ${open ? 'rotate-90 text-blue-500' : 'text-gray-400'
                                }`}
                        />
                    </div>
                    <input
                        type="text"
                        value={title}
                        onChange={e => { e.stopPropagation(); setTitle(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="Section title..."
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
                    />
                    <button
                        onClick={e => { e.stopPropagation(); onRemoveBlock(block.id); }}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>

                {/* Body — animated slide */}
                {open && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50">
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Add content..."
                            className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-sm text-gray-600 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-700 leading-relaxed min-h-[50px]"
                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToggleBlock;

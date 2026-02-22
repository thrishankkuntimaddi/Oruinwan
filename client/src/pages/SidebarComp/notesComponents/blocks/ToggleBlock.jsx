import React, { useState } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';

const ToggleBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [open, setOpen] = useState(block.meta?.open ?? false);

    const title = block.meta?.title || '';
    const body = block.content || '';

    const setTitle = (t) => {
        onBlockChange(block.id, body, { ...block.meta, title: t, open });
    };

    const setBody = (b) => {
        onBlockChange(block.id, b, { ...block.meta, title, open });
    };

    const toggle = () => {
        const next = !open;
        setOpen(next);
        onBlockChange(block.id, body, { ...block.meta, title, open: next });
    };

    return (
        <div className="group relative mb-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Toggle header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 cursor-pointer" onClick={toggle}>
                    <ChevronRight
                        size={16}
                        className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                    />
                    <input
                        type="text"
                        value={title}
                        onChange={e => { e.stopPropagation(); setTitle(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="Toggle section title..."
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 cursor-text"
                    />
                    <button
                        onClick={e => { e.stopPropagation(); onRemoveBlock(block.id); }}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>

                {/* Toggle body */}
                {open && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Add content inside this toggle..."
                            className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-sm text-gray-600 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 leading-relaxed min-h-[60px]"
                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToggleBlock;

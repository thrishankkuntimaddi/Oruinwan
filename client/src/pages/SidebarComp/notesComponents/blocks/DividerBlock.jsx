import React from 'react';
import { Trash2 } from 'lucide-react';

const STYLES = [
    { label: 'Line', value: 'line' },
    { label: '✦', value: 'dots' },
    { label: '◈', value: 'diamond' },
];

const DividerBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const label = block.content || '';
    const style = block.meta?.style || 'line';

    const cycleStyle = () => {
        const keys = STYLES.map(s => s.value);
        const next = keys[(keys.indexOf(style) + 1) % keys.length];
        onBlockChange(block.id, label, { ...block.meta, style: next });
    };

    return (
        <div className="group relative my-7">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />

                {/* Center element */}
                {label ? (
                    <input
                        type="text"
                        value={label}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        className="text-[11px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 bg-transparent border-none focus:ring-0 outline-none text-center min-w-[60px] max-w-[180px] px-2"
                        placeholder="SECTION"
                    />
                ) : (
                    <button
                        onClick={cycleStyle}
                        className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors text-sm px-1"
                        title="Click to change style"
                    >
                        {style === 'line' ? '⋯' : style === 'dots' ? '✦' : '◈'}
                    </button>
                )}

                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />

                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 absolute right-0 -top-1"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Add label prompt */}
            {!label && (
                <div className="flex justify-center mt-1">
                    <input
                        type="text"
                        value={label}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        placeholder="Add section label..."
                        className="text-[10px] text-center text-gray-300 dark:text-gray-700 bg-transparent border-none focus:ring-0 outline-none placeholder-gray-200 dark:placeholder-gray-800 w-40 focus:placeholder-gray-300"
                    />
                </div>
            )}
        </div>
    );
};

export default DividerBlock;

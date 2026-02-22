import React from 'react';
import { Trash2 } from 'lucide-react';

const DividerBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const label = block.content || '';

    return (
        <div className="group relative my-6">
            <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                <input
                    type="text"
                    value={label}
                    onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                    placeholder="Section label (optional)"
                    className="text-xs font-semibold text-gray-400 dark:text-gray-500 bg-transparent border-none focus:ring-0 outline-none text-center placeholder-gray-300 dark:placeholder-gray-600 min-w-[80px] max-w-[200px]"
                />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 -top-2"
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

export default DividerBlock;

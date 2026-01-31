import React from 'react';
import { Trash2 } from 'lucide-react';

const TextBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    return (
        <div className="group relative mb-4">
            <div className="relative">
                <textarea
                    value={block.content}
                    onChange={(e) => onBlockChange(block.id, e.target.value)}
                    className="w-full resize-none border-none focus:ring-0 text-gray-700 dark:text-gray-200 text-lg leading-relaxed p-0 placeholder-gray-300 dark:placeholder-gray-600 bg-transparent outline-none min-h-[1.5em] overflow-hidden pr-8"
                    placeholder="Type something..."
                    onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                />
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="absolute top-0 right-0 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete text block"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

export default TextBlock;

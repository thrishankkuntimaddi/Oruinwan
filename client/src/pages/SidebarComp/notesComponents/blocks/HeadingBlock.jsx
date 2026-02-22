import React, { useRef, useState, useEffect } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';

const LEVEL_STYLES = {
    1: 'text-4xl font-bold text-gray-900 dark:text-white',
    2: 'text-3xl font-bold text-gray-800 dark:text-gray-100',
    3: 'text-2xl font-semibold text-gray-800 dark:text-gray-100',
    4: 'text-xl font-semibold text-gray-700 dark:text-gray-200',
};

const LEVEL_PLACEHOLDERS = {
    1: 'Heading 1',
    2: 'Heading 2',
    3: 'Heading 3',
    4: 'Heading 4',
};

const HeadingBlock = ({ block, onBlockChange, onRemoveBlock, onAddBlockAfter, registerRef }) => {
    const [showLevelPicker, setShowLevelPicker] = useState(false);
    const level = block.meta?.level || 1;
    const inputRef = useRef(null);

    // Register with parent for auto-focus
    useEffect(() => {
        if (registerRef) registerRef(block.id, inputRef.current);
        return () => { if (registerRef) registerRef(block.id, null); };
    }, [block.id, registerRef]);

    const setLevel = (l) => {
        onBlockChange(block.id, block.content, { ...block.meta, level: l });
        setShowLevelPicker(false);
    };

    const handleKeyDown = (e) => {
        // Shift + Enter → new text block below
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (onAddBlockAfter) onAddBlockAfter(block.id);
        }
        // Plain Enter → default (browser adds newline or moves within input — native behavior)
    };

    return (
        <div className="group relative mb-3">
            <div className="flex items-center gap-2">
                {/* Level picker */}
                <div className="relative">
                    <button
                        onClick={() => setShowLevelPicker(v => !v)}
                        className="flex items-center gap-0.5 text-xs font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500 w-8"
                    >
                        H{level}<ChevronDown size={10} />
                    </button>
                    {showLevelPicker && (
                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
                            {[1, 2, 3, 4].map(l => (
                                <button
                                    key={l}
                                    onClick={() => setLevel(l)}
                                    className={`w-full text-left px-3 py-1.5 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${l === level ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-700 dark:text-gray-300'}`}
                                >
                                    H{l}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={block.content}
                    onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                    onKeyDown={handleKeyDown}
                    placeholder={LEVEL_PLACEHOLDERS[level]}
                    className={`flex-1 border-none focus:ring-0 p-0 bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-600 ${LEVEL_STYLES[level]}`}
                />

                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
};

export default HeadingBlock;

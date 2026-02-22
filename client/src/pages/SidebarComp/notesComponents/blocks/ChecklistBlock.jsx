import React, { useState, useRef } from 'react';
import { Trash2, Plus } from 'lucide-react';

const ChecklistBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const newItemRef = useRef(null);

    // items: [{ id, text, done }]
    const items = (() => {
        try {
            const parsed = JSON.parse(block.content);
            return Array.isArray(parsed) ? parsed : [{ id: Date.now(), text: '', done: false }];
        } catch {
            return [{ id: Date.now(), text: block.content || '', done: false }];
        }
    })();

    const save = (newItems) => {
        onBlockChange(block.id, JSON.stringify(newItems), block.meta);
    };

    const toggleItem = (id) => {
        save(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
    };

    const updateText = (id, text) => {
        save(items.map(it => it.id === id ? { ...it, text } : it));
    };

    const addItem = () => {
        save([...items, { id: Date.now(), text: '', done: false }]);
        setTimeout(() => {
            const inputs = document.querySelectorAll(`[data-checklist-id="${block.id}"] input[type="text"]`);
            inputs[inputs.length - 1]?.focus();
        }, 50);
    };

    const removeItem = (id) => {
        const newItems = items.filter(it => it.id !== id);
        save(newItems.length > 0 ? newItems : [{ id: Date.now(), text: '', done: false }]);
    };

    const handleKeyDown = (e, id, idx) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addItem();
        }
        if (e.key === 'Backspace' && items[idx].text === '' && items.length > 1) {
            e.preventDefault();
            removeItem(id);
        }
    };

    const done = items.filter(i => i.done).length;
    const total = items.length;

    return (
        <div className="group relative mb-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden">
                {/* Progress bar header */}
                {total > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: total > 0 ? `${(done / total) * 100}%` : '0%' }}
                            />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                            {done}/{total}
                        </span>
                        <button
                            onClick={() => onRemoveBlock(block.id)}
                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}

                {/* Items */}
                <div className="p-3 space-y-1" data-checklist-id={block.id}>
                    {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2.5 group/item py-0.5">
                            <input
                                type="checkbox"
                                checked={item.done}
                                onChange={() => toggleItem(item.id)}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500 focus:ring-1 cursor-pointer flex-shrink-0"
                            />
                            <input
                                type="text"
                                value={item.text}
                                onChange={e => updateText(item.id, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, item.id, idx)}
                                placeholder="Task item..."
                                className={`flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm ${item.done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'} placeholder-gray-300 dark:placeholder-gray-600`}
                            />
                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add item */}
                <button
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2 w-full text-left text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                    <Plus size={13} /> Add item
                </button>
            </div>
        </div>
    );
};

export default ChecklistBlock;

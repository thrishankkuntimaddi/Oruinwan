import React, { useRef } from 'react';
import { Trash2, Plus } from 'lucide-react';

const ChecklistBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const listRef = useRef(null);

    const items = (() => {
        try {
            const parsed = JSON.parse(block.content);
            return Array.isArray(parsed) ? parsed : [{ id: Date.now(), text: '', done: false }];
        } catch {
            return [{ id: Date.now(), text: block.content || '', done: false }];
        }
    })();

    const save = (newItems) => onBlockChange(block.id, JSON.stringify(newItems), block.meta);

    const toggleItem = (id) => save(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
    const updateText = (id, text) => save(items.map(it => it.id === id ? { ...it, text } : it));
    const removeItem = (id) => {
        const next = items.filter(it => it.id !== id);
        save(next.length > 0 ? next : [{ id: Date.now(), text: '', done: false }]);
    };
    const addItem = () => {
        save([...items, { id: Date.now(), text: '', done: false }]);
        setTimeout(() => {
            const inputs = listRef.current?.querySelectorAll('input[type="text"]');
            inputs?.[inputs.length - 1]?.focus();
        }, 50);
    };

    const handleKeyDown = (e, id, idx) => {
        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
        if (e.key === 'Backspace' && items[idx].text === '' && items.length > 1) {
            e.preventDefault(); removeItem(id);
        }
    };

    const done = items.filter(i => i.done).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="group relative mb-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">

                {/* Progress header */}
                <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className={`text-xs font-semibold tabular-nums min-w-[2rem] text-right ${pct === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {done}/{total}
                    </span>
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>

                {/* Items */}
                <div className="px-3 pb-1 space-y-0.5" ref={listRef}>
                    {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 group/item transition-colors">
                            {/* Custom checkbox */}
                            <button
                                onClick={() => toggleItem(item.id)}
                                className={`flex-shrink-0 w-4.5 h-4.5 w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-all ${item.done
                                        ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500'
                                    }`}
                            >
                                {item.done && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                            <input
                                type="text"
                                value={item.text}
                                onChange={e => updateText(item.id, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, item.id, idx)}
                                placeholder="To-do item..."
                                className={`flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm transition-all ${item.done
                                        ? 'line-through text-gray-400 dark:text-gray-600'
                                        : 'text-gray-700 dark:text-gray-200'
                                    } placeholder-gray-300 dark:placeholder-gray-700`}
                            />
                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all rounded"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add item footer */}
                <button
                    onClick={addItem}
                    className="flex items-center gap-2 px-4 py-2.5 w-full text-left text-xs font-medium text-gray-400 dark:text-gray-600 hover:text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-t border-gray-100 dark:border-gray-800 transition-colors"
                >
                    <Plus size={13} /> Add item
                </button>
            </div>
        </div>
    );
};

export default ChecklistBlock;

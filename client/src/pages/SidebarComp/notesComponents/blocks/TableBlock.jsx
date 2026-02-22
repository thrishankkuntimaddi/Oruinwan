import React, { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

const DEFAULT_TABLE = {
    rows: [
        ['', '', ''],
        ['', '', ''],
    ],
    headers: ['Column 1', 'Column 2', 'Column 3'],
};

const TableBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const data = (() => {
        try {
            const p = JSON.parse(block.content);
            return p && p.headers ? p : DEFAULT_TABLE;
        } catch {
            return DEFAULT_TABLE;
        }
    })();

    const save = (newData) => {
        onBlockChange(block.id, JSON.stringify(newData), block.meta);
    };

    const updateHeader = (colIdx, val) => {
        const headers = data.headers.map((h, i) => i === colIdx ? val : h);
        save({ ...data, headers });
    };

    const updateCell = (rowIdx, colIdx, val) => {
        const rows = data.rows.map((row, ri) =>
            ri === rowIdx ? row.map((cell, ci) => ci === colIdx ? val : cell) : row
        );
        save({ ...data, rows });
    };

    const addRow = () => {
        save({ ...data, rows: [...data.rows, data.headers.map(() => '')] });
    };

    const addCol = () => {
        save({
            headers: [...data.headers, `Column ${data.headers.length + 1}`],
            rows: data.rows.map(row => [...row, '']),
        });
    };

    const removeRow = (ri) => {
        if (data.rows.length <= 1) return;
        save({ ...data, rows: data.rows.filter((_, i) => i !== ri) });
    };

    const removeCol = (ci) => {
        if (data.headers.length <= 1) return;
        save({
            headers: data.headers.filter((_, i) => i !== ci),
            rows: data.rows.map(row => row.filter((_, i) => i !== ci)),
        });
    };

    const cellClass = 'px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-transparent border-none focus:ring-0 outline-none w-full h-full';

    return (
        <div className="group relative mb-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-full">
                        {/* Header row */}
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                {data.headers.map((h, ci) => (
                                    <th key={ci} className="relative border-r border-gray-200 dark:border-gray-700 last:border-r-0 group/col">
                                        <input
                                            value={h}
                                            onChange={e => updateHeader(ci, e.target.value)}
                                            className={`${cellClass} font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wide`}
                                            placeholder={`Header ${ci + 1}`}
                                        />
                                        <button
                                            onClick={() => removeCol(ci)}
                                            className="absolute top-1 right-1 p-0.5 text-gray-300 hover:text-red-400 opacity-0 group-hover/col:opacity-100 transition-opacity"
                                            title="Remove column"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </th>
                                ))}
                                <th className="w-8 border-l border-gray-200 dark:border-gray-700 px-1">
                                    <button
                                        onClick={addCol}
                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors mx-auto"
                                        title="Add column"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </th>
                            </tr>
                        </thead>

                        {/* Body rows */}
                        <tbody>
                            {data.rows.map((row, ri) => (
                                <tr key={ri} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 group/row transition-colors">
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="border-r border-gray-100 dark:border-gray-700 last:border-r-0">
                                            <input
                                                value={cell}
                                                onChange={e => updateCell(ri, ci, e.target.value)}
                                                className={cellClass}
                                                placeholder="—"
                                            />
                                        </td>
                                    ))}
                                    <td className="w-8 border-l border-gray-100 dark:border-gray-700 px-1">
                                        <button
                                            onClick={() => removeRow(ri)}
                                            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-opacity rounded mx-auto"
                                            title="Remove row"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Add row */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        <Plus size={12} /> Add row
                    </button>
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableBlock;

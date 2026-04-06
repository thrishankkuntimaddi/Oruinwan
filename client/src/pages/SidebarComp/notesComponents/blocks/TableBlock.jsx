import React from 'react';
import { Trash2, Plus } from 'lucide-react';

const DEFAULT_TABLE = {
    headers: ['Column 1', 'Column 2', 'Column 3'],
    rows: [['', '', ''], ['', '', '']],
};

const TableBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const data = (() => {
        try {
            const p = JSON.parse(block.content);
            return p?.headers ? p : DEFAULT_TABLE;
        } catch { return DEFAULT_TABLE; }
    })();

    const save = (newData) => onBlockChange(block.id, JSON.stringify(newData), block.meta);
    const updateHeader = (ci, val) => save({ ...data, headers: data.headers.map((h, i) => i === ci ? val : h) });
    const updateCell = (ri, ci, val) => save({ ...data, rows: data.rows.map((row, r) => r === ri ? row.map((c, i) => i === ci ? val : c) : row) });
    const addRow = () => save({ ...data, rows: [...data.rows, data.headers.map(() => '')] });
    const addCol = () => save({ headers: [...data.headers, `Column ${data.headers.length + 1}`], rows: data.rows.map(r => [...r, '']) });
    const removeRow = (ri) => { if (data.rows.length > 1) save({ ...data, rows: data.rows.filter((_, i) => i !== ri) }); };
    const removeCol = (ci) => {
        if (data.headers.length > 1) save({ headers: data.headers.filter((_, i) => i !== ci), rows: data.rows.map(r => r.filter((_, i) => i !== ci)) });
    };

    const cell = { borderRight: '1px solid rgba(255,255,255,0.06)', padding: 0, position: 'relative' };
    const inp = { width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif', padding: '8px 12px' };

    return (
        <div className="group relative mb-4">
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#111', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        {/* Header */}
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {data.headers.map((h, ci) => (
                                    <th key={ci} style={{ ...cell, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                                        className="relative group/hcol">
                                        <input
                                            value={h}
                                            onChange={e => updateHeader(ci, e.target.value)}
                                            placeholder={`Column ${ci + 1}`}
                                            style={{ ...inp, fontSize: '10px', fontWeight: 700, color: 'rgba(228,228,228,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 12px' }}
                                        />
                                        {data.headers.length > 1 && (
                                            <button
                                                onClick={() => removeCol(ci)}
                                                style={{ position: 'absolute', top: '6px', right: '4px', padding: '2px', color: 'rgba(228,228,228,0.15)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 100ms ease' }}
                                                className="group-hover/hcol:!opacity-100"
                                                title="Remove column"
                                                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.15)'}
                                            >
                                                <Trash2 size={9} />
                                            </button>
                                        )}
                                    </th>
                                ))}
                                {/* Add column */}
                                <th style={{ width: '36px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                    <button
                                        onClick={addCol}
                                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(228,228,228,0.2)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 6px', transition: 'color 150ms ease' }}
                                        title="Add column"
                                        onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                                    >
                                        <Plus size={12} />
                                    </button>
                                </th>
                            </tr>
                        </thead>

                        {/* Body */}
                        <tbody>
                            {data.rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                    className="group/row"
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {row.map((cellVal, ci) => (
                                        <td key={ci} style={{ ...cell, borderRight: ci < row.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                            <input
                                                value={cellVal}
                                                onChange={e => updateCell(ri, ci, e.target.value)}
                                                placeholder="—"
                                                style={{ ...inp, fontSize: '13px' }}
                                            />
                                        </td>
                                    ))}
                                    {/* Row delete */}
                                    <td style={{ width: '36px', padding: '4px' }}>
                                        {data.rows.length > 1 && (
                                            <button
                                                onClick={() => removeRow(ri)}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(228,228,228,0.15)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 4px', opacity: 0, transition: 'all 150ms ease' }}
                                                className="group-hover/row:!opacity-100"
                                                title="Remove row"
                                                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.15)'}
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        onClick={addRow}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 500, color: 'rgba(228,228,228,0.3)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.3)'}
                    >
                        <Plus size={11} /> Add row
                    </button>
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        style={{ padding: '4px', color: 'rgba(228,228,228,0.2)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TableBlock;

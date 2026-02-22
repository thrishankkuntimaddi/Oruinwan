import React, { useState } from 'react';
import { Trash2, Copy, Check, ChevronDown, Terminal } from 'lucide-react';

const LANGUAGES = [
    'javascript', 'typescript', 'python', 'bash', 'json',
    'html', 'css', 'sql', 'java', 'go', 'rust', 'c', 'cpp', 'plaintext'
];

const LANG_COLORS = {
    javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab', bash: '#4eaa25',
    json: '#a97dff', html: '#e34c26', css: '#264de4', sql: '#336791',
    java: '#b07219', go: '#00acd7', rust: '#ce422b', c: '#555555', cpp: '#f34b7d', plaintext: '#888'
};

const CodeBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [copied, setCopied] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const lang = block.meta?.lang || 'javascript';
    const dotColor = LANG_COLORS[lang] || '#888';

    const handleCopy = async () => {
        await navigator.clipboard.writeText(block.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const setLang = (l) => {
        onBlockChange(block.id, block.content, { ...block.meta, lang: l });
        setShowLangPicker(false);
    };

    return (
        <div className="group relative mb-4">
            <div className="rounded-xl overflow-hidden shadow-lg border border-gray-800/80">
                {/* MacOS-style header bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1e2e]">
                    {/* Traffic lights */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-[6px]">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                        </div>
                        <div className="h-3.5 w-px bg-gray-700" />
                        {/* Language picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLangPicker(v => !v)}
                                className="flex items-center gap-1.5 text-xs font-mono font-medium text-gray-400 hover:text-gray-200 transition-colors group/lang"
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: dotColor }}
                                />
                                {lang}
                                <ChevronDown size={10} className={`transition-transform ${showLangPicker ? 'rotate-180' : ''}`} />
                            </button>
                            {showLangPicker && (
                                <div className="absolute left-0 top-full mt-2 bg-[#1a1a2e] border border-gray-700 rounded-xl shadow-2xl z-30 max-h-52 overflow-y-auto min-w-[140px] py-1">
                                    {LANGUAGES.map(l => (
                                        <button
                                            key={l}
                                            onClick={() => setLang(l)}
                                            className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 hover:bg-gray-800 transition-colors ${l === lang ? 'text-blue-400' : 'text-gray-400'}`}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: LANG_COLORS[l] || '#888' }} />
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${copied
                                    ? 'bg-emerald-900/50 text-emerald-400'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                }`}
                        >
                            {copied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
                        </button>
                        <button
                            onClick={() => onRemoveBlock(block.id)}
                            className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-900/20"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Code area */}
                <div className="relative bg-[#13131f]">
                    {/* Line numbers visual stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-10 bg-[#0f0f1a] border-r border-gray-800/50 pointer-events-none" />
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        spellCheck={false}
                        placeholder={`// ${lang} code...`}
                        className="w-full font-mono text-[13px] text-gray-200 bg-transparent p-4 pl-12 outline-none resize-none min-h-[110px] placeholder-gray-700 leading-[1.7] tracking-tight"
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                        style={{ tabSize: 2 }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeBlock;

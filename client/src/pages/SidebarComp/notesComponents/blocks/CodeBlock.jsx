import React, { useState } from 'react';
import { Trash2, Copy, Check, ChevronDown } from 'lucide-react';

const LANGUAGES = ['plaintext', 'javascript', 'typescript', 'python', 'bash', 'json', 'html', 'css', 'sql', 'java', 'go', 'rust', 'c', 'cpp'];

const CodeBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [copied, setCopied] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const lang = block.meta?.lang || 'javascript';

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
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
                    {/* Language picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLangPicker(v => !v)}
                            className="flex items-center gap-1 text-xs font-mono font-semibold text-gray-400 hover:text-gray-200 transition-colors"
                        >
                            {lang} <ChevronDown size={11} />
                        </button>
                        {showLangPicker && (
                            <div className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto min-w-[130px]">
                                {LANGUAGES.map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setLang(l)}
                                        className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-gray-700 transition-colors ${l === lang ? 'text-blue-400 bg-gray-700' : 'text-gray-300'}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                        >
                            {copied ? <><Check size={13} className="text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy size={13} />Copy</>}
                        </button>
                        <button
                            onClick={() => onRemoveBlock(block.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Code editor */}
                <div className="relative bg-gray-950">
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        spellCheck={false}
                        placeholder={`// Write ${lang} code here...`}
                        className="w-full font-mono text-sm text-green-300 bg-transparent p-4 outline-none resize-none min-h-[100px] placeholder-gray-600 leading-relaxed"
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                        style={{ tabSize: 2 }}
                    />
                </div>
            </div>
        </div>
    );
};

export default CodeBlock;

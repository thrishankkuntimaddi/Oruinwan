import React from 'react';
import { Trash2, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const CALLOUT_TYPES = {
    info: {
        label: 'Info',
        icon: Info,
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
        iconColor: 'text-blue-500',
        textColor: 'text-blue-900 dark:text-blue-100',
    },
    warning: {
        label: 'Warning',
        icon: AlertTriangle,
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-700',
        iconColor: 'text-amber-500',
        textColor: 'text-amber-900 dark:text-amber-100',
    },
    success: {
        label: 'Success',
        icon: CheckCircle,
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        border: 'border-emerald-200 dark:border-emerald-700',
        iconColor: 'text-emerald-500',
        textColor: 'text-emerald-900 dark:text-emerald-100',
    },
    error: {
        label: 'Error',
        icon: XCircle,
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-700',
        iconColor: 'text-red-500',
        textColor: 'text-red-900 dark:text-red-100',
    },
};

const CalloutBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const variant = block.meta?.variant || 'info';
    const style = CALLOUT_TYPES[variant];
    const Icon = style.icon;

    const cycleVariant = () => {
        const keys = Object.keys(CALLOUT_TYPES);
        const next = keys[(keys.indexOf(variant) + 1) % keys.length];
        onBlockChange(block.id, block.content, { ...block.meta, variant: next });
    };

    return (
        <div className="group relative mb-4">
            <div className={`flex gap-3 p-4 rounded-xl border-l-4 ${style.bg} ${style.border}`}>
                {/* Icon — clickable to cycle type */}
                <button
                    onClick={cycleVariant}
                    className={`mt-0.5 flex-shrink-0 ${style.iconColor} hover:scale-110 transition-transform`}
                    title={`Type: ${style.label} (click to change)`}
                >
                    <Icon size={18} />
                </button>

                {/* Content */}
                <textarea
                    value={block.content}
                    onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                    placeholder={`${style.label}: Write your callout text...`}
                    className={`flex-1 bg-transparent border-none focus:ring-0 outline-none resize-none text-sm leading-relaxed ${style.textColor} placeholder-current placeholder-opacity-40 min-h-[1.5em]`}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />

                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity self-start"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export default CalloutBlock;

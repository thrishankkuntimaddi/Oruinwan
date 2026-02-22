import React from 'react';
import { Trash2, Info, AlertTriangle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

const CALLOUT_TYPES = {
    info: {
        label: 'Info',
        icon: Info,
        accent: '#3b82f6',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200 dark:border-blue-800/60',
        iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        iconColor: 'text-blue-600 dark:text-blue-400',
        textColor: 'text-blue-900 dark:text-blue-100',
        labelColor: 'text-blue-500 dark:text-blue-400',
        barColor: 'bg-blue-500',
    },
    warning: {
        label: 'Warning',
        icon: AlertTriangle,
        accent: '#f59e0b',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800/60',
        iconBg: 'bg-amber-100 dark:bg-amber-900/50',
        iconColor: 'text-amber-600 dark:text-amber-400',
        textColor: 'text-amber-900 dark:text-amber-100',
        labelColor: 'text-amber-500 dark:text-amber-400',
        barColor: 'bg-amber-500',
    },
    success: {
        label: 'Success',
        icon: CheckCircle,
        accent: '#10b981',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        textColor: 'text-emerald-900 dark:text-emerald-100',
        labelColor: 'text-emerald-500 dark:text-emerald-400',
        barColor: 'bg-emerald-500',
    },
    error: {
        label: 'Error',
        icon: XCircle,
        accent: '#ef4444',
        bg: 'bg-red-50 dark:bg-red-950/40',
        border: 'border-red-200 dark:border-red-800/60',
        iconBg: 'bg-red-100 dark:bg-red-900/50',
        iconColor: 'text-red-600 dark:text-red-400',
        textColor: 'text-red-900 dark:text-red-100',
        labelColor: 'text-red-500 dark:text-red-400',
        barColor: 'bg-red-500',
    },
    tip: {
        label: 'Tip',
        icon: Lightbulb,
        accent: '#8b5cf6',
        bg: 'bg-violet-50 dark:bg-violet-950/40',
        border: 'border-violet-200 dark:border-violet-800/60',
        iconBg: 'bg-violet-100 dark:bg-violet-900/50',
        iconColor: 'text-violet-600 dark:text-violet-400',
        textColor: 'text-violet-900 dark:text-violet-100',
        labelColor: 'text-violet-500 dark:text-violet-400',
        barColor: 'bg-violet-500',
    },
};

const CalloutBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const variant = block.meta?.variant || 'info';
    const style = CALLOUT_TYPES[variant] || CALLOUT_TYPES.info;
    const Icon = style.icon;

    const cycleVariant = () => {
        const keys = Object.keys(CALLOUT_TYPES);
        const next = keys[(keys.indexOf(variant) + 1) % keys.length];
        onBlockChange(block.id, block.content, { ...block.meta, variant: next });
    };

    return (
        <div className="group relative mb-3">
            <div className={`relative flex gap-3.5 p-4 rounded-xl border ${style.bg} ${style.border} transition-all`}>
                {/* Accent left bar */}
                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${style.barColor}`} />

                {/* Icon button */}
                <button
                    onClick={cycleVariant}
                    className={`mt-0.5 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg ${style.iconBg} ${style.iconColor} hover:scale-110 transition-all shadow-sm`}
                    title={`Type: ${style.label} — click to change`}
                >
                    <Icon size={15} strokeWidth={2} />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${style.labelColor}`}>
                        {style.label}
                    </div>
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        placeholder={`Add a ${style.label.toLowerCase()} note...`}
                        className={`w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-sm leading-relaxed font-medium ${style.textColor} placeholder-current placeholder-opacity-30 min-h-[1.4em]`}
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                </div>

                {/* Delete */}
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="self-start p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

export default CalloutBlock;

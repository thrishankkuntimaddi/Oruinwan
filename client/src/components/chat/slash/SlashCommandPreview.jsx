import React from "react";
import { ArrowRight } from "lucide-react";

export default function SlashCommandPreview({ command, onClose }) {
  if (!command?.preview) return null;
  const { preview } = command;

  return (
    <div className="mx-4 mb-1 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      {}
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/60`}
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.04) 100%)" }}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${command.color}`}
        >
          {command.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {preview.title}
          </span>
          <span className="ml-2 font-mono text-[10px] text-gray-400 dark:text-gray-500">
            {command.command}
          </span>
        </div>
        <button
          onMouseDown={(e) => { e.preventDefault(); onClose?.(); }}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-xs p-0.5 rounded transition-colors"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {}
      <div className="px-4 py-2.5 space-y-1.5">
        {preview.actions.map((action, i) => (
          <div key={i} className="flex items-center gap-2.5 group cursor-default">
            <span className="text-base w-5 text-center flex-shrink-0">{action.icon}</span>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                {action.label}
              </span>
              <ArrowRight size={10} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {action.detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      {}
      {preview.hint && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/40">
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate">
            {preview.hint}
          </p>
        </div>
      )}
    </div>
  );
}

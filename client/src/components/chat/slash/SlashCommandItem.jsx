import React from "react";

/**
 * SlashCommandItem
 * Single row in the slash command dropdown.
 *
 * Props:
 *   command    – command object from mockSlashCommands
 *   isActive   – boolean (keyboard-highlighted)
 *   onSelect   – (command) => void
 *   onHover    – (command) => void — preview on hover
 */
export default function SlashCommandItem({ command, isActive, onSelect, onHover }) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault(); // prevent blur before click registers
        onSelect(command);
      }}
      onMouseEnter={() => onHover?.(command)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group rounded-lg ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/30"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/60"
      }`}
    >
      {/* Emoji icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 transition-transform group-hover:scale-110 ${command.color}`}
      >
        {command.emoji}
      </div>

      {/* Command + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-bold ${
              isActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {command.command}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 dark:text-gray-600 hidden sm:block">
            {command.label}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 leading-tight">
          {command.description}
        </p>
      </div>

      {/* Arrow hint */}
      <span
        className={`text-xs flex-shrink-0 transition-opacity ${
          isActive
            ? "opacity-100 text-blue-400"
            : "opacity-0 group-hover:opacity-60 text-gray-400"
        }`}
      >
        ↵
      </span>
    </button>
  );
}

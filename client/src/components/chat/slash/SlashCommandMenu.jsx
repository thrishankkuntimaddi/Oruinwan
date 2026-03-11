import React, { useEffect, useRef, useState } from "react";
import { SLASH_COMMANDS, SLASH_COMMAND_CATEGORIES, filterSlashCommands } from "./mockSlashCommands";
import SlashCommandItem from "./SlashCommandItem";

/**
 * SlashCommandMenu
 * Floating dropdown that appears above the message composer when the user types `/`.
 * Full keyboard navigation, category grouping, hover preview trigger, and filtering.
 *
 * Props:
 *   query          – string (current text in the input, e.g. "/git")
 *   onSelect       – (command) => void — called when a command is chosen
 *   onClose        – () => void — called to dismiss the menu
 *   onPreviewChange– (command | null) => void — called on hover/arrow navigation to drive preview
 */
export default function SlashCommandMenu({ query, onSelect, onClose, onPreviewChange }) {
  const filtered = filterSlashCommands(query);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);
  const activeItemRef = useRef(null);

  // Clamp activeIdx when filtered list changes
  useEffect(() => {
    const clamped = Math.min(activeIdx, Math.max(filtered.length - 1, 0));
    setActiveIdx(clamped);
    onPreviewChange?.(filtered[clamped] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    onPreviewChange?.(filtered[activeIdx] ?? null);
  }, [activeIdx, filtered, onPreviewChange]);

  // Keyboard navigation — exposed via a ref so parent can call it on keydown
  // Parent (FooterInput) calls handleKey() with the KeyboardEvent
  SlashCommandMenu.handleKey = (e) => {
    if (!filtered.length) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (filtered[activeIdx]) {
        onSelect(filtered[activeIdx]);
      }
      return true;
    }
    if (e.key === "Escape") {
      onClose?.();
      return true;
    }
    return false;
  };

  if (!filtered.length) {
    return (
      <div className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[60] px-4 py-6 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">No commands match <span className="font-mono text-gray-600 dark:text-gray-400">{query}</span></p>
      </div>
    );
  }

  // Group the filtered commands by category for display
  const grouped = SLASH_COMMAND_CATEGORIES
    .map((cat) => ({
      ...cat,
      commands: filtered.filter((cmd) => cmd.category === cat.id),
    }))
    .filter((cat) => cat.commands.length > 0);

  // Flat index tracker for keyboard nav across groups
  let flatIdx = 0;

  return (
    <div
      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[60] overflow-hidden"
      onMouseDown={(e) => e.preventDefault()} // prevent blur
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Commands
          </span>
          {query && query !== "/" && (
            <span className="font-mono text-[10px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md">
              {query}
            </span>
          )}
        </div>
        <button
          onMouseDown={(e) => { e.preventDefault(); onClose?.(); }}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 text-xs p-0.5 rounded transition-colors"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Scrollable list */}
      <div ref={listRef} className="max-h-[260px] overflow-y-auto custom-scrollbar p-1.5 space-y-2">
        {grouped.map((cat) => (
          <div key={cat.id}>
            {/* Category label */}
            <div className="px-2 pt-1 pb-1">
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {cat.label}
              </span>
            </div>
            {/* Commands */}
            {cat.commands.map((cmd) => {
              const thisIdx = flatIdx++;
              return (
                <div
                  key={cmd.command}
                  ref={thisIdx === activeIdx ? activeItemRef : null}
                >
                  <SlashCommandItem
                    command={cmd}
                    isActive={thisIdx === activeIdx}
                    onSelect={onSelect}
                    onHover={() => {
                      setActiveIdx(thisIdx);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer keyboard hint */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex items-center gap-3">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <kbd className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded px-1 py-px text-[9px] font-mono">↑↓</kbd> navigate
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <kbd className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded px-1 py-px text-[9px] font-mono">↵</kbd> select
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <kbd className="bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded px-1 py-px text-[9px] font-mono">Esc</kbd> close
        </span>
      </div>
    </div>
  );
}

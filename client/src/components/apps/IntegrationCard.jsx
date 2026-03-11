import React from "react";
import { CheckCircle2, ZapOff } from "lucide-react";

/**
 * IntegrationCard
 * Displays a single integration with name, description, status badge, and connect button.
 * All state is driven from parent (AppsPage or similar).
 *
 * Props:
 *   integration   – object from mockIntegrations
 *   connected     – boolean (controlled by parent)
 *   onCardClick   – () => void — opens IntegrationDetailsModal
 *   onToggle      – () => void — quick toggle from card (optional)
 */
export default function IntegrationCard({ integration, connected, onCardClick }) {
  return (
    <button
      onClick={onCardClick}
      className="group relative flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-left hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg dark:hover:shadow-blue-900/10 transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Connected badge */}
      {connected && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
          <CheckCircle2 size={11} className="flex-shrink-0" />
          Connected
        </span>
      )}
      {!connected && (
        <span className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
          <ZapOff size={11} className="flex-shrink-0" />
          Not Connected
        </span>
      )}

      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200`}
      >
        {integration.emoji}
      </div>

      {/* Name */}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate pr-16">
        {integration.name}
      </h3>

      {/* Category label */}
      <span className="text-[11px] text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wide">
        {integration.categoryLabel}
      </span>

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
        {integration.description}
      </p>

      {/* Hover CTA stripe */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span
          className={`text-xs font-semibold ${
            connected
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-blue-600 dark:text-blue-400"
          } group-hover:underline`}
        >
          {connected ? "Manage →" : "Connect →"}
        </span>
      </div>
    </button>
  );
}

import React, { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";

/**
 * IntegrationActionModal
 * Generic confirmation modal for message context menu integration actions.
 * No real API calls — mock only.
 *
 * Props:
 *   title        – string — modal title ("Add to Linear")
 *   integration  – string — integration name
 *   emoji        – string — emoji icon
 *   description  – string — body text
 *   confirmLabel – string — confirm button text
 *   onClose      – () => void
 */
export default function IntegrationActionModal({ title, integration, emoji, description, confirmLabel = "Confirm", onClose }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      setTimeout(() => onClose(), 1600);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <span className="text-2xl">{emoji}</span>
          <h3 className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 text-center">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-2 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Done!</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Action completed in {integration}.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{description}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                This is a visual prototype — no real action will be taken.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "In progress…" : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

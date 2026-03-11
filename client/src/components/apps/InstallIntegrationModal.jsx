import React, { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";

/**
 * InstallIntegrationModal
 * Lightweight quick-install confirmation overlay.
 * Used for fast install flows without full details.
 *
 * Props:
 *   integration   – object from mockIntegrations
 *   onClose       – () => void
 *   onInstalled   – (integrationId) => void — called after fake install completes
 */
export default function InstallIntegrationModal({ integration, onClose, onInstalled }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!integration) return null;

  const handleInstall = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      onInstalled?.(integration.id);
      setTimeout(() => onClose(), 1500);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Install Integration
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {integration.name} connected!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can manage this integration in Apps settings.
              </p>
            </div>
          ) : (
            <>
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-3xl mx-auto shadow-md`}>
                {integration.emoji}
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {integration.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {integration.description}
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                This is a visual prototype. No real data will be accessed.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInstall}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { X, CheckCircle2, Loader2, Shield, Zap, ChevronRight } from "lucide-react";

/**
 * IntegrationDetailsModal
 * Full-screen modal showing integration details with fake connect/disconnect flow.
 * All state is local — no API calls.
 *
 * Props:
 *   integration   – object from mockIntegrations (or null)
 *   connected     – boolean (initial connected state from parent)
 *   onClose       – () => void
 *   onStatusChange– (integrationId, newConnected: boolean) => void
 */
export default function IntegrationDetailsModal({ integration, connected, onClose, onStatusChange }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!integration) return null;

  const handleConnect = () => {
    setLoading(true);
    setShowSuccess(false);
    // Fake 2-second delay to simulate OAuth flow
    setTimeout(() => {
      setLoading(false);
      const next = !isConnected;
      setIsConnected(next);
      setShowSuccess(true);
      onStatusChange?.(integration.id, next);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-3xl shadow-md flex-shrink-0`}>
            {integration.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{integration.name}</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
              {integration.categoryLabel}
            </span>
          </div>
          {/* Status badge */}
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Not Connected
            </span>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {integration.description}
          </p>

          {/* Success banner */}
          {showSuccess && (
            <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 animate-fade-in">
              <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {isConnected
                  ? `${integration.name} connected successfully!`
                  : `${integration.name} has been disconnected.`}
              </span>
            </div>
          )}

          {/* Use Cases */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap size={13} />
              What you can do
            </h3>
            <ul className="space-y-2">
              {integration.useCases.map((useCase, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                  <ChevronRight size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  {useCase}
                </li>
              ))}
            </ul>
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield size={13} />
              Permissions required
            </h3>
            <ul className="space-y-2">
              {integration.permissions.map((perm, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm ${
              loading
                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : isConnected
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading
              ? isConnected ? "Disconnecting…" : "Connecting…"
              : isConnected
              ? "Disconnect"
              : `Connect ${integration.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

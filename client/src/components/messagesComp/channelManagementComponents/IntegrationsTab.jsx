import React, { useState } from "react";
import { Puzzle, ExternalLink, CheckCircle2 } from "lucide-react";
import { MOCK_INTEGRATIONS } from "../../apps/mock/mockIntegrations";

// Channel-relevant integrations only
const CHANNEL_INTEGRATIONS = MOCK_INTEGRATIONS.filter((i) =>
  ["github", "jira", "linear", "zoom"].includes(i.id)
);

/**
 * IntegrationsTab
 * Channel-level integration toggles — all local state, no API calls.
 *
 * Shows each integration with a toggle switch.
 * When toggled on: shows "Events will appear in this channel."
 * "Not Connected" integrations show a link to the Apps page.
 */
export default function IntegrationsTab({ globalConnectedMap = {} }) {
  // Channel-level enabled state (per integration for this channel)
  const [channelEnabled, setChannelEnabled] = useState({
    github: false,
    jira: false,
    linear: false,
    zoom: false,
  });

  const toggleIntegration = (id) => {
    setChannelEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
        Enable integrations for this channel. Events from connected apps will appear here as messages.
      </p>

      {CHANNEL_INTEGRATIONS.map((integration) => {
        const isGloballyConnected = globalConnectedMap[integration.id] ?? integration.connected;
        const isEnabled = channelEnabled[integration.id];

        return (
          <div
            key={integration.id}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
              isEnabled && isGloballyConnected
                ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
            }`}
          >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-xl flex-shrink-0`}>
              {integration.emoji}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {integration.name}
                </span>
                {isGloballyConnected ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5">
                    <CheckCircle2 size={9} />
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                    Not Connected
                  </span>
                )}
              </div>
              {isEnabled && isGloballyConnected ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                  ✓ Events will appear in this channel.
                </p>
              ) : !isGloballyConnected ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Connect {integration.name} in{" "}
                  <span className="text-blue-500 dark:text-blue-400 cursor-pointer hover:underline inline-flex items-center gap-0.5">
                    Apps <ExternalLink size={10} />
                  </span>{" "}
                  to enable.
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {integration.description.slice(0, 60)}…
                </p>
              )}
            </div>

            {/* Toggle */}
            <button
              onClick={() => isGloballyConnected && toggleIntegration(integration.id)}
              disabled={!isGloballyConnected}
              className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                !isGloballyConnected
                  ? "bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50"
                  : isEnabled
                  ? "bg-emerald-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
              title={!isGloballyConnected ? `Connect ${integration.name} first in Apps` : ""}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  isEnabled && isGloballyConnected ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        );
      })}

      {/* Empty hint */}
      <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-start gap-3">
        <Puzzle size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Want more integrations? Visit <span className="text-blue-500 dark:text-blue-400 font-medium cursor-pointer hover:underline">Apps & Integrations</span> to connect additional tools to your workspace.
        </p>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { Search, Puzzle, CheckCircle2, Grid3X3 } from "lucide-react";
import { MOCK_INTEGRATIONS, INTEGRATION_CATEGORIES } from "../../components/apps/mock/mockIntegrations";
import IntegrationCard from "../../components/apps/IntegrationCard";
import IntegrationDetailsModal from "../../components/apps/IntegrationDetailsModal";

/**
 * AppsPage — Integration Marketplace
 * Full-width page rendered inside MainLayout.
 * All state is local — no backend calls.
 */
export default function AppsPage() {
  // Track connected state per integration id
  const [connectedMap, setConnectedMap] = useState(() => {
    const init = {};
    MOCK_INTEGRATIONS.forEach((i) => { init[i.id] = i.connected; });
    return init;
  });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  const handleStatusChange = (id, newConnected) => {
    setConnectedMap((prev) => ({ ...prev, [id]: newConnected }));
  };

  // Filtered list
  const filtered = useMemo(() => {
    return MOCK_INTEGRATIONS.filter((i) => {
      const matchesSearch =
        search.trim() === "" ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "all" || i.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  const installed = filtered.filter((i) => connectedMap[i.id]);
  const available = filtered.filter((i) => !connectedMap[i.id]);

  const totalInstalled = MOCK_INTEGRATIONS.filter((i) => connectedMap[i.id]).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-950 min-h-0">

      {/* ──────────── Page Header ──────────── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-8 py-6 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                <Puzzle size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Apps & Integrations</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect your favourite tools to Chttrix
                </p>
              </div>
            </div>
            {totalInstalled > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1.5 font-medium">
                <CheckCircle2 size={14} />
                {totalInstalled} connected
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations…"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {INTEGRATION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                  activeCategory === cat.id
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ──────────── Content ──────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-10">

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Grid3X3 size={28} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                No integrations found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Try a different search or category filter
              </p>
            </div>
          )}

          {/* Installed integrations */}
          {installed.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Installed
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium ml-1">
                  ({installed.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {installed.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    connected={connectedMap[integration.id]}
                    onCardClick={() => setSelectedIntegration(integration)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available integrations */}
          {available.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Grid3X3 size={16} className="text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  Available
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium ml-1">
                  ({available.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {available.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    connected={connectedMap[integration.id]}
                    onCardClick={() => setSelectedIntegration(integration)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedIntegration && (
        <IntegrationDetailsModal
          integration={selectedIntegration}
          connected={connectedMap[selectedIntegration.id]}
          onClose={() => setSelectedIntegration(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

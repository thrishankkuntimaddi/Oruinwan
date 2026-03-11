import React, { useState } from "react";
import { X, Loader2, CheckCircle2, GitBranch } from "lucide-react";

const MOCK_REPOS = [
  "chttrix/frontend",
  "chttrix/backend",
  "chttrix/mobile",
  "chttrix/design-system",
  "chttrix/infra",
];

const MOCK_LABELS = ["bug", "enhancement", "feature", "documentation", "question", "help wanted"];

/**
 * CreateGitHubIssueModal
 * Mock GitHub issue creation modal — no real API calls.
 *
 * Props:
 *   onClose       – () => void
 *   onInsertText  – (text: string) => void — inserts formatted text into chat
 */
export default function CreateGitHubIssueModal({ onClose, onInsertText }) {
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState(MOCK_REPOS[0]);
  const [label, setLabel] = useState("bug");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [issueNumber] = useState(() => Math.floor(Math.random() * 900) + 100);

  const handleCreate = () => {
    if (!title.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      onInsertText?.(
        `📌 **GitHub Issue #${issueNumber}** created in \`${repo}\`\n> **${title.trim()}** · \`${label}\``
      );
      setTimeout(() => onClose(), 1800);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-lg flex-shrink-0">
            🐙
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create GitHub Issue</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">Mock — no real issue will be created</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Issue #{issueNumber} created!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Link added to your message.</p>
            </div>
          ) : (
            <>
              {/* Repository */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Repository
                </label>
                <select
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {MOCK_REPOS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Issue Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fix login redirect bug"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Label
                </label>
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {MOCK_LABELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue…"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
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
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
              {loading ? "Creating…" : "Create Issue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

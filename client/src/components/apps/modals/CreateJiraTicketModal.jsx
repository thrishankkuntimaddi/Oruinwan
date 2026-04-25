import React, { useState } from "react";
import { X, Loader2, CheckCircle2, TicketCheck } from "lucide-react";

const MOCK_PROJECTS = ["CHT – Chttrix", "MOB – Mobile App", "INF – Infrastructure", "DES – Design System"];
const ISSUE_TYPES = ["Bug", "Task", "Story", "Epic", "Subtask"];
const PRIORITIES = [
  { value: "urgent", label: "🔴 Urgent" },
  { value: "high", label: "🟠 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "🟢 Low" },
];

export default function CreateJiraTicketModal({ onClose, onInsertText }) {
  const [project, setProject] = useState(MOCK_PROJECTS[0]);
  const [summary, setSummary] = useState("");
  const [issueType, setIssueType] = useState("Task");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ticketNum] = useState(() => Math.floor(Math.random() * 900) + 100);

  const projectKey = project.split(" – ")[0];

  const handleCreate = () => {
    if (!summary.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      const priorityLabel = PRIORITIES.find((p) => p.value === priority)?.label || priority;
      onInsertText?.(
        `🎫 **Jira ${issueType} ${projectKey}-${ticketNum}** created\n> **${summary.trim()}** · ${priorityLabel}`
      );
      setTimeout(() => onClose(), 1800);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

        {}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-lg flex-shrink-0">
            🎫
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create Jira Ticket</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">Mock — no real ticket will be created</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {}
        <div className="p-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {projectKey}-{ticketNum} created!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Link added to your message.</p>
            </div>
          ) : (
            <>
              {}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Project</label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {MOCK_PROJECTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                  Summary <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Update login flow UX"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Issue Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {}
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
              disabled={loading || !summary.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <TicketCheck size={14} />}
              {loading ? "Creating…" : "Create Ticket"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

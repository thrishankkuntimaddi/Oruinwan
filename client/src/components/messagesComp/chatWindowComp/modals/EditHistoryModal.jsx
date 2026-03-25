// Phase 1 — Edit History Modal
// Shows a chronological diff of all edits to a message

import React, { useMemo } from "react";
import { X, Clock, GitCommit } from "lucide-react";

function diffWords(oldText = "", newText = "") {
    const oldWords = oldText.split(/\s+/);
    const newWords = newText.split(/\s+/);
    const result = [];

    // Simple Myers-style word-level diff via LCS
    const matrix = Array.from({ length: oldWords.length + 1 },
        () => Array(newWords.length + 1).fill(0));

    for (let i = 1; i <= oldWords.length; i++) {
        for (let j = 1; j <= newWords.length; j++) {
            if (oldWords[i - 1] === newWords[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            } else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }

    let i = oldWords.length, j = newWords.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
            result.unshift({ type: "same", word: oldWords[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            result.unshift({ type: "add", word: newWords[j - 1] });
            j--;
        } else {
            result.unshift({ type: "remove", word: oldWords[i - 1] });
            i--;
        }
    }
    return result;
}

function fmtDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

/**
 * @param {object} props
 * @param {object} props.message - The full message object with editHistory[]
 * @param {function} props.onClose
 */
export default function EditHistoryModal({ message, onClose }) {
    // Build an ordered list: [original, ...edits, current]
    const versions = useMemo(() => {
        const history = message?.editHistory || [];
        const list = [];

        // Oldest snapshots first
        for (let i = history.length - 1; i >= 0; i--) {
            list.push({
                text: history[i].text || "(encrypted)",
                editedAt: history[i].editedAt,
                label: i === history.length - 1 ? "Original" : `Edit ${history.length - i}`
            });
        }
        // Current version
        list.push({
            text: message?.text || "(no text)",
            editedAt: message?.editedAt,
            label: "Current"
        });
        return list;
    }, [message]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <GitCommit size={18} className="text-violet-500" />
                        <h2 className="font-semibold text-gray-900 text-base">Edit History</h2>
                        <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                            {versions.length - 1} edit{versions.length !== 2 ? "s" : ""}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>

                {/* Versions list */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
                    {versions.map((version, idx) => {
                        const prev = idx > 0 ? versions[idx - 1] : null;
                        const diff = prev ? diffWords(prev.text, version.text) : null;

                        return (
                            <div key={idx} className="relative">
                                {/* Timeline dot */}
                                {idx < versions.length - 1 && (
                                    <div className="absolute left-[5px] top-6 bottom-[-20px] w-px bg-gray-200" />
                                )}
                                <div className="flex gap-3">
                                    <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 border-2 ${version.label === "Current" ? "bg-violet-500 border-violet-500" : "bg-white border-gray-300"}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-semibold ${version.label === "Current" ? "text-violet-600" : "text-gray-500"}`}>
                                                {version.label}
                                            </span>
                                            {version.editedAt && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {fmtDate(version.editedAt)}
                                                </span>
                                            )}
                                        </div>
                                        {/* Diff view or plain text */}
                                        {diff ? (
                                            <p className="text-sm leading-relaxed text-gray-700 bg-gray-50 rounded-lg px-3 py-2 break-words">
                                                {diff.map((token, ti) => (
                                                    <span
                                                        key={ti}
                                                        className={
                                                            token.type === "add"
                                                                ? "bg-green-100 text-green-800 rounded px-0.5 mx-0.5"
                                                                : token.type === "remove"
                                                                    ? "bg-red-100 text-red-700 line-through rounded px-0.5 mx-0.5"
                                                                    : "mx-0.5"
                                                        }
                                                    >
                                                        {token.word}{" "}
                                                    </span>
                                                ))}
                                            </p>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-gray-700 bg-gray-50 rounded-lg px-3 py-2 break-words">
                                                {version.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

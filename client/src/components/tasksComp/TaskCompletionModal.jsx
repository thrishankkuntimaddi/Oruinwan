import React, { useState } from "react";
import { CheckCircle2, X, Send, PartyPopper, Trash2 } from "lucide-react";

export default function TaskCompletionModal({ task, onClose, onConfirm, mode = "completion" }) {
    const [note, setNote] = useState("");
    const isPersonal = task.assigner === "Self";
    const isDeletion = mode === "deletion";

    const handleConfirm = () => {
        onConfirm(note);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all scale-100 overflow-hidden border border-gray-100">

                {/* Header */}
                <div className={`px-6 py-4 border-b border-gray-100 flex justify-between items-center ${isDeletion ? "bg-gradient-to-r from-red-50 to-orange-50" : isPersonal ? "bg-gradient-to-r from-green-50 to-emerald-50" : "bg-gradient-to-r from-blue-50 to-indigo-50"}`}>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {isDeletion ? (
                            <>
                                <Trash2 size={20} className="text-red-600" />
                                Delete Task?
                            </>
                        ) : isPersonal ? (
                            <>
                                <PartyPopper size={20} className="text-green-600" />
                                Task Completed!
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={20} className="text-blue-600" />
                                Submit Completion
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {isDeletion ? (
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Trash2 size={32} />
                            </div>
                            <p className="text-gray-600">
                                Are you sure you want to move <strong>{task.title}</strong> to trash?
                            </p>
                            <p className="text-sm text-gray-500">
                                You can restore it later from the <strong>Deleted</strong> tab.
                            </p>
                        </div>
                    ) : isPersonal ? (
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 size={32} />
                            </div>
                            <p className="text-gray-600">
                                Great job! You've completed <strong>{task.title}</strong>.
                            </p>
                            <p className="text-sm text-gray-500">
                                This task will be moved to your <strong>Completed</strong> history.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-gray-600 text-sm">
                                You are marking <strong>{task.title}</strong> as complete. Please provide a brief summary of the work done for <strong>{task.assigner}</strong>.
                            </p>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                    Completion Note
                                </label>
                                <textarea
                                    placeholder="e.g. Fixed the login bug by updating the auth token logic..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder-gray-400 min-h-[100px] resize-none text-sm"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-200 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-5 py-2 rounded-xl text-white font-medium shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-sm flex items-center gap-2
                ${isDeletion ? "bg-red-600 hover:bg-red-700 shadow-red-500/30" : isPersonal ? "bg-green-600 hover:bg-green-700 shadow-green-500/30" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"}
            `}
                    >
                        {isDeletion ? (
                            <>
                                <Trash2 size={16} /> Delete Task
                            </>
                        ) : isPersonal ? (
                            <>
                                <CheckCircle2 size={16} /> Complete Task
                            </>
                        ) : (
                            <>
                                <Send size={16} /> Submit & Complete
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

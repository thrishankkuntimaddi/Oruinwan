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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md transition-opacity">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl w-full max-w-md shadow-2xl shadow-blue-900/10 transform transition-all scale-100 overflow-hidden border border-white/50">

                {/* Header */}
                <div className={`px-6 py-4 border-b border-gray-100/50 flex justify-between items-center ${isDeletion ? "bg-gradient-to-r from-red-50/80 to-orange-50/80" : isPersonal ? "bg-gradient-to-r from-green-50/80 to-emerald-50/80" : "bg-gradient-to-r from-blue-50/80 to-indigo-50/80"}`}>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {isDeletion ? (
                            <>
                                <span className="p-1.5 bg-red-100/50 rounded-lg text-red-600"><Trash2 size={18} /></span>
                                Delete Task?
                            </>
                        ) : isPersonal ? (
                            <>
                                <span className="p-1.5 bg-green-100/50 rounded-lg text-green-600"><PartyPopper size={18} /></span>
                                Task Completed!
                            </>
                        ) : (
                            <>
                                <span className="p-1.5 bg-blue-100/50 rounded-lg text-blue-600"><CheckCircle2 size={18} /></span>
                                Submit Completion
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-white/50 p-2 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {isDeletion ? (
                        <div className="text-center space-y-3">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100 shadow-sm">
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
                            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 border border-green-100 shadow-sm">
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
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">
                                    Completion Note
                                </label>
                                <textarea
                                    placeholder="e.g. Fixed the login bug by updating the auth token logic..."
                                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 placeholder-gray-400 min-h-[100px] resize-none text-sm shadow-sm"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100/50 flex justify-end gap-3 sticky bottom-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-gray-600 font-bold text-sm hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-6 py-2 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-sm flex items-center gap-2
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

import React, { useState } from "react";
import { X, User, Send } from "lucide-react";

export default function TransferRequestModal({ task, members = [], onClose, onConfirm }) {
    const [selectedMember, setSelectedMember] = useState("");
    const [note, setNote] = useState("");

    const handleSubmit = () => {

        if (!selectedMember) {
            return alert("Please select a team member to transfer to");
        }
        onConfirm(selectedMember, note);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Send size={20} className="text-blue-500" />
                        Request Task Transfer
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Task Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Task:</p>
                    <p className="font-bold text-gray-900 dark:text-white">{task.title}</p>
                </div>

                {/* Select New Assignee */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <User size={14} />
                        Transfer to:
                    </label>
                    <select
                        value={selectedMember}
                        onChange={(e) => setSelectedMember(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                    >
                        <option value="">Select team member...</option>
                        {members.map((member) => {
                            const memberId = member._id || member.id;
                            return (
                                <option key={memberId} value={memberId}>
                                    {member.username || member.email}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* Reason Note */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        Reason (Optional):
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Why do you need to transfer this task?"
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-900 dark:text-white min-h-[80px] resize-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                    >
                        Send Request
                    </button>
                </div>
            </div>
        </div>
    );
}

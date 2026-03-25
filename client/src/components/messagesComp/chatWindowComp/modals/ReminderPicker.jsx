// Phase 1 — Reminder Picker Modal
// Lets users schedule a "remind me" for any message

import React, { useState } from "react";
import { X, Bell, Clock } from "lucide-react";
import api from "../../../../services/api";

const PRESETS = [
    { label: "In 20 minutes", delta: 20 * 60 * 1000 },
    { label: "In 1 hour", delta: 60 * 60 * 1000 },
    { label: "In 3 hours", delta: 3 * 60 * 60 * 1000 },
    { label: "Tomorrow", delta: 24 * 60 * 60 * 1000 },
    { label: "Next week", delta: 7 * 24 * 60 * 60 * 1000 },
];

/**
 * @param {object} props
 * @param {string} props.messageId
 * @param {function} props.onClose
 * @param {function} [props.onSet] - Called with the reminder object after save
 */
export default function ReminderPicker({ messageId, onClose, onSet }) {
    const [customDate, setCustomDate] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const save = async (remindAt) => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post(`/api/messages/${messageId}/remind`, {
                remindAt: new Date(remindAt).toISOString(),
                note
            });
            setSuccess(true);
            onSet?.(res.data.reminder);
            setTimeout(onClose, 1200);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to set reminder");
        } finally {
            setSaving(false);
        }
    };

    const handlePreset = (delta) => save(Date.now() + delta);
    const handleCustom = () => {
        if (!customDate) return;
        save(customDate);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 mb-4 sm:mb-0 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Bell size={18} className="text-violet-500" />
                        <h3 className="font-semibold text-gray-900 text-sm">Set a Reminder</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={16} className="text-gray-500" />
                    </button>
                </div>

                {/* Presets */}
                <div className="px-5 py-3 space-y-1">
                    {PRESETS.map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => handlePreset(preset.delta)}
                            disabled={saving}
                            className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-violet-50 text-sm text-gray-700 hover:text-violet-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Clock size={14} className="text-gray-400" />
                            {preset.label}
                        </button>
                    ))}
                </div>

                {/* Custom date */}
                <div className="px-5 py-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Custom time</label>
                    <input
                        type="datetime-local"
                        value={customDate}
                        onChange={e => setCustomDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
                    />
                    <input
                        type="text"
                        placeholder="Optional note..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        className="mt-2 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
                    />
                    <button
                        onClick={handleCustom}
                        disabled={!customDate || saving}
                        className="mt-2 w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2.5 rounded-xl transition disabled:opacity-40"
                    >
                        {saving ? "Saving..." : "Set Reminder"}
                    </button>
                </div>

                {/* Feedback */}
                {success && (
                    <div className="px-5 pb-4 text-center text-sm text-green-600 font-medium">
                        ✅ Reminder set!
                    </div>
                )}
                {error && (
                    <div className="px-5 pb-4 text-center text-sm text-red-500">{error}</div>
                )}
            </div>
        </div>
    );
}

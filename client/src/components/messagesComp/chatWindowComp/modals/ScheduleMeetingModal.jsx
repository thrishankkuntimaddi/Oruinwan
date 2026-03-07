/**
 * ScheduleMeetingModal.jsx — Phase 7.6
 *
 * Modal to schedule a meeting in a channel or DM.
 * Calls onSchedule({ title, startTime, duration, meetingLink, participants })
 */
import React, { useState } from 'react';
import { X, Video, Calendar, Clock, Link, Users } from 'lucide-react';

export default function ScheduleMeetingModal({ onSchedule, onClose, conversationId, conversationType }) {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startHour, setStartHour] = useState('09');
    const [startMin, setStartMin] = useState('00');
    const [duration, setDuration] = useState(30);
    const [meetingLink, setMeetingLink] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Build ISO string
    function buildISO() {
        if (!startDate) return null;
        try {
            return new Date(`${startDate}T${startHour}:${startMin}:00`).toISOString();
        } catch { return null; }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (!title.trim()) { setError('A title is required.'); return; }
        const isoTime = buildISO();
        if (!isoTime) { setError('Please set a valid date and time.'); return; }
        if (meetingLink && !/^https?:\/\//.test(meetingLink.trim())) {
            setError('Meeting link must start with http:// or https://'); return;
        }

        setSubmitting(true);
        try {
            await onSchedule({
                title: title.trim(),
                startTime: isoTime,
                duration: Number(duration),
                meetingLink: meetingLink.trim() || null,
                participants: [],  // can be extended to pick members
            });
            onClose();
        } catch (err) {
            setError('Failed to schedule meeting. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const mins = ['00', '15', '30', '45'];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-600">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <Video size={16} className="text-white" />
                    </div>
                    <h2 className="text-base font-bold text-white flex-1">Schedule Meeting</h2>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition p-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Meeting title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Weekly Sync"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={100}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            <Calendar size={12} /> Date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                <Clock size={12} /> Time
                            </label>
                            <div className="flex gap-1">
                                <select
                                    value={startHour}
                                    onChange={e => setStartHour(e.target.value)}
                                    className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {hours.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span className="self-center text-gray-400 dark:text-gray-500 font-bold">:</span>
                                <select
                                    value={startMin}
                                    onChange={e => setStartMin(e.target.value)}
                                    className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {mins.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Duration (min)
                            </label>
                            <select
                                value={duration}
                                onChange={e => setDuration(e.target.value)}
                                className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {[15, 30, 45, 60, 90, 120].map(d =>
                                    <option key={d} value={d}>{d} min</option>
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Meeting link */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            <Link size={12} /> Meeting link (optional)
                        </label>
                        <input
                            type="url"
                            value={meetingLink}
                            onChange={e => setMeetingLink(e.target.value)}
                            placeholder="https://meet.google.com/..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-xs text-red-500 font-medium">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
                        >
                            {submitting ? 'Scheduling…' : 'Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

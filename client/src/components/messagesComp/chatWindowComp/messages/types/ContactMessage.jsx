/**
 * ContactMessage.jsx — Phase 7.4
 *
 * Renders a shared contact card.
 * Reads msg.contact (embedded in the message document).
 *
 * Props:
 *   msg.contact  — { name, email, phone, avatar }
 */
import React from 'react';
import { User, Mail, Phone, UserCircle } from 'lucide-react';

export default function ContactMessage({ msg }) {
    const contact = msg?.contact || msg?.payload?.contact;
    if (!contact) return null;

    const { name, email, phone, avatar } = contact;

    return (
        <div className="mt-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs shadow-sm">
            {/* Header row */}
            <div className="flex items-center gap-3 mb-3">
                {avatar ? (
                    <img
                        src={avatar}
                        alt={name}
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-gray-100 dark:border-gray-700"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <UserCircle size={24} className="text-blue-500 dark:text-blue-400" />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        Contact
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                        {name || 'Unknown Contact'}
                    </p>
                </div>
            </div>

            {/* Detail rows */}
            <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                {email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail size={13} className="flex-shrink-0 text-gray-400" />
                        <a
                            href={`mailto:${email}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate transition-colors"
                        >
                            {email}
                        </a>
                    </div>
                )}
                {phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Phone size={13} className="flex-shrink-0 text-gray-400" />
                        <a
                            href={`tel:${phone}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                        >
                            {phone}
                        </a>
                    </div>
                )}
                {!email && !phone && (
                    <p className="text-xs text-gray-400 italic">No contact details</p>
                )}
            </div>
        </div>
    );
}

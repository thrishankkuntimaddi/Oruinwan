import React from "react";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

/**
 * Reusable Confirmation Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {function} props.onClose - Called when modal is closed/cancelled
 * @param {function} props.onConfirm - Called when user confirms action
 * @param {string} props.title - Modal title
 * @param {string} props.message - Confirmation message
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {string} props.variant - Visual variant: "danger" | "warning" | "info" (default: "danger")
 */
export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger"
}) {
    if (!isOpen) return null;

    // Variant configurations
    const variants = {
        danger: {
            icon: AlertTriangle,
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
            confirmBg: "bg-red-600 hover:bg-red-700",
            confirmText: "text-white"
        },
        warning: {
            icon: AlertCircle,
            iconBg: "bg-yellow-100",
            iconColor: "text-yellow-600",
            confirmBg: "bg-yellow-600 hover:bg-yellow-700",
            confirmText: "text-white"
        },
        info: {
            icon: Info,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
            confirmBg: "bg-blue-600 hover:bg-blue-700",
            confirmText: "text-white"
        }
    };

    const config = variants[variant] || variants.danger;
    const Icon = config.icon;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={20} className={config.iconColor} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                        <p className="text-sm text-gray-600 mb-6">{message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`px-4 py-2 text-sm font-medium ${config.confirmBg} ${config.confirmText} rounded-lg transition-colors`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

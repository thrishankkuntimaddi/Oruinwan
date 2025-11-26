import React from "react";
import { AlertTriangle } from "lucide-react";

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmText = "Delete",
    cancelText = "Cancel",
    isDestructive = true
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all scale-100 overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">

                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDestructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                        <AlertTriangle size={32} />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-6">
                        {message}
                    </p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors text-sm border border-gray-200"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-5 py-2.5 rounded-xl text-white font-medium shadow-lg transition-all hover:scale-[1.02] active:scale-95 text-sm
                ${isDestructive ? "bg-red-600 hover:bg-red-700 shadow-red-500/30" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"}
              `}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

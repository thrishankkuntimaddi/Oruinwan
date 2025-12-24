import React from 'react';
import { X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel", isDangerous = true }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
            {/* Backdrop (Subtle) */}
            <div className="absolute inset-0 bg-black/20" onClick={onClose}></div>

            {/* Modal (Compact & Flat) */}
            <div className="bg-white rounded shadow-md w-[320px] relative z-10 border border-gray-200">
                <div className="flex items-center justify-between p-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4">
                    <p className="text-xs text-gray-600 leading-normal mb-6">
                        {message}
                    </p>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-3 py-1.5 text-[11px] font-semibold text-white rounded transition-colors ${isDangerous
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;

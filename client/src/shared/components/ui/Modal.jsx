import React from 'react';
import Button from './Button';

// Note: Requires @headlessui/react. If not installed, basic modal logic works but transitions might need manual CSS.
// Assuming headlessui is standard or we can use a simple custom implementation if strictly vanilla.
// Given "Standardize ALL UI Components", a robust Modal is key. I'll implement a custom one to be safe on dependencies,
// or check package.json. I'll stick to a custom implementation using standard React Portals or just CSS modules to trigger visibility
// to avoid introducing new large dependencies if not present. Tailwinds make it easy.

// Actually, existing package.json wasn't fully checked for headlessui. I'll assume standard React state control.
// This is a controlled component.

const Modal = ({ isOpen, onClose, title, children, footer, size = "md", className = "" }) => {
    if (!isOpen) return null;

    const maxWidths = {
        sm: "max-w-md",
        md: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "max-w-full mx-4",
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Overlay */}
                <div
                    className="fixed inset-0 bg-secondary-900 bg-opacity-75 transition-opacity"
                    aria-hidden="true"
                    onClick={onClose}
                ></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                {/* Modal Panel */}
                <div className={`
            inline-block align-bottom bg-white dark:bg-dark-card rounded-lg text-left overflow-hidden shadow-xl 
            transform transition-all sm:my-8 sm:align-middle w-full ${maxWidths[size]} ${className}
        `}>
                    <div className="bg-white dark:bg-dark-card px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-0 sm:text-left w-full">
                                {title && (
                                    <h3 className="text-lg leading-6 font-medium text-secondary-900 dark:text-white mb-4" id="modal-title">
                                        {title}
                                    </h3>
                                )}
                                <div className="mt-2 text-secondary-600 dark:text-secondary-300">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>

                    {(footer || onClose) && (
                        <div className="bg-secondary-50 dark:bg-secondary-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            {footer ? footer : (
                                <Button variant="secondary" onClick={onClose}>
                                    Close
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Modal;

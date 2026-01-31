import React from 'react';

/**
 * PasswordInput Component
 * Reusable password input field with show/hide toggle
 */
const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    onToggle,
    placeholder = "",
    fieldType = "new"
}) => (
    <div className="relative">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            {label}
        </label>
        <div className="relative">
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                name={`password-${fieldType}-${Math.random().toString(36).slice(2)}`}
                autoComplete={fieldType === "current" ? "current-password" : "new-password"}
                data-lpignore="true"
                data-form-type="other"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={placeholder}
            />
            <button
                type="button"
                onClick={onToggle}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                {show ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                )}
            </button>
        </div>
    </div>
);

export default PasswordInput;

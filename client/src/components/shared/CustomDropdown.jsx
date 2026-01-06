import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const CustomDropdown = ({ options, value, onChange, placeholder, icon: Icon, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) {
            setSelectedIndex(-1);
            return;
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                onChange(options[selectedIndex].value);
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, options, onChange]);

    // Auto-scroll to selected item
    useEffect(() => {
        if (selectedIndex >= 0 && dropdownRef.current) {
            const listItem = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (listItem) {
                listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    {label}
                </label>
            )}
            <div className="relative" ref={dropdownRef}>
                {/* Trigger Button */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl outline-none transition-all shadow-sm text-gray-900 dark:text-white"
                >
                    <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
                        <span className={selectedOption ? '' : 'text-gray-400'}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    </div>
                    <ChevronDown
                        size={20}
                        className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                            }`}
                    />
                </button>

                {/* Dropdown List */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden animate-slideDown">
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {options.map((option, index) => {
                                const isSelected = option.value === value;
                                const isHighlighted = index === selectedIndex;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        data-index={index}
                                        onClick={() => handleSelect(option.value)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isHighlighted || isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <span
                                            className={`${isSelected
                                                    ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            {option.label}
                                        </span>
                                        {isSelected && (
                                            <Check size={18} className="text-indigo-600 dark:text-indigo-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(99, 102, 241, 0.2);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(99, 102, 241, 0.4);
        }
      `}</style>
        </div>
    );
};

export default CustomDropdown;

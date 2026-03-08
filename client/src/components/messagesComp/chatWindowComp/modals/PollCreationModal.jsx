import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

/**
 * Poll Creation Modal
 * Allows users to create single or multiple choice polls
 */
export default function PollCreationModal({ onClose, onCreate }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [type, setType] = useState('single'); // 'single' or 'multiple'
    const [errors, setErrors] = useState({});

    const handleAddOption = () => {
        if (options.length < 10) {
            setOptions([...options, '']);
        }
    };

    const handleRemoveOption = (index) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const validate = () => {
        const newErrors = {};

        if (!question.trim()) {
            newErrors.question = 'Question is required';
        }

        const validOptions = options.filter(opt => opt.trim());
        if (validOptions.length < 2) {
            newErrors.options = 'At least 2 options are required';
        }

        // Check for duplicate options
        const uniqueOptions = new Set(validOptions.map(opt => opt.trim().toLowerCase()));
        if (uniqueOptions.size !== validOptions.length) {
            newErrors.options = 'Options must be unique';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        const validOptions = options.filter(opt => opt.trim());

        await onCreate({
            question: question.trim(),
            options: validOptions.map(opt => opt.trim()),
            allowMultiple: type === 'multiple',
        });

        // Don't close modal here - let the parent component close it on success
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Create Poll
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Question Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Poll Question *
                        </label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask a question..."
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 ${errors.question ? 'border-red-500' : 'border-gray-300'
                                }`}
                            autoFocus
                        />
                        {errors.question && (
                            <p className="mt-1 text-sm text-red-500">{errors.question}</p>
                        )}
                    </div>

                    {/* Poll Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Poll Type
                        </label>
                        <div className="flex gap-3">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    value="single"
                                    checked={type === 'single'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Single Choice</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    value="multiple"
                                    checked={type === 'multiple'}
                                    onChange={(e) => setType(e.target.value)}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Multiple Choice</span>
                            </label>
                        </div>
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Options * (2-10)
                        </label>
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                        placeholder={`Option ${index + 1}`}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                    />
                                    {options.length > 2 && (
                                        <button
                                            onClick={() => handleRemoveOption(index)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {options.length < 10 && (
                            <button
                                onClick={handleAddOption}
                                className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                <Plus size={16} />
                                Add Option
                            </button>
                        )}

                        {errors.options && (
                            <p className="mt-1 text-sm text-red-500">{errors.options}</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Create Poll
                    </button>
                </div>
            </div>
        </div>
    );
}

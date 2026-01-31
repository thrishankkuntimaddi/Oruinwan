import React from 'react';
import { FileText, UploadCloud } from 'lucide-react';

/**
 * Step4DocumentsForm Component
 * File upload for verification documents
 */
const Step4DocumentsForm = ({
    formData,
    onFileChange,
    errors,
    theme
}) => {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div className="text-center mb-6">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Please upload verification documents for your entity.
                </p>
            </div>

            <div className="space-y-6">
                <div
                    className={`border-3 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all ${theme === 'dark'
                            ? formData.documents
                                ? "border-indigo-400 bg-indigo-900/20"
                                : "border-gray-600 text-gray-400 hover:border-indigo-400 hover:bg-slate-800"
                            : formData.documents
                                ? "border-indigo-400 bg-indigo-50/50"
                                : "border-gray-300 text-gray-500 hover:border-indigo-400 hover:bg-white"
                        } ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-white/50'}`}
                >
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform shadow-sm ${formData.documents
                            ? theme === 'dark' ? "bg-slate-700 text-indigo-400" : "bg-white text-indigo-600"
                            : theme === 'dark' ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-400"
                        }`}>
                        {formData.documents ? <FileText size={32} /> : <UploadCloud size={32} />}
                    </div>

                    {formData.documents ? (
                        <div className="animate-fadeIn">
                            <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} text-lg mb-1`}>
                                {formData.documents.name}
                            </p>
                            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
                                {(formData.documents.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <label className={`cursor-pointer ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} font-bold hover:underline`}>
                                Change File
                                <input type="file" className="hidden" onChange={onFileChange} />
                            </label>
                        </div>
                    ) : (
                        <div>
                            <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} text-lg mb-2`}>
                                Drag & Drop or Click to Upload
                            </p>
                            <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} mb-6`}>
                                Business Registration, Tax ID, or Incorporation Cert.
                            </p>
                            <label className={`cursor-pointer px-6 py-3 ${theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-900 hover:bg-black'} text-white rounded-xl font-bold shadow-lg transition-all`}>
                                Browse Files
                                <input type="file" className="hidden" onChange={onFileChange} />
                            </label>
                        </div>
                    )}
                </div>
                {errors.documents && <p className="text-red-500 text-center text-sm font-bold">{errors.documents}</p>}
            </div>
        </div>
    );
};

export default Step4DocumentsForm;

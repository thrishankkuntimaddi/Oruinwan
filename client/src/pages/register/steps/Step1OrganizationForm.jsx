import React from 'react';
import { Building, Globe, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Step1OrganizationForm Component
 * Company name and domain input with real-time availability validation
 */
const Step1OrganizationForm = ({
    formData,
    onChange,
    errors,
    validationStatus,
    theme
}) => {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div className="text-center mb-6">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Tell us about the entity you are registering.
                </p>
            </div>

            <div className="space-y-4">
                {/* Company Name */}
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Company Name
                    </label>
                    <div className="relative group">
                        <Building className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                        <input
                            name="companyName"
                            value={formData.companyName}
                            onChange={onChange}
                            placeholder="e.g. Acme Innovations Inc."
                            className={`w-full pl-12 pr-12 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white placeholder:text-gray-400 border-gray-700' : 'bg-white text-gray-900 placeholder:text-gray-400 border-gray-200'} border ${errors.companyName ? 'border-red-500 ring-2 ring-red-50' : ''} rounded-2xl outline-none shadow-sm`}
                        />
                        {validationStatus.companyName === 'checking' && (
                            <div className="absolute right-4 top-3.5">
                                <div className={`w-5 h-5 border-2 ${theme === 'dark' ? 'border-indigo-400' : 'border-indigo-600'} border-t-transparent rounded-full animate-spin`} />
                            </div>
                        )}
                        {validationStatus.companyName === 'available' && (
                            <CheckCircle2 className="absolute right-4 top-3.5 text-green-500" size={20} />
                        )}
                        {validationStatus.companyName === 'taken' && (
                            <AlertCircle className="absolute right-4 top-3.5 text-red-500" size={20} />
                        )}
                    </div>
                    {errors.companyName && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyName}</p>}
                </div>

                {/* Company Domain */}
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Company Domain
                    </label>
                    <div className="relative group">
                        <Globe className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                        <input
                            name="companyDomain"
                            value={formData.companyDomain}
                            onChange={onChange}
                            placeholder="e.g. acme.com (Must match email domain)"
                            className={`w-full pl-12 pr-12 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white placeholder:text-gray-400 border-gray-700' : 'bg-white text-gray-900 placeholder:text-gray-400 border-gray-200'} border ${errors.companyDomain ? 'border-red-500 ring-2 ring-red-50' : ''} rounded-2xl outline-none shadow-sm`}
                        />
                        {validationStatus.companyDomain === 'checking' && (
                            <div className="absolute right-4 top-3.5">
                                <div className={`w-5 h-5 border-2 ${theme === 'dark' ? 'border-indigo-400' : 'border-indigo-600'} border-t-transparent rounded-full animate-spin`} />
                            </div>
                        )}
                        {validationStatus.companyDomain === 'available' && (
                            <CheckCircle2 className="absolute right-4 top-3.5 text-green-500" size={20} />
                        )}
                        {validationStatus.companyDomain === 'taken' && (
                            <AlertCircle className="absolute right-4 top-3.5 text-red-500" size={20} />
                        )}
                    </div>
                    {errors.companyDomain && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyDomain}</p>}
                </div>
            </div>
        </div>
    );
};

export default Step1OrganizationForm;

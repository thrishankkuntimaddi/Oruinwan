import React from 'react';
import { User, Mail, Phone, Briefcase, ChevronDown } from 'lucide-react';
import CustomDropdown from '../../../components/shared/CustomDropdown';

/**
 * Step2AdministratorForm Component
 * Administrator profile with email/phone verification
 */
const Step2AdministratorForm = ({
    formData,
    onChange,
    onRoleChange,
    errors,
    validationStatus,
    verificationStatus,
    onVerify,
    ROLES,
    PHONE_CODES,
    theme
}) => {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div className="text-center mb-6">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    We need a point of contact for this account.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Admin Name */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Your Full Name
                    </label>
                    <div className="relative group">
                        <User className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                        <input
                            name="adminName"
                            value={formData.adminName}
                            onChange={onChange}
                            placeholder="John Doe"
                            className={`w-full pl-12 pr-4 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'} border ${errors.adminName ? "border-red-500" : ""} rounded-2xl outline-none shadow-sm`}
                        />
                    </div>
                    {errors.adminName && <p className="text-red-500 text-xs font-bold ml-2">{errors.adminName}</p>}
                </div>

                {/* Role Dropdown */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                    <CustomDropdown
                        label="Role"
                        options={ROLES.map(r => ({ value: r, label: r }))}
                        value={formData.role}
                        onChange={onRoleChange}
                        placeholder="Select your role"
                        icon={Briefcase}
                    />
                </div>

                {/* Other Role (if selected) */}
                {formData.role === "Other" && (
                    <div className="space-y-2 col-span-2">
                        <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                            Specify Role
                        </label>
                        <input
                            name="roleOther"
                            value={formData.roleOther}
                            onChange={onChange}
                            placeholder="e.g. CTO"
                            className={`w-full px-4 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'} border ${errors.roleOther ? "border-red-500" : ""} rounded-2xl outline-none shadow-sm`}
                        />
                        {errors.roleOther && <p className="text-red-500 text-xs font-bold ml-2">{errors.roleOther}</p>}
                    </div>
                )}

                <div className="col-span-2">
                    <div className={`h-px w-full ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} my-2`}></div>
                </div>

                {/* Personal Email */}
                <div className="col-span-2 space-y-2">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Personal Email <span className={`text-xs font-normal ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>(For account recovery)</span>
                    </label>
                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <Mail className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                            <input
                                name="personalEmail"
                                value={formData.personalEmail}
                                onChange={onChange}
                                placeholder="john.doe@gmail.com"
                                className={`w-full pl-12 pr-4 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} border ${errors.personalEmail || validationStatus.personalEmail === 'taken'
                                        ? "border-red-500"
                                        : validationStatus.personalEmail === 'available' && verificationStatus.personalEmail === 'verified'
                                            ? "border-green-500"
                                            : theme === 'dark' ? "border-gray-700" : "border-gray-200"
                                    } rounded-2xl outline-none shadow-sm`}
                            />
                        </div>
                        <button
                            onClick={() => onVerify('personalEmail')}
                            disabled={verificationStatus.personalEmail === "verified"}
                            className={`px-4 rounded-2xl font-bold text-sm transition-all border ${verificationStatus.personalEmail === "verified"
                                    ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-50 text-green-600 border-green-200'} cursor-default`
                                    : `${theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600' : 'bg-gray-900 hover:bg-black border-gray-900'} text-white`
                                }`}
                        >
                            {verificationStatus.personalEmail === "verified" ? "Verified" : "Verify"}
                        </button>
                    </div>
                    {errors.personalEmail && <p className="text-red-500 text-xs font-bold ml-2">{errors.personalEmail}</p>}
                </div>

                {/* Phone Number */}
                <div className="col-span-2 space-y-2">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Phone Number
                    </label>
                    <div className="flex gap-2">
                        {/* Country Code Select */}
                        <div className="relative min-w-[110px]">
                            <ChevronDown className={`absolute right-3 top-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} pointer-events-none`} size={14} />
                            <select
                                name="phoneCode"
                                value={formData.phoneCode}
                                onChange={onChange}
                                className={`w-full h-full px-3 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'} border rounded-2xl outline-none shadow-sm appearance-none font-medium text-sm`}
                            >
                                {PHONE_CODES.map(c => (
                                    <option key={c.code} value={c.code}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative group flex-1">
                            <Phone className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={onChange}
                                placeholder="000-000-0000"
                                className={`w-full pl-12 pr-4 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'} border ${errors.phone || validationStatus.phone === 'taken'
                                        ? "border-red-500"
                                        : validationStatus.phone === 'available' && verificationStatus.phone === 'verified'
                                            ? "border-green-500"
                                            : theme === 'dark' ? "border-gray-700" : "border-gray-200"
                                    } rounded-2xl outline-none shadow-sm`}
                            />
                        </div>
                        <button
                            onClick={() => onVerify('phone')}
                            disabled={verificationStatus.phone === "verified"}
                            className={`px-4 rounded-2xl font-bold text-sm transition-all border ${verificationStatus.phone === "verified"
                                    ? `${theme === 'dark' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-50 text-green-600 border-green-200'} cursor-default`
                                    : `${theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-600' : 'bg-gray-900 hover:bg-black border-gray-900'} text-white`
                                }`}
                        >
                            {verificationStatus.phone === "verified" ? "Verified" : "Verify"}
                        </button>
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs font-bold ml-2">{errors.phone}</p>}
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} ml-1`}>Select country code. E.g. India (+91) requires 10 digits.</p>
                </div>
            </div>
        </div>
    );
};

export default Step2AdministratorForm;

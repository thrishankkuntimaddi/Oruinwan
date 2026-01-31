import React from 'react';
import { Mail, Lock, Eye, EyeOff, Info } from 'lucide-react';

/**
 * Step3AccountForm Component  
 * Company email and password creation with validation
 */
const Step3AccountForm = ({
    formData,
    onChange,
    errors,
    showPassword,
    showConfirmPassword,
    onTogglePassword,
    onToggleConfirmPassword,
    theme
}) => {
    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            <div className="text-center mb-6">
                <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Create your official company login.
                </p>
            </div>

            <div className="space-y-6">
                {/* Company Email */}
                <div className="space-y-2">
                    <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                        Company Email
                    </label>
                    <div className="relative group">
                        <Mail className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                        <input
                            name="companyEmail"
                            value={formData.companyEmail}
                            onChange={onChange}
                            placeholder={`name@${formData.companyDomain || "company.com"}`}
                            className={`w-full pl-12 pr-4 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700 focus:ring-indigo-900' : 'bg-white text-gray-900 border-gray-200 focus:ring-indigo-50'} border ${errors.companyEmail ? "border-red-500" : ""} focus:border-indigo-500 focus:ring-4 rounded-2xl outline-none transition-all shadow-sm`}
                        />
                    </div>
                    {errors.companyEmail && <p className="text-red-500 text-xs font-bold ml-2">{errors.companyEmail}</p>}
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} ml-2`}>
                        Must match verified domain: <strong>@{formData.companyDomain || "not set"}</strong>
                    </p>
                </div>

                {/* Password Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    {/* Password Input */}
                    <div className="space-y-2">
                        <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1 flex items-center gap-2`}>
                            Password
                            <div className="relative group cursor-help">
                                <Info size={14} className={`${theme === 'dark' ? 'text-gray-500 hover:text-indigo-400' : 'text-gray-400 hover:text-indigo-500'} transition-colors tooltip-trigger`} />
                                {/* Tooltip Content */}
                                <div className={`tooltip-content absolute left-full top-1/2 -translate-y-1/2 ml-2 w-64 p-4 ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-gray-900 text-white'} text-xs rounded-xl shadow-xl z-50 opacity-0 invisible transition-all duration-300 pointer-events-none`}>
                                    <div className={`absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-900'} rotate-45`}></div>
                                    <p className={`font-bold mb-2 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-300'}`}>Password Rules:</p>
                                    <ul className={`list-disc pl-3 space-y-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-300'}`}>
                                        <li>8-16 characters long</li>
                                        <li>At least one uppercase (A-Z)</li>
                                        <li>At least one lowercase (a-z)</li>
                                        <li>At least one number (0-9)</li>
                                        <li>At least one special char (@$!%*?&)</li>
                                        <li>No spaces allowed</li>
                                    </ul>
                                </div>
                            </div>
                        </label>
                        <div className="relative group">
                            <Lock className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={onChange}
                                placeholder="••••••••"
                                className={`w-full pl-12 pr-12 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700 focus:ring-indigo-900' : 'bg-white text-gray-900 border-gray-200 focus:ring-indigo-50'} border ${errors.password ? "border-red-300" : ""} focus:border-indigo-500 focus:ring-4 rounded-2xl outline-none transition-all shadow-sm placeholder:text-gray-400`}
                            />
                            <button
                                type="button"
                                onClick={onTogglePassword}
                                className={`absolute right-4 top-3.5 ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.password && <p className="text-red-500 text-xs font-bold ml-2">{errors.password}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} ml-1`}>
                            Confirm Password
                        </label>
                        <div className="relative group">
                            <Lock className={`absolute left-4 top-3.5 ${theme === 'dark' ? 'text-gray-400 group-focus-within:text-indigo-400' : 'text-gray-400 group-focus-within:text-indigo-500'} transition-colors`} size={20} />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={onChange}
                                placeholder="••••••••"
                                className={`w-full pl-12 pr-12 py-3.5 ${theme === 'dark' ? 'bg-slate-800 text-white border-gray-700 focus:ring-indigo-900' : 'bg-white text-gray-900 border-gray-200 focus:ring-indigo-50'} border ${errors.confirmPassword ? "border-red-300" : ""} focus:border-indigo-500 focus:ring-4 rounded-2xl outline-none transition-all shadow-sm placeholder:text-gray-400`}
                            />
                            <button
                                type="button"
                                onClick={onToggleConfirmPassword}
                                className={`absolute right-4 top-3.5 ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-xs font-bold ml-2">{errors.confirmPassword}</p>}
                    </div>
                </div>

                {/* Password Hints (Visible if typing) */}
                {formData.password && (
                    <div className={`${theme === 'dark' ? 'bg-indigo-900/20 border-indigo-800 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-800'} rounded-xl p-3 border text-xs`}>
                        <div className="flex items-start gap-2">
                            <Info size={14} className="shrink-0 mt-0.5" />
                            <span>Ensure your password is 8-16 characters, includes uppercase, lowercase, number, and special character.</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Step3AccountForm;

// client/src/pages/RegisterCompany.jsx - MULTI-STEP WIZARD

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, User, Mail, Lock, Globe, Shield } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import axios from "axios";

const RegisterCompany = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        // Step 1
        companyName: "",
        domain: "",
        adminName: "",
        // Step 2
        adminEmail: "",
        adminPassword: "",
        confirmPassword: "",
        // Step 3
        verificationCode: "",
        // Step 4
        kycSkipped: false
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    // Step 1 Validation
    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
        if (!formData.adminName.trim()) newErrors.adminName = "Admin name is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Step 2 Validation
    const validateStep2 = () => {
        const newErrors = {};
        if (!formData.adminEmail.trim()) {
            newErrors.adminEmail = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) {
            newErrors.adminEmail = "Invalid email format";
        }
        if (!formData.adminPassword) {
            newErrors.adminPassword = "Password is required";
        } else if (formData.adminPassword.length < 8) {
            newErrors.adminPassword = "Password must be at least 8 characters";
        }
        if (formData.adminPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle Next Button
    const handleNext = async () => {
        if (currentStep === 1) {
            if (!validateStep1()) return;
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (!validateStep2()) return;
            // Skip email verification and go directly to KYC step
            setCurrentStep(4);
        } else if (currentStep === 3) {
            // Verify email code (skipped for now)
            setCurrentStep(4);
        } else if (currentStep === 4) {
            // Skip KYC and register company
            await handleFinalSubmit();
        }
    };

    // Handle Back Button
    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Final Registration
    const handleFinalSubmit = async () => {
        setIsLoading(true);
        try {
            await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/companies/register`,
                {
                    companyName: formData.companyName,
                    adminName: formData.adminName,
                    adminEmail: formData.adminEmail,
                    adminPassword: formData.adminPassword,
                    domain: formData.domain || undefined
                }
            );

            showToast("Company registered successfully! Redirecting to login...", "success");

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate("/login", {
                    state: {
                        email: formData.adminEmail,
                        message: "Registration successful! Please login with your admin credentials."
                    }
                });
            }, 2000);

        } catch (error) {
            console.error("Registration error:", error);
            const message = error.response?.data?.message || "Registration failed";
            showToast(message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // Progress Bar
    const progress = (currentStep / 4) * 100;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 sm:px-6 lg:px-8 relative">

            {/* Back to Home Button */}
            <button
                onClick={() => navigate("/")}
                className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full shadow-sm hover:text-gray-900 hover:border-gray-300 hover:shadow-md transition-all duration-200 group"
            >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                Back to Home
            </button>

            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-blue-100 rounded-2xl">
                            <Building2 className="w-10 h-10 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Register Your Company</h1>
                    <p className="text-gray-600">Step {currentStep} of 4</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-600">Progress</span>
                        <span className="text-xs font-medium text-blue-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

                    {/* STEP 1: Company & Admin Name */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Building2 className="w-6 h-6 text-blue-600" />
                                    Company Information
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Company Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleChange}
                                            placeholder="Chttrix Corp"
                                            className={`w-full px-4 py-3 rounded-lg border ${errors.companyName ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base`}
                                        />
                                        {errors.companyName && (
                                            <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Company Domain <span className="text-gray-400 text-xs">(Optional)</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Globe className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                name="domain"
                                                value={formData.domain}
                                                onChange={handleChange}
                                                placeholder="chttrix.com"
                                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
                                            />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">You can verify your domain later for auto-join</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Admin Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                name="adminName"
                                                value={formData.adminName}
                                                onChange={handleChange}
                                                placeholder="Thrishank"
                                                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.adminName ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base`}
                                            />
                                        </div>
                                        {errors.adminName && (
                                            <p className="mt-1 text-sm text-red-600">{errors.adminName}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Email & Password */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <Lock className="w-6 h-6 text-purple-600" />
                                    Admin Account Security
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Admin Email <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="email"
                                                name="adminEmail"
                                                value={formData.adminEmail}
                                                onChange={handleChange}
                                                placeholder="admin@chttrix.com"
                                                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.adminEmail ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-base`}
                                            />
                                        </div>
                                        {errors.adminEmail && (
                                            <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Password <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="password"
                                                name="adminPassword"
                                                value={formData.adminPassword}
                                                onChange={handleChange}
                                                placeholder="Minimum 8 characters"
                                                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.adminPassword ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-base`}
                                            />
                                        </div>
                                        {errors.adminPassword && (
                                            <p className="mt-1 text-sm text-red-600">{errors.adminPassword}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Confirm Password <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                                placeholder="Re-enter your password"
                                                className={`w-full pl-10 pr-4 py-3 rounded-lg border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'} focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-base`}
                                            />
                                        </div>
                                        {errors.confirmPassword && (
                                            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                                        )}
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-sm text-blue-800">
                                            <strong>Password Requirements:</strong> Minimum 8 characters
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Email Verification (Skipped for now) */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-green-100 rounded-full">
                                        <Mail className="w-12 h-12 text-green-600" />
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                                <p className="text-gray-600 mb-6">
                                    We've sent a 6-digit code to <strong>{formData.adminEmail}</strong>
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Verification Code
                                    </label>
                                    <input
                                        type="text"
                                        name="verificationCode"
                                        value={formData.verificationCode}
                                        onChange={handleChange}
                                        placeholder="Enter 6-digit code"
                                        maxLength={6}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-center text-2xl font-bold tracking-widest"
                                    />
                                </div>

                                <button className="mt-4 text-sm text-blue-600 hover:underline">
                                    Resend Code
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: KYC Verification (Skipped) */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="flex justify-center mb-4">
                                    <div className="p-4 bg-orange-100 rounded-full">
                                        <Shield className="w-12 h-12 text-orange-600" />
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">KYC Verification</h2>
                                <p className="text-gray-600 mb-6">
                                    Would you like to complete KYC verification now? (Optional)
                                </p>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Note:</strong> You can skip this step and complete it later from your dashboard
                                    </p>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleFinalSubmit}
                                        disabled={isLoading}
                                        className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                                    >
                                        Skip for Now
                                    </button>
                                    <button
                                        onClick={handleFinalSubmit}
                                        disabled={isLoading}
                                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                                    >
                                        Complete KYC
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-8 flex justify-between gap-4">
                        {currentStep > 1 && currentStep < 4 && (
                            <button
                                onClick={handleBack}
                                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Back
                            </button>
                        )}

                        {currentStep < 4 && (
                            <button
                                onClick={handleNext}
                                disabled={isLoading}
                                className="ml-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                </div>

                {/* Info about next steps */}
                {currentStep === 1 && (
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{" "}
                            <button
                                onClick={() => navigate("/login")}
                                className="text-blue-600 font-semibold hover:underline"
                            >
                                Sign in
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegisterCompany;

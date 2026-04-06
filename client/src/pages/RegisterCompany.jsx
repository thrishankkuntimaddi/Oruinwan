import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import OTPModal from "../components/shared/OTPModal";
import api from '@services/api';

// Import extracted components
import RegisterLayout from "./register/layout/RegisterLayout";
import SuccessView from "./register/views/SuccessView";
import Step1OrganizationForm from "./register/steps/Step1OrganizationForm";
import Step2AdministratorForm from "./register/steps/Step2AdministratorForm";
import Step3AccountForm from "./register/steps/Step3AccountForm";
import Step4DocumentsForm from "./register/steps/Step4DocumentsForm";
import Step5ReviewForm from "./register/steps/Step5ReviewForm";

const RegisterCompany = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { theme, toggleTheme } = useTheme();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Password Visibility State
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Verification States
    const [verificationStatus, setVerificationStatus] = useState({
        personalEmail: "idle",
        phone: "idle"
    });

    // Inline Validation States
    const [validationStatus, setValidationStatus] = useState({
        companyName: 'idle',
        companyDomain: 'idle',
        personalEmail: 'idle',
        phone: 'idle'
    });

    // OTP Modal State
    const [otpModal, setOtpModal] = useState({
        isOpen: false,
        target: '',
        targetType: '',
        field: ''
    });

    const [formData, setFormData] = useState({
        companyName: "",
        companyDomain: "",
        adminName: "",
        role: "Owner",
        roleOther: "",
        personalEmail: "",
        phone: "",
        phoneCode: "+91",
        companyEmail: "",
        password: "",
        confirmPassword: "",
        documents: null
    });

    const [errors, setErrors] = useState({});

    const ROLES = ["Owner", "Admin", "PA", "Manager", "Other"];
    const PHONE_CODES = [
        { code: "+1", country: "US", label: "US (+1)", len: 10 },
        { code: "+91", country: "IN", label: "IN (+91)", len: 10 },
        { code: "+44", country: "UK", label: "UK (+44)", len: 10 },
        { code: "+61", country: "AU", label: "AU (+61)", len: 9 },
        { code: "+86", country: "CN", label: "CN (+86)", len: 11 },
        { code: "+55", country: "BR", label: "BR (+55)", len: 11 },
    ];

    const currentPhoneCode = PHONE_CODES.find(c => c.code === formData.phoneCode) || PHONE_CODES[0];

    // Debounced validation for company name
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (formData.companyName && formData.companyName.trim().length >= 2) {
                setValidationStatus(prev => ({ ...prev, companyName: 'checking' }));
                try {
                    const res = await api.post(`/api/companies/check-name`, {
                        name: formData.companyName
                    });
                    if (res.data.exists) {
                        setErrors(prev => ({ ...prev, companyName: 'Company name already registered' }));
                        setValidationStatus(prev => ({ ...prev, companyName: 'taken' }));
                    } else {
                        setErrors(prev => ({ ...prev, companyName: '' }));
                        setValidationStatus(prev => ({ ...prev, companyName: 'available' }));
                    }
                } catch (err) {
                    setValidationStatus(prev => ({ ...prev, companyName: 'idle' }));
                }
            } else {
                setValidationStatus(prev => ({ ...prev, companyName: 'idle' }));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.companyName]);

    // Debounced validation for company domain
    useEffect(() => {
        const timer = setTimeout(async () => {
            const domain = formData.companyDomain.trim();
            if (!domain) {
                setValidationStatus(prev => ({ ...prev, companyDomain: 'idle' }));
                return;
            }
            // Format check first — must be like acme.com / co.uk / startup.io
            const domainRegex = /^(?!-)([a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})*)\.[a-zA-Z]{2,}$/;
            if (!domainRegex.test(domain)) {
                setErrors(prev => ({ ...prev, companyDomain: 'Invalid domain format (e.g. acme.com)' }));
                setValidationStatus(prev => ({ ...prev, companyDomain: 'taken' }));
                return;
            }
            // Format is valid — clear any format error and check availability
            setErrors(prev => ({ ...prev, companyDomain: '' }));
            if (domain.length >= 4) {
                setValidationStatus(prev => ({ ...prev, companyDomain: 'checking' }));
                try {
                    const res = await api.post(`/api/companies/check-domain`, {
                        domain
                    });
                    if (res.data.exists) {
                        setErrors(prev => ({ ...prev, companyDomain: 'Domain already registered' }));
                        setValidationStatus(prev => ({ ...prev, companyDomain: 'taken' }));
                    } else {
                        setErrors(prev => ({ ...prev, companyDomain: '' }));
                        setValidationStatus(prev => ({ ...prev, companyDomain: 'available' }));
                    }
                } catch (err) {
                    setValidationStatus(prev => ({ ...prev, companyDomain: 'idle' }));
                }
            } else {
                setValidationStatus(prev => ({ ...prev, companyDomain: 'idle' }));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.companyDomain]);


    // Debounced validation for personal email
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (formData.personalEmail && /\S+@\S+\.\S+/.test(formData.personalEmail)) {
                setValidationStatus(prev => ({ ...prev, personalEmail: 'checking' }));
                try {
                    const res = await api.post(`/api/companies/check-email`, {
                        email: formData.personalEmail
                    });
                    if (res.data.exists) {
                        setErrors(prev => ({ ...prev, personalEmail: 'Email already registered' }));
                        setValidationStatus(prev => ({ ...prev, personalEmail: 'taken' }));
                    } else {
                        if (!errors.personalEmail || errors.personalEmail === 'Email already registered') {
                            setErrors(prev => ({ ...prev, personalEmail: '' }));
                        }
                        setValidationStatus(prev => ({ ...prev, personalEmail: 'available' }));
                    }
                } catch (err) {
                    setValidationStatus(prev => ({ ...prev, personalEmail: 'idle' }));
                }
            } else {
                setValidationStatus(prev => ({ ...prev, personalEmail: 'idle' }));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.personalEmail, errors.personalEmail]);

    // Debounced validation for phone
    useEffect(() => {
        const timer = setTimeout(async () => {
            const phoneDigits = formData.phone.replace(/\D/g, '');
            if (phoneDigits.length === currentPhoneCode.len) {
                setValidationStatus(prev => ({ ...prev, phone: 'checking' }));
                try {
                    const fullPhone = `${formData.phoneCode}${phoneDigits}`;
                    const res = await api.post(`/api/companies/check-phone`, {
                        phone: fullPhone
                    });
                    if (res.data.exists) {
                        setErrors(prev => ({ ...prev, phone: 'Phone number already registered' }));
                        setValidationStatus(prev => ({ ...prev, phone: 'taken' }));
                    } else {
                        if (!errors.phone || errors.phone === 'Phone number already registered') {
                            setErrors(prev => ({ ...prev, phone: '' }));
                        }
                        setValidationStatus(prev => ({ ...prev, phone: 'available' }));
                    }
                } catch (err) {
                    setValidationStatus(prev => ({ ...prev, phone: 'idle' }));
                }
            } else {
                setValidationStatus(prev => ({ ...prev, phone: 'idle' }));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.phone, formData.phoneCode, currentPhoneCode.len, errors.phone]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));

        if ((name === 'personalEmail' || name === 'phone') && verificationStatus[name] === 'verified') {
            setVerificationStatus(prev => ({ ...prev, [name]: "idle" }));
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData(prev => ({ ...prev, documents: file }));
    };

    // Validation Logic
    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.companyName.trim()) newErrors.companyName = "Company Name is required";
        if (!formData.companyDomain.trim()) newErrors.companyDomain = "Domain is required";
        else if (!/^(?!-)([a-zA-Z0-9-]{1,63}(?:\.[a-zA-Z0-9-]{1,63})*)\.[a-zA-Z]{2,}$/.test(formData.companyDomain.trim())) newErrors.companyDomain = "Invalid domain format (e.g. acme.com)";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};
        if (!formData.adminName.trim()) newErrors.adminName = "Name is required";
        if (!formData.personalEmail.trim()) newErrors.personalEmail = "Personal Email is required";
        else if (!/\S+@\S+\.\S+/.test(formData.personalEmail)) newErrors.personalEmail = "Invalid email";
        else if (validationStatus.personalEmail === 'taken') newErrors.personalEmail = "Email already registered";

        if (!formData.phone.trim()) newErrors.phone = "Phone is required";
        else if (formData.phone.replace(/\D/g, '').length !== currentPhoneCode.len) {
            newErrors.phone = `Must be ${currentPhoneCode.len} digits for ${currentPhoneCode.country}`;
        }
        else if (validationStatus.phone === 'taken') newErrors.phone = "Phone number already registered";

        if (formData.role === "Other" && !formData.roleOther.trim()) newErrors.roleOther = "Please specify your role";

        if (verificationStatus.personalEmail !== "verified") {
            newErrors.personalEmail = newErrors.personalEmail || "Please verify your email before proceeding";
        }
        if (verificationStatus.phone !== "verified") {
            newErrors.phone = newErrors.phone || "Please verify your phone number before proceeding";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        const newErrors = {};
        if (!formData.companyEmail.trim()) newErrors.companyEmail = "Company Email is required";
        else {
            const emailDomain = formData.companyEmail.split('@')[1];
            if (emailDomain !== formData.companyDomain) {
                newErrors.companyEmail = `Email must match company domain (@${formData.companyDomain})`;
            }
        }

        const pd = formData.password;
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;

        if (!pd) newErrors.password = "Password is required";
        else if (pd.includes(" ")) newErrors.password = "No spaces allowed";
        else if (!passwordRegex.test(pd)) {
            newErrors.password = "Does not meet complexity rules";
        }

        if (pd !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep4 = () => {
        const newErrors = {};
        if (!formData.documents) newErrors.documents = "Please upload verification documents";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;
        if (currentStep === 3 && !validateStep3()) return;
        if (currentStep === 4 && !validateStep4()) return;
        setCurrentStep(p => Math.min(p + 1, 5));
    };

    const handleBack = () => {
        setCurrentStep(p => Math.max(p - 1, 1));
    };

    // Verification Handlers
    const handleVerify = async (field) => {
        const target = formData[field];
        if (!target) {
            setErrors(prev => ({ ...prev, [field]: "Required for verification" }));
            return;
        }

        if (field === 'personalEmail' && !/\S+@\S+\.\S+/.test(target)) {
            setErrors(prev => ({ ...prev, [field]: "Invalid email format" }));
            return;
        }

        setIsLoading(true);
        try {
            const targetValue = field === 'phone'
                ? `${formData.phoneCode}${target}`
                : target;

            await api.post(`/api/companies/otp/send`, {
                target: targetValue,
                type: field === 'personalEmail' ? 'email' : 'phone'
            });

            setVerificationStatus(prev => ({ ...prev, [field]: "pending" }));
            setOtpModal({
                isOpen: true,
                target: targetValue,
                targetType: field === 'personalEmail' ? 'email' : 'phone',
                field
            });
            setIsLoading(false);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
            showToast(error.response?.data?.message || "Failed to send OTP", "error");
        }
    };

    const handleOTPVerify = async (otp) => {
        try {
            await api.post(`/api/companies/otp/verify`, {
                target: otpModal.target,
                otp
            });

            setVerificationStatus(prev => ({ ...prev, [otpModal.field]: "verified" }));
            if (errors[otpModal.field]) setErrors(prev => ({ ...prev, [otpModal.field]: "" }));

            showToast(`${otpModal.targetType === 'email' ? 'Email' : 'Phone'} verified successfully!`, "success");
        } catch (error) {
            throw new Error(error.response?.data?.message || "Invalid OTP");
        }
    };

    const handleOTPResend = async () => {
        try {
            await api.post(`/api/companies/otp/send`, {
                target: otpModal.target,
                type: otpModal.targetType
            });
            showToast("OTP resent successfully", "success");
        } catch (error) {
            throw new Error(error.response?.data?.message || "Failed to resend OTP");
        }
    };

    const handleOTPModalClose = () => {
        setVerificationStatus(prev => {
            const field = otpModal.field;
            if (field && prev[field] === "pending") {
                return { ...prev, [field]: "idle" };
            }
            return prev;
        });
        setOtpModal({ isOpen: false, target: '', targetType: '', field: '' });
    };

    const handleFinalSubmit = async () => {
        setIsLoading(true);
        try {
            const readFile = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content: reader.result
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            };

            let documentData = null;
            if (formData.documents) {
                documentData = await readFile(formData.documents);
            }

            const payload = {
                companyName: formData.companyName,
                domain: formData.companyDomain,
                adminName: formData.adminName,
                adminEmail: formData.companyEmail,
                personalEmail: formData.personalEmail,
                phone: formData.phone,
                phoneCode: formData.phoneCode,
                role: formData.role === "Other" ? formData.roleOther : formData.role,
                adminPassword: formData.password,
                workspaceName: `${formData.companyName} Workspace`,
                documents: documentData ? [documentData] : []
            };

            await api.post(
                `/api/companies/register`,
                payload
            );

            setIsSuccess(true);
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || "Failed to register", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // Render success view
    if (isSuccess) {
        return <SuccessView formData={formData} theme={theme} onNavigate={navigate} />;
    }

    return (
        <>
            <RegisterLayout
                theme={theme}
                toggleTheme={toggleTheme}
                onNavigate={navigate}
                currentStep={currentStep}
                onBack={handleBack}
                onNext={handleNext}
                onSubmit={handleFinalSubmit}
                isLoading={isLoading}
                showBackButton={currentStep > 1}
                showNextButton={currentStep < 5}
                showSubmitButton={currentStep === 5}
            >
                {currentStep === 1 && (
                    <Step1OrganizationForm
                        formData={formData}
                        onChange={handleChange}
                        errors={errors}
                        validationStatus={validationStatus}
                        theme={theme}
                    />
                )}
                {currentStep === 2 && (
                    <Step2AdministratorForm
                        formData={formData}
                        onChange={handleChange}
                        onRoleChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                        errors={errors}
                        validationStatus={validationStatus}
                        verificationStatus={verificationStatus}
                        onVerify={handleVerify}
                        ROLES={ROLES}
                        PHONE_CODES={PHONE_CODES}
                        theme={theme}
                    />
                )}
                {currentStep === 3 && (
                    <Step3AccountForm
                        formData={formData}
                        onChange={handleChange}
                        errors={errors}
                        showPassword={showPassword}
                        showConfirmPassword={showConfirmPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                        onToggleConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                        theme={theme}
                    />
                )}
                {currentStep === 4 && (
                    <Step4DocumentsForm
                        formData={formData}
                        onFileChange={handleFileChange}
                        errors={errors}
                        theme={theme}
                    />
                )}
                {currentStep === 5 && (
                    <Step5ReviewForm
                        formData={formData}
                        onEdit={setCurrentStep}
                        theme={theme}
                    />
                )}
            </RegisterLayout>

            {/* OTP Modal */}
            <OTPModal
                isOpen={otpModal.isOpen}
                onClose={handleOTPModalClose}
                target={otpModal.target}
                targetType={otpModal.targetType}
                onVerify={handleOTPVerify}
                onResend={handleOTPResend}
            />
        </>
    );
};

export default RegisterCompany;

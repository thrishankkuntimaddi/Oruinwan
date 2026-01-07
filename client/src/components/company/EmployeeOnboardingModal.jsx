// client/src/components/company/EmployeeOnboardingModal.jsx
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Briefcase, Calendar, Building, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

const EmployeeOnboardingModal = ({ isOpen, onClose, companyId }) => {
    // Step management
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;

    // Step 1: Basic Information
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [personalEmail, setPersonalEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneCode, setPhoneCode] = useState('+1');

    // Step 2: Company & Role
    const [companyEmail, setCompanyEmail] = useState('');
    const [role, setRole] = useState('member');
    const [jobTitle, setJobTitle] = useState('');
    const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
    const [employeeCategory, setEmployeeCategory] = useState('Full-time');
    const [managedDepartments, setManagedDepartments] = useState([]);

    // Step 3: Departments & Workspaces
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [selectedWorkspaces, setSelectedWorkspaces] = useState({});

    // UI state
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [workspacesByDept, setWorkspacesByDept] = useState({});
    const [companyDomain, setCompanyDomain] = useState('');

    // Fetch departments and company info
    useEffect(() => {
        if (!isOpen || !companyId) return;

        const fetchData = async () => {
            try {
                const deptRes = await api.get(`/api/admin/departments`);
                console.log('Departments fetched:', deptRes.data);
                setDepartments(deptRes.data.departments || []);

                const companyRes = await api.get(`/api/companies/${companyId}`);
                setCompanyDomain(companyRes.data.domain || '');
            } catch (error) {
                console.error('Failed to fetch data:', error);
                toast.error('Failed to load departments');
            }
        };

        fetchData();
    }, [isOpen, companyId]);

    // Fetch workspaces when departments are selected in step 3
    useEffect(() => {
        if (currentStep === 3 && selectedDepartments.length > 0) {
            selectedDepartments.forEach(async (deptId) => {
                if (!workspacesByDept[deptId]) {
                    try {
                        const res = await api.get(`/api/admin/departments/${deptId}/workspaces`);
                        setWorkspacesByDept(prev => ({ ...prev, [deptId]: res.data || [] }));
                    } catch (error) {
                        console.error(`Failed to fetch workspaces for dept ${deptId}:`, error);
                    }
                }
            });
        }
    }, [currentStep, selectedDepartments, workspacesByDept]);

    // Reset form on close
    useEffect(() => {
        if (!isOpen) {
            setCurrentStep(1);
            setFirstName('');
            setLastName('');
            setPersonalEmail('');
            setPhone('');
            setPhoneCode('+1');
            setCompanyEmail('');
            setRole('member');
            setJobTitle('');
            setJoiningDate(new Date().toISOString().split('T')[0]);
            setEmployeeCategory('Full-time');
            setManagedDepartments([]);
            setSelectedDepartments([]);
            setSelectedWorkspaces({});
        }
    }, [isOpen]);

    const validateStep = (step) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        switch (step) {
            case 1:
                if (!firstName || !lastName || !personalEmail) {
                    toast.error('Please fill in all required fields');
                    return false;
                }
                if (!emailRegex.test(personalEmail)) {
                    toast.error('Please enter a valid personal email');
                    return false;
                }
                return true;
            case 2:
                if (!companyEmail || !role) {
                    toast.error('Company email and role are required');
                    return false;
                }
                if (!emailRegex.test(companyEmail)) {
                    toast.error('Please enter a valid company email');
                    return false;
                }
                if (role === 'manager' && managedDepartments.length === 0) {
                    toast.error('Please select at least one department for this manager');
                    return false;
                }
                return true;
            case 3:
                if (selectedDepartments.length === 0) {
                    toast.error('Please assign the employee to at least one department');
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleDepartmentToggle = (deptId) => {
        setSelectedDepartments(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    const handleManagedDepartmentToggle = (deptId) => {
        setManagedDepartments(prev =>
            prev.includes(deptId)
                ? prev.filter(id => id !== deptId)
                : [...prev, deptId]
        );
    };

    const handleWorkspaceToggle = (deptId, workspaceId) => {
        setSelectedWorkspaces(prev => {
            const deptWorkspaces = prev[deptId] || [];
            const updated = deptWorkspaces.includes(workspaceId)
                ? deptWorkspaces.filter(id => id !== workspaceId)
                : [...deptWorkspaces, workspaceId];
            return { ...prev, [deptId]: updated };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateStep(3)) return;

        setLoading(true);

        try {
            // Flatten workspace selections
            const allWorkspaces = Object.values(selectedWorkspaces).flat();

            const response = await api.post('/api/admin/onboard-employee', {
                firstName,
                lastName,
                personalEmail,
                companyEmail,
                phone: phone ? `${phoneCode}${phone}` : undefined,
                role,
                departments: selectedDepartments,
                workspaces: allWorkspaces,
                managedDepartments: role === 'manager' ? managedDepartments : [],
                jobTitle: jobTitle || undefined,
                joiningDate,
                employeeCategory
            });

            toast.success(response.data.message || 'Employee onboarded successfully!');

            setTimeout(() => {
                onClose();
                window.location.reload(); // Refresh to show new employee
            }, 2000);

        } catch (error) {
            console.error('Error creating employee:', error);
            toast.error(
                error.response?.data?.message || 'Failed to create employee'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Onboard New Employee
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Step {currentStep} of {totalSteps}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        {[1, 2, 3].map((step) => (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-2 transition-all ${step < currentStep
                                        ? 'bg-green-500 text-white'
                                        : step === currentStep
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                        }`}>
                                        {step < currentStep ? <Check className="w-5 h-5" /> : step}
                                    </div>
                                    <span className={`text-xs font-medium ${step <= currentStep
                                        ? 'text-gray-900 dark:text-white'
                                        : 'text-gray-500'
                                        }`}>
                                        {step === 1 && 'Basic Info'}
                                        {step === 2 && 'Company & Role'}
                                        {step === 3 && 'Assignment'}
                                    </span>
                                </div>
                                {step < totalSteps && (
                                    <div className={`h-1 flex-1 mx-2 rounded ${step < currentStep
                                        ? 'bg-green-500'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Basic Information */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Basic Information
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            First Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="John"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Last Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Doe"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Personal Email <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={personalEmail}
                                            onChange={(e) => setPersonalEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="john.doe@personal.com"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Credentials will be sent to this email
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mobile Number (Optional)
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={phoneCode}
                                            onChange={(e) => setPhoneCode(e.target.value)}
                                            className="w-24 px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="+1">🇺🇸 +1</option>
                                            <option value="+91">🇮🇳 +91</option>
                                            <option value="+44">🇬🇧 +44</option>
                                            <option value="+61">🇦🇺 +61</option>
                                        </select>
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="123-456-7890"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Company & Role */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Company Details & Role
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Company Email <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={companyEmail}
                                            onChange={(e) => setCompanyEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder={`john.doe@${companyDomain || 'company.com'}`}
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        This will be their login email
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="member">Employee</option>
                                        <option value="guest">Guest</option>
                                        <option value="manager">Manager</option>
                                    </select>
                                </div>

                                {role === 'manager' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Managed Departments <span className="text-red-500">*</span>
                                        </label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                                            {departments.length > 0 ? (
                                                departments.map((dept) => (
                                                    <label key={dept._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={managedDepartments.includes(dept._id)}
                                                            onChange={() => handleManagedDepartmentToggle(dept._id)}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-900 dark:text-white">{dept.name}</span>
                                                    </label>
                                                ))
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-2">
                                                    No departments available. Please create departments first.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Job Title (Optional)
                                        </label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="text"
                                                value={jobTitle}
                                                onChange={(e) => setJobTitle(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Software Engineer"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Employee Category
                                        </label>
                                        <select
                                            value={employeeCategory}
                                            onChange={(e) => setEmployeeCategory(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contractor">Contractor</option>
                                            <option value="Intern">Intern</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Joining Date
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="date"
                                            value={joiningDate}
                                            onChange={(e) => setJoiningDate(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Departments & Workspaces */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-fadeIn">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Department & Workspace Assignment
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                        Assign to Departments <span className="text-red-500">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        {departments.map((dept) => (
                                            <div key={dept._id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDepartments.includes(dept._id)}
                                                        onChange={() => handleDepartmentToggle(dept._id)}
                                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="font-medium text-gray-900 dark:text-white">{dept.name}</span>
                                                        {dept.description && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">{dept.description}</p>
                                                        )}
                                                    </div>
                                                </label>

                                                {/* Show workspaces if department is selected */}
                                                {selectedDepartments.includes(dept._id) && workspacesByDept[dept._id] && (
                                                    <div className="mt-4 pl-8 space-y-2">
                                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                            Workspaces (Optional)
                                                        </p>
                                                        {workspacesByDept[dept._id].length > 0 ? (
                                                            workspacesByDept[dept._id].map((workspace) => (
                                                                <label key={workspace._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(selectedWorkspaces[dept._id] || []).includes(workspace._id)}
                                                                        onChange={() => handleWorkspaceToggle(dept._id, workspace._id)}
                                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                                    />
                                                                    <Building className="w-4 h-4 text-gray-400" />
                                                                    <span className="text-sm text-gray-900 dark:text-white">{workspace.name}</span>
                                                                </label>
                                                            ))
                                                        ) : (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                                No workspaces in this department
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Summary</h4>
                                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                                        <p><strong>Name:</strong> {firstName} {lastName}</p>
                                        <p><strong>Email:</strong> {companyEmail}</p>
                                        <p><strong>Role:</strong> {role.charAt(0).toUpperCase() + role.slice(1)}</p>
                                        <p><strong>Departments:</strong> {selectedDepartments.length} selected</p>
                                        <p><strong>Workspaces:</strong> {Object.values(selectedWorkspaces).flat().length} selected</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer Navigation */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${currentStep === 1
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                    >
                        <ChevronLeft className="w-5 h-5" />
                        Previous
                    </button>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>

                        {currentStep < totalSteps ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Next
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : 'Create Employee'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default EmployeeOnboardingModal;

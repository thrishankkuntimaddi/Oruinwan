import React from 'react';
import OnboardingWizard from '../admin/onboarding/OnboardingWizard';

const EmployeeOnboardingModal = ({ isOpen, onClose, companyId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="w-full max-w-5xl h-[85vh] relative">
                <OnboardingWizard onComplete={onClose} />
            </div>
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default EmployeeOnboardingModal;

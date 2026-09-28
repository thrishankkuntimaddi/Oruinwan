import React from 'react';
import OnboardingWizard from '../admin/onboarding/OnboardingWizard';

/** Thin wrapper kept for compatibility: the wizard is itself a dialog now. */
const EmployeeOnboardingModal = ({ isOpen, onClose }) => (
    <OnboardingWizard open={!!isOpen} onClose={onClose} onComplete={onClose} />
);

export default EmployeeOnboardingModal;

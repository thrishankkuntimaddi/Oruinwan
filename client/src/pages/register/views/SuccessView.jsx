import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import AuthShell from '../../../components/public/AuthShell';
import { AuthStatus, AuthNext } from '../../../components/public/AuthParts';

const SuccessView = ({ formData, onNavigate }) => (
    <AuthShell
        title="Registration submitted"
        aside={<>
            <h1 className="orw-auth__title">You’re in<br /><span className="orw-gloss-text">the queue.</span></h1>
            <p className="orw-auth__lead">We review every company by hand so only real teams get a workspace. You’ll hear from us by email.</p>
        </>}
    >
        <AuthStatus
            icon={CheckCircle2}
            tone="good"
            eyebrow="Submitted for review"
            title="Thanks, we’ve got it"
            lead={<><strong>{formData.companyName}</strong> is registered and waiting for verification.</>}
        >
            <AuthNext items={[
                'We check your documents and domain.',
                <>We email <strong>{formData.companyEmail || 'you'}</strong> when your workspace is ready, usually within 24 hours.</>,
                'Sign in with your work email and password to get started.',
            ]} />
        </AuthStatus>
        <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={() => onNavigate('/login')}>
            Go to sign in <ArrowRight size={15} />
        </button>
    </AuthShell>
);

export default SuccessView;

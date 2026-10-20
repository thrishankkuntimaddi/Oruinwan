import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthShell from '../components/public/AuthShell';
import { AuthStatus, AuthNext } from '../components/public/AuthParts';

const PendingVerification = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    return (
        <AuthShell
            title="Verification pending"
            aside={<>
                <h1 className="orw-auth__title">Almost there.<br /><span className="orw-gloss-text">Review in progress.</span></h1>
                <p className="orw-auth__lead">Every company is reviewed before its workspace opens, so only real teams get in.</p>
            </>}
        >
            <AuthStatus
                icon={Clock}
                tone="warn"
                eyebrow="Under review"
                title="Your company is being verified"
                lead="Thanks for registering. Our team is reviewing your details and documents now."
            >
                <AuthNext items={[
                    'We check the documents and domain you sent.',
                    <>You get an email as soon as your company is <strong>approved</strong>.</>,
                    'Sign in again and your workspace is ready. This usually takes 2–4 hours on business days.',
                ]} />
            </AuthStatus>

            <div className="orw-auth-actions">
                <button
                    type="button"
                    className="orw-btn orw-btn--ghost orw-btn--lg orw-btn--block"
                    onClick={async () => {
                        await logout();
                        navigate('/login');
                    }}
                >
                    <LogOut size={15} /> Sign out
                </button>
            </div>
            <p className="orw-auth__note">Questions about your review? <Link className="orw-link" to="/help">Get help</Link></p>
        </AuthShell>
    );
};

export default PendingVerification;

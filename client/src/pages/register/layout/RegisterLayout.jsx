import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import BrandMark from '../../../shared/components/ui/BrandMark';
import BRAND from '../../../shared/brand';
import { OrwRoot, usePublicPage } from '../../../components/public/PublicKit';
import '../../../components/public/authLight.css';
import '../../../components/public/authParts.css';
import ProgressHeader, { STEPS } from './ProgressHeader';

const Logo = () => (
    <Link to="/" className="orw-logo" aria-label={`${BRAND.name} home`}>
        <BrandMark size={30} />
        <span className="orw-logo__word">{BRAND.name}</span>
    </Link>
);

/**
 * Company registration in the same two-column layout as sign-in: the steps on the left,
 * the current step in a glass panel on the right, one primary action at the bottom.
 */
const RegisterLayout = ({
    children, currentStep,
    onBack, onNext, onSubmit,
    isLoading,
    showBackButton = true,
    showNextButton = true,
    showSubmitButton = false,
}) => {
    usePublicPage('Register your company');

    return (
        <OrwRoot className="orw--auth">
            <div className="orw-auth">
                <aside className="orw-auth__aside">
                    <Logo />
                    <div>
                        <h1 className="orw-auth__title">Bring your<br /><span className="orw-gloss-text">whole company.</span></h1>
                        <p className="orw-auth__lead">Register once, we verify your company, and your team gets one encrypted workspace with admin controls.</p>
                        <ol className="orw-reg-steps" aria-label="Registration steps">
                            {STEPS.map((s, i) => {
                                const n = i + 1;
                                const state = n < currentStep ? 'is-done' : n === currentStep ? 'is-current' : '';
                                return (
                                    <li key={s.title} className={state} aria-current={n === currentStep ? 'step' : undefined}>
                                        <b>{n < currentStep ? <Check size={13} strokeWidth={3} /> : n}</b>
                                        <span>{s.title}<small>{s.short}</small></span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                    <div className="orw-auth__foot">
                        <span>© {BRAND.year} {BRAND.company}</span>
                        <Link to="/privacy">Privacy</Link>
                        <Link to="/terms">Terms</Link>
                        <Link to="/help">Help</Link>
                    </div>
                </aside>

                <main className="orw-auth__main" id="main">
                    <div className="orw-auth__mobile-brand"><Logo /></div>
                    <div className="orw-auth__panel orw-glass" style={{ maxWidth: 500 }}>
                        <ProgressHeader currentStep={currentStep} />

                        <div className="orw-wizard-step" key={currentStep}>
                            {children}
                        </div>

                        <div className="orw-wizard-step__actions" style={{ marginTop: 26, gridTemplateColumns: showBackButton && currentStep > 1 ? undefined : 'minmax(0, 1fr)' }}>
                            {showBackButton && currentStep > 1 && (
                                <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={onBack} aria-label="Back to the previous step">
                                    <ArrowLeft size={15} />
                                </button>
                            )}
                            {showNextButton && currentStep < 5 ? (
                                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={onNext}>
                                    Continue <ArrowRight size={15} />
                                </button>
                            ) : showSubmitButton ? (
                                <button type="button" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" onClick={onSubmit} disabled={isLoading} aria-busy={isLoading}>
                                    {isLoading ? 'Submitting…' : <>Submit for review <ArrowRight size={15} /></>}
                                </button>
                            ) : null}
                        </div>

                        <p className="orw-auth__note">Already have an account? <Link className="orw-link" to="/login">Sign in</Link></p>
                    </div>
                </main>
            </div>
        </OrwRoot>
    );
};

export default RegisterLayout;

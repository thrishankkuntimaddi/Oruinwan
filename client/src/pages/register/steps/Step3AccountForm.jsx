import React from 'react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { FieldError } from './fieldBits';

const PWD_RULES = [
    { label: '8–16 characters',    test: p => p.length >= 8 && p.length <= 16 },
    { label: 'Uppercase letter',   test: p => /[A-Z]/.test(p) },
    { label: 'Lowercase letter',   test: p => /[a-z]/.test(p) },
    { label: 'Number',             test: p => /\d/.test(p) },
    { label: 'Symbol (e.g. # @ ! &)', test: p => /[^A-Za-z0-9\s]/.test(p) },
    { label: 'No spaces',          test: p => p.length > 0 && !/\s/.test(p) },
];

const Step3AccountForm = ({
    formData, onChange, errors,
    showPassword, showConfirmPassword,
    onTogglePassword, onToggleConfirmPassword,
}) => {
    const pwdRules = PWD_RULES.map(r => ({ ...r, met: r.test(formData.password) }));
    const matches = formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

    return (
        <div className="orw-form">
            <div className="orw-field">
                <label className="orw-label" htmlFor="reg-company-email">Work email</label>
                <input id="reg-company-email" name="companyEmail" type="email" className="orw-input" value={formData.companyEmail} onChange={onChange}
                    placeholder={`name@${formData.companyDomain || 'example.com'}`} autoComplete="email" autoFocus
                    aria-invalid={errors.companyEmail ? 'true' : undefined} />
                {errors.companyEmail
                    ? <FieldError msg={errors.companyEmail} />
                    : <p className="orw-hint">Must end in <strong style={{ color: 'var(--o-text)' }}>@{formData.companyDomain || 'your company domain'}</strong>.</p>}
            </div>

            <div className="orw-field">
                <label className="orw-label" htmlFor="reg-password">Password</label>
                <div className="orw-input-wrap">
                    <input id="reg-password" type={showPassword ? 'text' : 'password'} name="password" className="orw-input" value={formData.password} onChange={onChange}
                        placeholder="Create a password" autoComplete="new-password" aria-invalid={errors.password ? 'true' : undefined} aria-describedby="reg-pwd-rules" />
                    <button type="button" className="orw-input-wrap__btn" onClick={onTogglePassword}
                        aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>
                <ul className="orw-pwd-rules" id="reg-pwd-rules" aria-label="Password requirements">
                    {pwdRules.map(r => (
                        <li key={r.label} className={r.met ? 'is-met' : ''}>
                            <span className="orw-pwd-rules__tick" aria-hidden="true">{r.met && <Check size={10} strokeWidth={3} />}</span>
                            {r.label}<span className="orw-sr">{r.met ? ' (met)' : ' (not met)'}</span>
                        </li>
                    ))}
                </ul>
                <FieldError msg={errors.password} />
            </div>

            <div className="orw-field">
                <label className="orw-label" htmlFor="reg-confirm">Confirm password</label>
                <div className="orw-input-wrap">
                    <input id="reg-confirm" type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" className="orw-input" value={formData.confirmPassword} onChange={onChange}
                        placeholder="Repeat the password" autoComplete="new-password"
                        aria-invalid={errors.confirmPassword ? 'true' : undefined} data-state={matches ? 'ok' : undefined} />
                    <button type="button" className="orw-input-wrap__btn" onClick={onToggleConfirmPassword}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} aria-pressed={showConfirmPassword}>
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                </div>
                <FieldError msg={errors.confirmPassword} />
            </div>
        </div>
    );
};

export default Step3AccountForm;

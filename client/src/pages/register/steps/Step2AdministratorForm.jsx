import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { StatusIcon, FieldError } from './fieldBits';

const VerifyBtn = ({ status, onClick, label }) => {
    const verified = status === 'verified';
    return (
        <button type="button" onClick={onClick} disabled={verified}
            className={`orw-btn orw-btn--ghost${verified ? ' orw-btn--done' : ''}`}
            aria-label={verified ? `${label} verified` : `Verify ${label.toLowerCase()}`}
            style={verified ? { opacity: 1 } : undefined}>
            {verified ? <><CheckCircle2 size={14} /> Verified</> : 'Verify'}
        </button>
    );
};

const Step2AdministratorForm = ({
    formData, onChange, onRoleChange, errors,
    validationStatus, verificationStatus,
    onVerify, ROLES, PHONE_CODES,
    phoneNeedsVerify = true,
}) => {
    const emailSuccess = validationStatus.personalEmail === 'available' && verificationStatus.personalEmail === 'verified';
    const phoneSuccess = validationStatus.phone === 'available' && (!phoneNeedsVerify || verificationStatus.phone === 'verified');
    const emailBad = !!errors.personalEmail || validationStatus.personalEmail === 'taken';
    const phoneBad = !!errors.phone || validationStatus.phone === 'taken';

    return (
        <div className="orw-form">
            <div className="orw-form__row">
                <div className="orw-field">
                    <label className="orw-label" htmlFor="reg-admin-name">Your full name</label>
                    <input id="reg-admin-name" name="adminName" className="orw-input" value={formData.adminName} onChange={onChange}
                        placeholder="Alex Morgan" autoComplete="name" autoFocus aria-invalid={errors.adminName ? 'true' : undefined} />
                    <FieldError msg={errors.adminName} />
                </div>

                <div className="orw-field">
                    <label className="orw-label" htmlFor="reg-role">Your role</label>
                    <select id="reg-role" className="orw-select" value={formData.role} onChange={e => onRoleChange(e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            </div>

            {formData.role === 'Other' && (
                <div className="orw-field">
                    <label className="orw-label" htmlFor="reg-role-other">What is your role?</label>
                    <input id="reg-role-other" name="roleOther" className="orw-input" value={formData.roleOther} onChange={onChange}
                        placeholder="e.g. CTO" aria-invalid={errors.roleOther ? 'true' : undefined} />
                    <FieldError msg={errors.roleOther} />
                </div>
            )}

            <div className="orw-field">
                <label className="orw-label" htmlFor="reg-personal-email">Personal email</label>
                <div className="orw-inline">
                    <div className="orw-input-wrap">
                        <input id="reg-personal-email" name="personalEmail" type="email" className="orw-input" value={formData.personalEmail} onChange={onChange}
                            placeholder="alex.morgan@example.com" autoComplete="email"
                            aria-invalid={emailBad ? 'true' : undefined} data-state={emailSuccess ? 'ok' : undefined} />
                        <span className="orw-input-wrap__status"><StatusIcon s={validationStatus.personalEmail === 'checking' ? 'checking' : undefined} /></span>
                    </div>
                    <VerifyBtn label="Email" status={verificationStatus.personalEmail} onClick={() => onVerify('personalEmail')} />
                </div>
                {errors.personalEmail
                    ? <FieldError msg={errors.personalEmail} />
                    : <p className="orw-hint">For account recovery. We’ll send a 6-digit code to confirm it.</p>}
            </div>

            <div className="orw-field">
                <label className="orw-label" htmlFor="reg-phone">Phone number</label>
                <div className="orw-inline orw-inline--wrap">
                    <div className="orw-phone">
                        <select name="phoneCode" className="orw-select" value={formData.phoneCode} onChange={onChange} aria-label="Country code">
                            {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                        <input id="reg-phone" name="phone" type="tel" className="orw-input" value={formData.phone} onChange={onChange}
                            placeholder="000 000 0000" autoComplete="tel-national" inputMode="tel"
                            aria-invalid={phoneBad ? 'true' : undefined} data-state={phoneSuccess ? 'ok' : undefined} />
                    </div>
                    {phoneNeedsVerify && <VerifyBtn label="Phone" status={verificationStatus.phone} onClick={() => onVerify('phone')} />}
                </div>
                {errors.phone
                    ? <FieldError msg={errors.phone} />
                    : <p className="orw-hint">Pick your country code first. India (+91) and the US (+1) use 10 digits.</p>}
            </div>
        </div>
    );
};

export default Step2AdministratorForm;

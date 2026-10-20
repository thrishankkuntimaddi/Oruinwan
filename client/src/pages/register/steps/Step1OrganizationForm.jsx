import React from 'react';
import { StatusIcon, FieldError } from './fieldBits';

const Step1OrganizationForm = ({ formData, onChange, errors, validationStatus }) => (
    <div className="orw-form">
        <div className="orw-field">
            <label className="orw-label" htmlFor="reg-company">Company name</label>
            <div className="orw-input-wrap">
                <input id="reg-company" name="companyName" className="orw-input" value={formData.companyName} onChange={onChange}
                    placeholder="Acme Innovations Inc." autoComplete="organization" autoFocus
                    aria-invalid={errors.companyName ? 'true' : undefined}
                    data-state={validationStatus.companyName === 'available' ? 'ok' : undefined}
                    aria-describedby={errors.companyName ? 'reg-company-err' : undefined} />
                <span className="orw-input-wrap__status"><StatusIcon s={validationStatus.companyName} /></span>
            </div>
            <FieldError id="reg-company-err" msg={errors.companyName} />
        </div>

        <div className="orw-field">
            <label className="orw-label" htmlFor="reg-domain">Company domain</label>
            <div className="orw-input-wrap">
                <input id="reg-domain" name="companyDomain" className="orw-input" value={formData.companyDomain} onChange={onChange}
                    placeholder="acme.com" autoComplete="url" inputMode="url"
                    aria-invalid={errors.companyDomain ? 'true' : undefined}
                    data-state={validationStatus.companyDomain === 'available' ? 'ok' : undefined}
                    aria-describedby={errors.companyDomain ? 'reg-domain-err' : 'reg-domain-hint'} />
                <span className="orw-input-wrap__status"><StatusIcon s={validationStatus.companyDomain} /></span>
            </div>
            {errors.companyDomain
                ? <FieldError id="reg-domain-err" msg={errors.companyDomain} />
                : <p id="reg-domain-hint" className="orw-hint">Without https:// or www. Your work email in step 3 must use it.</p>}
        </div>
    </div>
);

export default Step1OrganizationForm;

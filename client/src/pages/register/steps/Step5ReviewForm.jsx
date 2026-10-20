import React from 'react';
import { Link } from 'react-router-dom';
import { Building, User, ShieldCheck, FileText } from 'lucide-react';

const ReviewItem = ({ icon: Icon, title, step, onEdit, children }) => (
    <button type="button" className="orw-review__item" onClick={() => onEdit(step)} aria-label={`Edit ${title.toLowerCase()}`}>
        <h3><Icon size={14} aria-hidden="true" />{title}</h3>
        <span className="orw-review__edit">Edit</span>
        <p>{children}</p>
    </button>
);

const Step5ReviewForm = ({ formData, onEdit }) => (
    <div className="orw-form">
        <div className="orw-review">
            <ReviewItem icon={Building} title="Company" step={1} onEdit={onEdit}>
                {formData.companyName || '—'} · {formData.companyDomain || '—'}
            </ReviewItem>
            <ReviewItem icon={User} title="About you" step={2} onEdit={onEdit}>
                {formData.adminName || '—'}, {formData.role === 'Other' ? formData.roleOther : formData.role}<br />
                {formData.personalEmail || '—'} · {formData.phoneCode} {formData.phone}
            </ReviewItem>
            <ReviewItem icon={ShieldCheck} title="Sign-in" step={3} onEdit={onEdit}>
                {formData.companyEmail || '—'} · password set
            </ReviewItem>
            <ReviewItem icon={FileText} title="Proof of company" step={4} onEdit={onEdit}>
                {formData.documents
                    ? `${formData.documents.name} (${(formData.documents.size / 1024 / 1024).toFixed(2)} MB)`
                    : 'No file yet'}
            </ReviewItem>
        </div>

        <p className="orw-hint">
            By submitting, you confirm these details are accurate and agree to our{' '}
            <Link className="orw-link" style={{ fontSize: 'inherit' }} to="/terms" target="_blank">Terms</Link> and{' '}
            <Link className="orw-link" style={{ fontSize: 'inherit' }} to="/privacy" target="_blank">Privacy Policy</Link>.
            We’ll email you when the review is done.
        </p>
    </div>
);

export default Step5ReviewForm;

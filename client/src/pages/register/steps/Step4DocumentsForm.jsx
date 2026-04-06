// Step4DocumentsForm.jsx — Monolith Flow Design System
import React from 'react';
import { FileText, UploadCloud, AlertCircle } from 'lucide-react';

// Ignore legacy theme prop
const Step4DocumentsForm = ({ formData, onFileChange, errors, theme }) => (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.4)', textAlign: 'center', marginBottom: '32px' }}>
            Please upload verification documents for your entity.
        </p>

        <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" style={{ display: 'none' }} onChange={onFileChange} />
            <div style={{
                border: `2px dashed ${formData.documents ? '#5aba8a' : errors.documents ? '#e05252' : 'rgba(255,255,255,0.1)'}`,
                padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '12px', textAlign: 'center', transition: 'all 200ms ease',
                background: formData.documents ? 'rgba(90,186,138,0.04)' : 'rgba(255,255,255,0.02)',
            }}
                onMouseEnter={e => !formData.documents && (e.currentTarget.style.borderColor = 'rgba(184,149,106,0.4)')}
                onMouseLeave={e => !formData.documents && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}>

                <div style={{ width: '52px', height: '52px', background: formData.documents ? 'rgba(90,186,138,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${formData.documents ? 'rgba(90,186,138,0.25)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {formData.documents
                        ? <FileText size={24} style={{ color: '#5aba8a' }} />
                        : <UploadCloud size={24} style={{ color: 'rgba(228,228,228,0.3)' }} />
                    }
                </div>

                {formData.documents ? (
                    <>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4' }}>{formData.documents.name}</p>
                        <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.35)' }}>
                            {(formData.documents.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <span style={{ fontSize: '12px', color: '#b8956a', fontWeight: 600, textDecoration: 'underline' }}>Change File</span>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4' }}>Drag & Drop or click to upload</p>
                        <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.35)', lineHeight: '1.6' }}>
                            Business Registration, Tax ID, or Incorporation Certificate
                        </p>
                        <div style={{ padding: '8px 20px', background: '#b8956a', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                            Browse Files
                        </div>
                    </>
                )}
            </div>
        </label>

        {errors.documents && (
            <p style={{ fontSize: '11px', color: '#e05252', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <AlertCircle size={11} />{errors.documents}
            </p>
        )}
    </div>
);

export default Step4DocumentsForm;

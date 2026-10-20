import React from 'react';
import { FileCheck2, UploadCloud } from 'lucide-react';
import { AuthMark } from '../../../components/public/AuthParts';
import { FieldError } from './fieldBits';

const Step4DocumentsForm = ({ formData, onFileChange, errors }) => {
    const file = formData.documents;
    return (
        <div className="orw-form">
            <label className="orw-drop" data-state={file ? 'ok' : errors.documents ? 'error' : undefined}>
                <input type="file" className="orw-sr" onChange={onFileChange} aria-describedby="reg-doc-help" />
                <AuthMark icon={file ? FileCheck2 : UploadCloud} tone={file ? 'good' : undefined} />
                {file ? (
                    <>
                        <b>{file.name}</b>
                        <small>{(file.size / 1024 / 1024).toFixed(2)} MB · ready to submit</small>
                        <span className="orw-link">Choose a different file</span>
                    </>
                ) : (
                    <>
                        <b>Choose a file to upload</b>
                        <small id="reg-doc-help">Business registration, tax ID or certificate of incorporation. PDF or image.</small>
                        <span className="orw-btn orw-btn--ghost" style={{ marginTop: 6 }}>Browse files</span>
                    </>
                )}
            </label>
            <FieldError msg={errors.documents} />
        </div>
    );
};

export default Step4DocumentsForm;

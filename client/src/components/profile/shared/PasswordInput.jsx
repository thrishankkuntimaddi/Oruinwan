import React, { useId } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import '../profileMenu.css';

const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    onToggle,
    placeholder = "",
    fieldType = "new"
}) => {
    const id = useId();
    return (
        <div className="cd-field">
            <label htmlFor={id}>{label}</label>
            <div className="pm-pass">
                <input
                    id={id}
                    className="gl-input"
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    name={`password-${fieldType}-${id}`}
                    autoComplete={fieldType === "current" ? "current-password" : "new-password"}
                    data-lpignore="true"
                    data-form-type="other"
                    placeholder={placeholder}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
        </div>
    );
};

export default PasswordInput;

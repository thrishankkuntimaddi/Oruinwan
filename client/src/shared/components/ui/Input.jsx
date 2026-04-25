import React from 'react';

const Input = React.forwardRef(({
    type = "text",
    label,
    error,
    icon,
    iconPosition = "left", 
    helperText,
    className = "",
    containerClassName = "",
    id,
    fullWidth = true,
    ...props
}, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substr(2, 9);

    return (
        <div className={`${fullWidth ? "w-full" : ""} ${containerClassName}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-1.5"
                >
                    {label}
                </label>
            )}

            <div className="relative">
                {icon && iconPosition === "left" && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-secondary-400">
                        {icon}
                    </div>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    type={type}
                    className={`
            block w-full rounded-lg border-secondary-300 bg-white
            text-secondary-900 shadow-sm
            focus:border-primary-500 focus:ring-primary-500
            disabled:cursor-not-allowed disabled:bg-secondary-50 disabled:text-secondary-500
            dark:bg-secondary-800 dark:border-secondary-700 dark:text-white dark:placeholder-secondary-500
            dark:focus:border-primary-500 dark:focus:ring-primary-500
            transition-colors duration-200
            ${icon && iconPosition === "left" ? "pl-10" : "pl-3"}
            ${icon && iconPosition === "right" ? "pr-10" : ""}
            ${error ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500" : ""}
            ${className}
            py-2 sm:text-sm
          `}
                    {...props}
                />

                {icon && iconPosition === "right" && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-secondary-400">
                        {icon}
                    </div>
                )}
            </div>

            {helperText && !error && (
                <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{helperText}</p>
            )}

            {error && (
                <p className="mt-1 text-xs text-danger-500 animate-fade-in">{error}</p>
            )}
        </div>
    );
});

Input.displayName = "Input";

export default Input;

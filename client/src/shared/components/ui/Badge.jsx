import React from 'react';

const Badge = ({ children, variant = "secondary", size = "md", className = "", ...props }) => {
    const variants = {
        primary: "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300",
        secondary: "bg-secondary-100 text-secondary-800 dark:bg-secondary-800 dark:text-secondary-300",
        success: "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300",
        warning: "bg-warning-50 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300",
        danger: "bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300",
        outline: "border border-secondary-300 text-secondary-600 dark:border-secondary-600 dark:text-secondary-400",
    };

    const sizes = {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-sm",
        lg: "px-3 py-1 text-base",
    };

    return (
        <span
            className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
};

export default Badge;

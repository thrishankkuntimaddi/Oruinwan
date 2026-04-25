import React from 'react';

const Button = React.forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    isLoading = false,
    disabled = false,
    type = 'button',
    icon,
    ...props
}, ref) => {

    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none rounded-lg active:scale-95";

    const variants = {
        primary: "bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md focus:ring-primary-500",
        secondary: "bg-secondary-100 hover:bg-secondary-200 text-secondary-900 dark:bg-secondary-800 dark:hover:bg-secondary-700 dark:text-secondary-100 focus:ring-secondary-500",
        ghost: "bg-transparent hover:bg-secondary-100 text-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-800",
        danger: "bg-danger-500 hover:bg-danger-600 text-white shadow-sm focus:ring-danger-500",
        warning: "bg-orange-500 hover:bg-orange-600 text-white shadow-sm focus:ring-orange-500",
        outline: "border border-secondary-300 bg-transparent hover:bg-secondary-50 text-secondary-700 dark:border-secondary-600 dark:text-secondary-200 dark:hover:bg-secondary-800",
        link: "text-primary-500 hover:underline p-0 h-auto bg-transparent active:scale-100",
    };

    const sizes = {
        xs: "h-7 px-2 text-xs",
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-2", 
    };

    
    const variantStyles = variants[variant] || variants.primary;
    const sizeStyles = sizes[size] || sizes.md;

    return (
        <button
            ref={ref}
            type={type}
            className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {children}
                </>
            ) : (
                <>
                    {icon && <span className="mr-2">{icon}</span>}
                    {children}
                </>
            )}
        </button>
    );
});

Button.displayName = "Button";

export default Button;

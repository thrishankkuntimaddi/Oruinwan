import React, { useState } from 'react';

const Avatar = ({ src, alt, fallback, size = "md", className = "", status, ...props }) => {
    const [error, setError] = useState(false);

    const sizes = {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-lg",
        '2xl': "h-24 w-24 text-xl",
    };

    const statusColors = {
        online: "bg-success-500",
        offline: "bg-secondary-400",
        busy: "bg-danger-500",
        away: "bg-warning-500",
    };

    const getInitials = (name) => {
        if (!name) return "??";
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <div className={`relative overflow-hidden rounded-full bg-secondary-200 dark:bg-secondary-700 flex items-center justify-center text-secondary-600 dark:text-secondary-200 font-medium ${sizes[size]}`}>
                {src && !error ? (
                    <img
                        src={src}
                        alt={alt || "Avatar"}
                        className="h-full w-full object-cover"
                        onError={() => setError(true)}
                        {...props}
                    />
                ) : (
                    <span>{fallback ? getInitials(fallback) : getInitials(alt)}</span>
                )}
            </div>
            {status && (
                <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-secondary-900 ${statusColors[status] || statusColors.offline}`} />
            )}
        </div>
    );
};

export default Avatar;

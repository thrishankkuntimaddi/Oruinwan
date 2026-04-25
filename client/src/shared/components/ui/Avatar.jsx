import React, { useState } from 'react';
import { getAvatarUrl } from '../../../utils/avatarUtils';

const Avatar = ({ src, username, alt, fallback, size = "md", className = "", status, ...props }) => {
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

    
    
    
    
    const seed = username || alt || fallback;
    const autoAvatarSrc = seed ? getAvatarUrl({ username: seed }) : null;
    const effectiveSrc = (!error && src) ? src : (!error && autoAvatarSrc ? null : null);
    const imgSrc = src && !error ? src : (autoAvatarSrc && !error ? autoAvatarSrc : null);

    return (
        <div className={`relative inline-block rounded-full ${className}`}>
            <div className={`relative overflow-hidden rounded-full bg-secondary-200 dark:bg-secondary-700 flex items-center justify-center text-secondary-600 dark:text-secondary-200 font-medium ${sizes[size]}`}>
                {imgSrc ? (
                    <img
                        src={imgSrc}
                        alt={alt || username || "Avatar"}
                        className="h-full w-full object-cover"
                        onError={() => setError(true)}
                        {...props}
                    />
                ) : (
                    <span>{fallback ? getInitials(fallback) : getInitials(alt || username)}</span>
                )}
            </div>
            {status && (
                <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ${statusColors[status] || statusColors.offline}`} style={{ boxShadow: '0 0 0 2px var(--bg-base, #0c0c0c)' }} />
            )}
        </div>
    );
};

export default Avatar;

import React from 'react';

const Card = ({ children, className = "", noPadding = false, hover = false, ...props }) => {
    return (
        <div
            className={`
        bg-white dark:bg-dark-card 
        border border-secondary-200 dark:border-dark-border 
        rounded-xl shadow-sm 
        ${hover ? "hover:shadow-md transition-shadow duration-200" : ""} 
        ${noPadding ? "" : "p-6"} 
        ${className}
      `}
            {...props}
        >
            {children}
        </div>
    );
};

const Header = ({ children, className = "", title, subtitle }) => {
    return (
        <div className={`mb-4 ${className}`}>
            {title && <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">{subtitle}</p>}
            {children}
        </div>
    );
};

const Body = ({ children, className = "" }) => {
    return <div className={className}>{children}</div>;
}

const Footer = ({ children, className = "" }) => {
    return (
        <div className={`mt-6 pt-4 border-t border-secondary-100 dark:border-secondary-700 ${className}`}>
            {children}
        </div>
    )
}

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

export default Card;

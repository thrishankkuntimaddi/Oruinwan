import React from 'react';
import SharedCard from '../../shared/components/ui/Card';

/**
 * Reusable Card component for Settings tabs
 * Wraps the shared standardized Card component
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.subtitle - Card subtitle
 * @param {string} props.className - Additional CSS classes
 */
const Card = ({ children, title, subtitle, className = "" }) => (
    <SharedCard className={`transition-shadow duration-300 ${className}`} hover={true} noPadding={false}>
        {(title || subtitle) && (
            <SharedCard.Header
                title={title}
                subtitle={subtitle}
                className="pb-4 border-b border-secondary-100 dark:border-secondary-800 mb-6"
            />
        )}
        <SharedCard.Body>
            {children}
        </SharedCard.Body>
    </SharedCard>
);

export default Card;

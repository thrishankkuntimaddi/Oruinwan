import React from 'react';
import { useBump } from '../../utils/motion';

/**
 * An unread count that bumps when it goes up (and stays still when motion is reduced).
 * Renders nothing at 0, but stays mounted so going from 0 to 1 bumps too.
 */
export default function BumpCount({ count = 0, className = '', prefix = '', max = 99, ...rest }) {
    const bump = useBump(count);
    if (!(count > 0)) return null;
    return (
        <span key={bump.key} className={[className, bump.className].filter(Boolean).join(' ')} {...rest}>
            {prefix}{count > max ? `${max}+` : count}
        </span>
    );
}

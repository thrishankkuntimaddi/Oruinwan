import React, { useState } from 'react';
import { getAvatarUrl } from '../../../utils/avatarUtils';

/**
 * Round avatar for a person: their uploaded photo, else the generated avatar the
 * rest of the app uses (getAvatarUrl). Falls back to the initial if the image
 * cannot load (offline, blocked CDN).
 */
export default function UserAvatarImage({ userId, name = '', src, size = 32, style, initialStyle }) {
    const [failed, setFailed] = useState(false);
    const url = getAvatarUrl({ _id: userId, username: name, profilePicture: src });
    const box = { width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0 };

    if (failed || !url) {
        return (
            <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: `${Math.round(size * 0.4)}px`, ...initialStyle, ...style }}>
                {(name || '?').charAt(0).toUpperCase()}
            </div>
        );
    }
    return (
        <img
            data-testid="user-avatar"
            src={url}
            alt={name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            style={{ ...box, objectFit: 'cover', display: 'block', ...style }}
        />
    );
}

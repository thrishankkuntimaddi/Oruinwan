import { useEffect } from 'react';

/**
 * Revokes `url` (if it is a blob: object URL) when it is replaced by another
 * value or when the component unmounts.
 */
export function useRevokeObjectUrl(url) {
    useEffect(() => {
        if (typeof url !== 'string' || !url.startsWith('blob:')) return undefined;
        return () => URL.revokeObjectURL(url);
    }, [url]);
}

export default useRevokeObjectUrl;

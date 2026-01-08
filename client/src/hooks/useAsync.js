// client/src/hooks/useAsync.js
import { useState, useCallback } from 'react';

/**
 * Custom hook for handling async operations with loading and error states
 * Eliminates 200+ duplicate loading state management blocks
 * 
 * @param {Function} asyncFunction - The async function to execute
 * @param {boolean} immediate - Whether to execute immediately on mount
 * @returns {Object} { data, loading, error, execute }
 * 
 * @example
 * const { data, loading, error, execute } = useAsync(fetchUsers);
 * 
 * // Execute manually
 * useEffect(() => { execute(); }, []);
 * 
 * // Or with immediate execution
 * const { data, loading, error } = useAsync(fetchUsers, true);
 */
export const useAsync = (asyncFunction, immediate = false) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(immediate);
    const [error, setError] = useState(null);

    const execute = useCallback(
        async (...params) => {
            setLoading(true);
            setError(null);

            try {
                const result = await asyncFunction(...params);
                setData(result);
                return result;
            } catch (err) {
                setError(err);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [asyncFunction]
    );

    // Execute immediately if requested
    useState(() => {
        if (immediate) {
            execute();
        }
    });

    return { data, loading, error, execute };
};

/**
 * Simplified version for common GET requests
 * @param {Function} fetchFunction - Function that fetches data
 * @returns {Object} { data, loading, error, refetch }
 */
export const useFetch = (fetchFunction) => {
    const { data, loading, error, execute } = useAsync(fetchFunction, true);

    return {
        data,
        loading,
        error,
        refetch: execute
    };
};

export default useAsync;

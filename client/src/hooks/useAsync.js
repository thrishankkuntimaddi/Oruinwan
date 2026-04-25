import { useState, useCallback } from 'react';

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

    
    useState(() => {
        if (immediate) {
            execute();
        }
    });

    return { data, loading, error, execute };
};

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

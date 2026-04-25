import { useState, useCallback } from 'react';

export const useForm = (initialValues = {}, onSubmit, validate) => {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    
    const handleChange = useCallback((event) => {
        const { name, value, type, checked } = event.target;

        setValues((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }, [errors]);

    
    const setValue = useCallback((name, value) => {
        setValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    }, []);

    
    const setMultipleValues = useCallback((newValues) => {
        setValues((prev) => ({
            ...prev,
            ...newValues,
        }));
    }, []);

    
    const handleBlur = useCallback((event) => {
        const { name } = event.target;
        setTouched((prev) => ({
            ...prev,
            [name]: true,
        }));

        
        if (validate) {
            const validationErrors = validate(values);
            if (validationErrors[name]) {
                setErrors((prev) => ({
                    ...prev,
                    [name]: validationErrors[name],
                }));
            }
        }
    }, [validate, values]);

    
    const handleSubmit = useCallback(
        async (event) => {
            if (event) {
                event.preventDefault();
            }

            
            if (validate) {
                const validationErrors = validate(values);
                setErrors(validationErrors);

                
                if (Object.keys(validationErrors).length > 0) {
                    
                    const allTouched = Object.keys(values).reduce((acc, key) => {
                        acc[key] = true;
                        return acc;
                    }, {});
                    setTouched(allTouched);
                    return;
                }
            }

            
            setIsSubmitting(true);
            try {
                await onSubmit(values);
            } catch (error) {
                
                if (error.fieldErrors) {
                    setErrors(error.fieldErrors);
                }
                throw error;
            } finally {
                setIsSubmitting(false);
            }
        },
        [values, validate, onSubmit]
    );

    
    const resetForm = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
    }, [initialValues]);

    
    const setFieldError = useCallback((fieldName, errorMessage) => {
        setErrors((prev) => ({
            ...prev,
            [fieldName]: errorMessage,
        }));
    }, []);

    
    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    
    const getFieldError = useCallback(
        (fieldName) => {
            return touched[fieldName] && errors[fieldName];
        },
        [touched, errors]
    );

    return {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
        resetForm,
        setValue,
        setMultipleValues,
        setFieldError,
        clearErrors,
        getFieldError,
    };
};

export const useSimpleForm = (initialValues = {}, onSubmit) => {
    return useForm(initialValues, onSubmit, null);
};

export default useForm;

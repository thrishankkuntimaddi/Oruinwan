// client/src/hooks/useForm.js
import { useState, useCallback } from 'react';

/**
 * Custom hook for form state management with validation
 * Eliminates 50+ duplicate form handling patterns
 * 
 * @param {Object} initialValues - Initial form field values
 * @param {Function} onSubmit - Form submission handler
 * @param {Function} validate - Optional validation function
 * @returns {Object} Form state and handlers
 * 
 * @example
 * const { values, errors, handleChange, handleSubmit, isSubmitting, resetForm } = useForm(
 *   { email: '', password: '' },
 *   async (values) => { await login(values); },
 *   (values) => {
 *     const errors = {};
 *     if (!values.email) errors.email = 'Email is required';
 *     return errors;
 *   }
 * );
 */
export const useForm = (initialValues = {}, onSubmit, validate) => {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Handle input change
     */
    const handleChange = useCallback((event) => {
        const { name, value, type, checked } = event.target;

        setValues((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * Handle programmatic value updates
     */
    const setValue = useCallback((name, value) => {
        setValues((prev) => ({
            ...prev,
            [name]: value,
        }));
    }, []);

    /**
     * Handle multiple values at once
     */
    const setMultipleValues = useCallback((newValues) => {
        setValues((prev) => ({
            ...prev,
            ...newValues,
        }));
    }, []);

    /**
     * Handle field blur (for touch tracking)
     */
    const handleBlur = useCallback((event) => {
        const { name } = event.target;
        setTouched((prev) => ({
            ...prev,
            [name]: true,
        }));

        // Validate single field on blur if validate function provided
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

    /**
     * Handle form submission
     */
    const handleSubmit = useCallback(
        async (event) => {
            if (event) {
                event.preventDefault();
            }

            // Validate all fields
            if (validate) {
                const validationErrors = validate(values);
                setErrors(validationErrors);

                // Don't submit if there are errors
                if (Object.keys(validationErrors).length > 0) {
                    // Mark all fields as touched to show errors
                    const allTouched = Object.keys(values).reduce((acc, key) => {
                        acc[key] = true;
                        return acc;
                    }, {});
                    setTouched(allTouched);
                    return;
                }
            }

            // Submit form
            setIsSubmitting(true);
            try {
                await onSubmit(values);
            } catch (error) {
                // If onSubmit throws an error with field-specific errors, set them
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

    /**
     * Reset form to initial values
     */
    const resetForm = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
    }, [initialValues]);

    /**
     * Set specific field error
     */
    const setFieldError = useCallback((fieldName, errorMessage) => {
        setErrors((prev) => ({
            ...prev,
            [fieldName]: errorMessage,
        }));
    }, []);

    /**
     * Clear all errors
     */
    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    /**
     * Check if field has error and is touched
     */
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

/**
 * Simplified hook for forms without validation
 */
export const useSimpleForm = (initialValues = {}, onSubmit) => {
    return useForm(initialValues, onSubmit, null);
};

export default useForm;

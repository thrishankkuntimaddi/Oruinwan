
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createDepartment, updateDepartment } from '../../services/departmentService';
import { useForm } from '../../hooks/useForm';
import { getErrorMessage } from '../../utils/apiHelpers';

const DepartmentModal = ({ isOpen, onClose, companyId, department, onSuccess }) => {

    const { values, errors, handleChange, handleSubmit, isSubmitting, resetForm, setMultipleValues } = useForm(
        { name: '', description: '' },
        async (formValues) => {
            try {
                if (department) {
                    await updateDepartment(department._id, formValues);
                } else {
                    await createDepartment(companyId, formValues.name, formValues.description);
                }
                onSuccess();
                onClose();
            } catch (err) {
                console.error("Failed to save department", err);
                const error = new Error(getErrorMessage(err));
                error.fieldErrors = { submit: getErrorMessage(err) };
                throw error;
            }
        }
    );

    useEffect(() => {
        if (isOpen) {
            if (department) {
                setMultipleValues({
                    name: department.name || '',
                    description: department.description || ''
                });
            } else {
                resetForm();
            }
        }
    }, [department, isOpen, setMultipleValues, resetForm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slideUp">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800">
                        {department ? 'Edit Department' : 'Create Department'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {errors.submit && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {errors.submit}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Department Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={values.name}
                            onChange={handleChange}
                            placeholder="e.g. Engineering"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            value={values.description}
                            onChange={handleChange}
                            placeholder="Brief description..."
                            rows="3"
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium resize-none"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
                        >
                            {isSubmitting ? (department ? 'Saving...' : 'Creating...') : (department ? 'Save Changes' : 'Create Department')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DepartmentModal;

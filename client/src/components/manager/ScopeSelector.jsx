import React, { useState, useEffect } from 'react';
import { Briefcase, Building, ChevronDown, Check } from 'lucide-react';
import { API_BASE } from '@services/api';

const ScopeSelector = ({ onScopeChange, onLoad }) => {
    const [scope, setScope] = useState(null); // { type: 'department'|'workspace', id, name }
    const [options, setOptions] = useState({ departments: [], workspaces: [] });
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScope = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/managers/scope`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                });
                const data = await res.json();
                setOptions(data);

                // Pass full data back to parent
                if (onLoad) onLoad(data);

                // Default selection: First department, or first workspace
                if (data.departments && data.departments.length > 0) {
                    handleSelect('department', data.departments[0]);
                } else if (data.workspaces && data.workspaces.length > 0) {
                    handleSelect('workspace', data.workspaces[0]);
                } else {
                    console.warn("No managed scope available for this user.");
                }
            } catch (err) {
                console.error("Failed to fetch manager scope", err);
            } finally {
                setLoading(false);
            }
        };

        fetchScope();
    }, []);

    const handleSelect = (type, item) => {
        const newScope = { type, id: item._id, name: item.name };
        setScope(newScope);
        onScopeChange(newScope);
        setIsOpen(false);
    };

    if (loading) return <div className="animate-pulse h-10 w-48 bg-gray-100 rounded-lg"></div>;
    if (!scope) return <div className="text-gray-500 text-sm">No managed scope found</div>;

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 bg-white border border-gray-200 hover:border-indigo-300 px-4 py-2.5 rounded-xl shadow-sm transition-all min-w-[240px]"
            >
                <div className={`p-1.5 rounded-lg ${scope.type === 'department' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                    {scope.type === 'department' ? <Building size={16} /> : <Briefcase size={16} />}
                </div>
                <div className="flex-1 text-left">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{scope.type}</p>
                    <p className="font-bold text-gray-900 truncate">{scope.name}</p>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-2 overflow-hidden animate-fadeIn max-h-96 overflow-y-auto">
                    {/* Departments */}
                    {options.departments.length > 0 && (
                        <div className="mb-2">
                            <p className="px-3 py-2 text-xs font-bold text-gray-400 uppercase">Departments</p>
                            {options.departments.map(dept => (
                                <button
                                    key={dept._id}
                                    onClick={() => handleSelect('department', dept)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${scope.id === dept._id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <Building size={16} />
                                    <span className="truncate flex-1 text-left">{dept.name}</span>
                                    {scope.id === dept._id && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Workspaces */}
                    {options.workspaces.length > 0 && (
                        <div>
                            <p className="px-3 py-2 text-xs font-bold text-gray-400 uppercase">Workspaces</p>
                            {options.workspaces.map(ws => (
                                <button
                                    key={ws._id}
                                    onClick={() => handleSelect('workspace', ws)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${scope.id === ws._id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <Briefcase size={16} />
                                    <span className="truncate flex-1 text-left">{ws.name}</span>
                                    {scope.id === ws._id && <Check size={16} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScopeSelector;

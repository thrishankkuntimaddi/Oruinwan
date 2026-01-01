import React, { useState, useEffect } from 'react';
import { User, Briefcase, Plus, MessageSquare, Check, X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TeamAllocation = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [newEmail, setNewEmail] = useState("");

    const navigate = useNavigate();
    const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/managers/allocations`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error("Allocation fetch error", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggle = async (userId, workspaceId, currentStatus) => {
        const action = currentStatus ? 'remove' : 'add';

        // Optimistic UI Update
        const newData = { ...data };
        const userLocs = newData.allocations[userId];
        if (action === 'add') {
            userLocs.push(workspaceId);
        } else {
            const idx = userLocs.indexOf(workspaceId);
            if (idx > -1) userLocs.splice(idx, 1);
        }
        setData(newData);

        try {
            await fetch(`${API_BASE}/api/managers/allocations/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ userId, workspaceId, action })
            });
        } catch (err) {
            console.error("Update failed", err);
            fetchData(); // Revert on error
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();

        // Find the first managed department (simplification for MVP)
        // In full version, user selects which dept to add to if they manage multiple
        // We'll assumne user manages *some* department if they are here
        // Ideally we fetch user scope logic again or pass dept ID.
        // For now let's just use the first dept we find logic in Backend or here.
        // Actually, let's ask user which dept? 
        // Simpler: Just try to add to their first managed department.

        // Note: The UI for selecting dept is omitted for brevity as per "Execution Focused" prompt
        // Let's assume the backend handles finding the right dept or default to first.

        // Wait, we need a department ID. 
        // Let's use the ID from the first member we have? Or we need to fetch scope.
        // Let's just pass null and let backend decide or error? 
        // Backend expects 'departmentId'. 
        // Let's just fetch scope first to get Dept ID.
        // Actually, `data.members` has `department` name, not ID.
        // We might need to refactor `getAllocations` to return dept ID logic.
        // OR: Just navigate user to "Add Member" modal.

        // Let's keep it simple: "Add to Team" adds to the FIRST valid dept.

        setIsAdding(true);
        try {
            // We need a department ID. Let's fetch scope quickly if not present.
            const scopeRes = await fetch(`${API_BASE}/api/managers/scope`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
            });
            const scopeData = await scopeRes.json();
            if (!scopeData.departments.length) {
                alert("You don't manage any departments!");
                return;
            }

            await fetch(`${API_BASE}/api/managers/allocations/department/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ email: newEmail, departmentId: scopeData.departments[0]._id })
            });

            setNewEmail("");
            fetchData(); // Refresh list

        } catch (err) {
            alert("Failed to add user");
        } finally {
            setIsAdding(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading Matrix...</div>;
    if (!data) return <div className="p-8 text-center text-red-400">Failed to load allocation data.</div>;

    const filteredMembers = data?.members.filter(m =>
        m.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <User size={18} className="text-indigo-600" />
                        Team Allocation Matrix
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Assign people to workspaces instantly.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Add Member Input */}
                    <form onSubmit={handleAddMember} className="flex items-center gap-2">
                        <div className="relative">
                            <Plus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                placeholder="Add by email..."
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none w-48 transition-all"
                            />
                        </div>
                        <button disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-lg transition-colors">
                            {isAdding ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Check size={16} />}
                        </button>
                    </form>

                    <div className="h-6 w-px bg-gray-200 mx-1"></div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Filter people..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-sm bg-gray-100 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-gray-200 outline-none w-40 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Matrix Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-4 font-bold text-gray-600 text-sm border-b border-r border-gray-200 min-w-[200px]">Team Member</th>
                            {data.workspaces.map(ws => (
                                <th key={ws._id} className="p-4 font-bold text-gray-600 text-xs text-center border-b border-gray-200 min-w-[100px]">
                                    <div className="flex flex-col items-center gap-1">
                                        <Briefcase size={14} className="text-gray-400" />
                                        {ws.name}
                                    </div>
                                </th>
                            ))}
                            <th className="p-4 font-bold text-gray-600 text-sm text-center border-b border-l border-gray-200 bg-gray-50 w-24 sticky right-0">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredMembers.map(member => (
                            <tr key={member._id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-4 border-r border-gray-100 sticky left-0 bg-white group-hover:bg-gray-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold text-sm border-2 border-white shadow-sm">
                                                {member.username[0]}
                                            </div>
                                            {member.isOnline && (
                                                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm">{member.username}</div>
                                            <div className="text-xs text-gray-400 truncate max-w-[120px]">{member.email}</div>
                                        </div>
                                    </div>
                                </td>

                                {data.workspaces.map(ws => {
                                    const isAssigned = data.allocations[member._id]?.includes(ws._id);
                                    return (
                                        <td key={ws._id} className="p-4 text-center">
                                            <label className="relative inline-flex items-center justify-center cursor-pointer group/check">
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={isAssigned || false}
                                                    onChange={() => handleToggle(member._id, ws._id, isAssigned)}
                                                />
                                                <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center
                                                    ${isAssigned
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'border-gray-300 bg-white text-transparent hover:border-indigo-300'
                                                    }
                                                `}>
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            </label>
                                        </td>
                                    );
                                })}

                                <td className="p-4 text-center border-l border-gray-100 bg-white sticky right-0 group-hover:bg-gray-50/50">
                                    <button
                                        onClick={() => navigate(`/workspace/${data.workspaces[0]?._id}/home/dm/new/${member._id}`)} // Rough heuristic to jump to DM
                                        // Better: Just go to /workspaces -> Messages? No, jumping to a specific workspace context is how DMs work right now.
                                        // We will try using the first managed workspace as the context for the DM.
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Send Message"
                                    >
                                        <MessageSquare size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredMembers.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        <User size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No team members found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamAllocation;

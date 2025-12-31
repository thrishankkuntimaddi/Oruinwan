import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, MoreHorizontal } from 'lucide-react'; // Removed Trash, Edit
// import { useNavigate } from 'react-router-dom'; // Removed unused navigate
import axios from 'axios';

const DepartmentManagement = () => {
  // const navigate = useNavigate(); // Removed unused
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/departments`, {
        withCredentials: true
      });
      setDepartments(res.data.departments);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Departments</h1>
        <button
          onClick={() => console.log('Create Dept dialog')}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> Add Department
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search departments..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all shadow-sm text-slate-700"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Workspaces</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="text-center py-8 text-slate-500">Loading departments...</td></tr>
            ) : departments.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-slate-500">No departments found</td></tr>
            ) : (
              departments.map(dept => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{dept.name}</td>
                  <td className="px-6 py-4">
                    {dept.head !== '-' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{dept.head}</span>
                    ) : (
                      <span className="text-slate-400 italic text-sm">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{dept.members} members</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{dept.workspaces} Active</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{dept.created}</td>
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepartmentManagement;

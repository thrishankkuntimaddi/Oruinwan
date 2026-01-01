
import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import AdminSidebar from '../../components/admin/AdminSidebar';
import DepartmentModal from '../../components/company/DepartmentModal'; // Import Modal
import { getDepartments } from '../../services/departmentService'; // Use service

const DepartmentManagement = () => {
  const { company } = useCompany();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDepartments = async () => {
    if (!company?._id) return;
    try {
      setLoading(true);
      const res = await getDepartments(company._id);
      setDepartments(res.departments || []);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [company?._id]);

  const handleCreate = () => {
    setSelectedDept(null);
    setIsModalOpen(true);
  };

  const handleEdit = (dept) => {
    setSelectedDept(dept);
    setIsModalOpen(true);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <AdminSidebar />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        <header className="h-16 px-8 flex items-center justify-between z-10 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-xl font-black text-slate-800">Departments</h2>
            <p className="text-xs text-slate-500 font-medium">Structure & Access</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={18} /> Add Department
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar">

          <div className="relative mb-6 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm font-medium"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Head</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-12 text-slate-500">Loading departments...</td></tr>
                ) : filteredDepartments.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-12 text-slate-500">No departments found</td></tr>
                ) : (
                  filteredDepartments.map(dept => (
                    <tr key={dept._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{dept.name}</div>
                        {dept.description && <div className="text-xs text-slate-400">{dept.description}</div>}
                      </td>
                      <td className="px-6 py-4">
                        {dept.head ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">{dept.head?.username || 'Unknown'}</span>
                        ) : (
                          <span className="text-slate-400 italic text-xs font-medium">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-slate-400" /> {dept.members?.length || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-400">{new Date(dept.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEdit(dept)}
                          className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        department={selectedDept}
        companyId={company?._id}
        onSuccess={fetchDepartments}
      />
    </div>
  );
};

export default DepartmentManagement;

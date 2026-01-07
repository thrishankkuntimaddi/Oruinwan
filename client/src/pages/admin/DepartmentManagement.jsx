import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, MoreHorizontal, Edit, Trash2, MessageCircle } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import DepartmentModal from '../../components/company/DepartmentModal'; // Import Modal
import DepartmentDetailsModal from '../../components/company/DepartmentDetailsModal'; // Import "Window" (Modal)
import { getDepartments, deleteDepartment } from '../../services/departmentService'; // Use service

const DepartmentManagement = () => {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewDepartment, setViewDepartment] = useState(null);
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

  const handleDelete = async (deptId) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      try {
        await deleteDepartment(deptId);
        fetchDepartments(); // Refresh list
      } catch (error) {
        console.error("Failed to delete department", error);
        alert("Failed to delete department");
      }
    }
  };

  const handleRowClick = (dept) => {
    setViewDepartment(dept);
    setIsDetailsOpen(true);
  };

  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <React.Fragment>
      <header className="h-16 px-8 flex items-center justify-between z-10 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 transition-colors duration-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white">Departments</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Structure & Access</p>
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

      <div className="flex-1 overflow-y-auto w-full px-8 py-8 z-10 custom-scrollbar bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

        <div className="relative mb-6 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-600 transition-all shadow-sm font-medium"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-gray-700 overflow-hidden transition-colors">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-gray-700/50 border-b border-slate-100 dark:border-gray-700">
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Head</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Members</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan="5" className="text-center py-12 text-slate-500 dark:text-gray-400">Loading departments...</td></tr>
              ) : filteredDepartments.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-12 text-slate-500 dark:text-gray-400">No departments found</td></tr>
              ) : (
                filteredDepartments.map(dept => (
                  <tr
                    key={dept._id}
                    className="hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer"
                    onClick={() => handleRowClick(dept)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-white">{dept.name}</div>
                      {dept.description && <div className="text-xs text-slate-400 dark:text-gray-500">{dept.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      {dept.head ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">{dept.head?.username || 'Unknown'}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (company?.defaultWorkspace) {
                                navigate(`/workspace/${company.defaultWorkspace}/dm/new/${dept.head._id}`);
                              } else {
                                alert("No default workspace available to start chat.");
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                            title="Message Manager"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 italic text-xs font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-slate-400 dark:text-gray-500" /> {dept.members?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-400 dark:text-gray-500">{new Date(dept.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(dept); }}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(dept._id); }}
                        className="p-2 ml-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete Department"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        department={selectedDept}
        companyId={company?._id}
        onSuccess={fetchDepartments}
      />

      <DepartmentDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        department={viewDepartment}
        companyId={company?._id}
        onUpdate={() => { fetchDepartments(); setIsDetailsOpen(false); }}
      />
    </React.Fragment>
  );
};

export default DepartmentManagement;

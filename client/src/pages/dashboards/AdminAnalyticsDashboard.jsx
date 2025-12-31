import React, { useState, useEffect } from 'react';
import {
  Users, Briefcase, TrendingUp, Settings, Shield,
  UserPlus, Search, Bell, X, Plus, Pencil, ArrowRight,
  Building, LogOut, CheckCircle, LayoutDashboard, Globe,
  Filter, Trash2, ExternalLink, ChevronLeft, ChevronRight, Mail, Phone, MapPin, Calendar, Briefcase as WorkIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

// --- Sub-Components ---

const StatCard = ({ title, value, change, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300`} style={{ backgroundColor: `${color}15`, color: color }}>
        <Icon size={24} className="group-hover:scale-110 transition-transform" />
      </div>
      {change && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${change.includes('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {change}
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
  </div>
);

const DepartmentModal = ({ companyId, department, onClose, onSuccess }) => {
  const [name, setName] = useState(department?.name || '');
  const [description, setDescription] = useState(department?.description || '');
  const [head, setHead] = useState(department?.head?._id || department?.head || '');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch users for head selection
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.members || []);
      } catch (err) { console.error(err); }
    };
    fetchUsers();
  }, [companyId]);

  const handleSubmit = async () => {
    if (!name) return setError("Department name is required");
    setLoading(true);
    try {
      if (department) {
        // Update
        const token = localStorage.getItem('accessToken');
        await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/departments/${department._id}`, {
          name, description, head: head || null
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create
        const token = localStorage.getItem('accessToken');
        await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/departments`, {
          companyId, name, description, head: head || null
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save department');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fadeIn p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[85vh] flex flex-col animate-scaleIn">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">{department ? 'Edit Department' : 'New Department'}</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Department goals..." />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Head of Department</label>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              value={head} onChange={e => setHead(e.target.value)}>
              <option value="">-- No Head Assigned --</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.username} ({u.companyRole})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-slate-500 font-bold text-sm px-4 py-2 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Department'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DepartmentList = ({ companyId }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState(null);


  useEffect(() => {
    const fetchDepts = async () => {
      if (!companyId) return;
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/departments/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDepartments(res.data.departments || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDepts();
  }, [companyId, refreshKey]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading departments...</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fadeIn">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-800 text-lg">Active Departments</h3>
        <button
          onClick={() => { setEditingDept(null); setShowModal(true); }}
          className="text-indigo-600 text-sm font-bold hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          <Plus size={16} /> Add New
        </button>
      </div>

      {showModal && (
        <DepartmentModal
          companyId={companyId}
          department={editingDept}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); setRefreshKey(k => k + 1); }}
        />
      )}

      {showWizard && (
        <OnboardingWizard
          companyId={companyId}
          initialDeptId={selectedDeptId}
          onClose={() => { setShowWizard(false); setSelectedDeptId(null); }}
          onSuccess={() => { setShowWizard(false); setSelectedDeptId(null); setRefreshKey(k => k + 1); }}
        />
      )}

      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Name</th>
            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Head</th>
            <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase">Members</th>
            <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {departments.map(dept => (
            <tr key={dept._id || dept.id} className="hover:bg-slate-50/80 transition-colors group">
              <td className="py-4 px-6 font-bold text-slate-700">
                {dept.name}
                {dept.description && <p className="text-xs text-slate-400 font-normal truncate max-w-[200px]">{dept.description}</p>}
              </td>
              <td className="py-4 px-6 text-sm text-slate-600">
                {dept.head ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                      {(dept.head.username || dept.head).charAt(0)}
                    </div>
                    {dept.head.username || dept.head}
                  </div>
                ) : <span className="text-slate-400 italic">Unassigned</span>}
              </td>
              <td className="py-4 px-6 text-sm text-slate-600">{dept.members?.length || 0} Members</td>
              <td className="py-4 px-6 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setSelectedDeptId(dept._id); setShowWizard(true); }}
                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Add Member"
                  >
                    <UserPlus size={16} />
                  </button>
                  <button
                    onClick={() => { setEditingDept(dept); setShowModal(true); }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit Settings"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {departments.length === 0 && (
            <tr><td colSpan="4" className="text-center py-8 text-slate-400 italic">No departments found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const OnboardingWizard = ({ companyId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);

  // Form
  const [email, setEmail] = useState('');
  const [deptId, setDeptId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [role, setRole] = useState('member');

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [deptRes, usersRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/departments`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
          }),
          axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/members`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
          })
        ]);
        setDepartments(deptRes.data.departments || []);
        // Managers: anyone who is owner, admin, or manager role
        const potentialManagers = (usersRes.data.members || []).filter(u => ['owner', 'admin', 'manager'].includes(u.companyRole));
        setManagers(potentialManagers);
      } catch (err) {
        console.error("Failed to load onboarding data", err);
      }
    };
    loadData();
  }, [companyId]);

  const handleInvite = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/invite`, {
        email,
        role,
        departmentId: deptId || null,
        managerId: managerId || null
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });

      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invite');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-black text-xl text-slate-800">New Employee Onboarding</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-8">
          {error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">{error}</div>}

          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <label className="block text-sm font-bold text-slate-700">Employee Email</label>
              <input
                autoFocus
                type="email"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500"
                placeholder="new.employee@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-xs text-slate-400">They will receive an invitation link to join.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Assign Department</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500"
                  value={deptId}
                  onChange={e => setDeptId(e.target.value)}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reporting Manager</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500"
                  value={managerId}
                  onChange={e => setManagerId(e.target.value)}
                >
                  <option value="">-- No Direct Manager --</option>
                  {managers.map(m => (
                    <option key={m._id} value={m._id}>{m.username} ({m.companyRole})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <label className="block text-sm font-bold text-slate-700">System Role</label>
              <div className="grid grid-cols-1 gap-3">
                {['member', 'admin', 'owner'].map(r => (
                  <div
                    key={r}
                    onClick={() => setRole(r)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${role === r ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold capitalize text-slate-800">{r}</span>
                      {role === r && <CheckCircle size={18} className="text-indigo-600" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 flex justify-between items-center">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="text-slate-500 font-bold hover:text-slate-700">Back</button>
          ) : <div></div>}

          {step < 3 ? (
            <button
              disabled={!email}
              onClick={() => setStep(step + 1)}
              className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleInvite}
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-70 flex items-center gap-2"
            >
              {loading ? 'Sending...' : 'Send Invitation'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


const UserProfileDrawer = ({ user, onClose, companyId }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 overflow-y-auto border-l border-slate-200 animate-slideInRight">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 backdrop-blur-sm">
        <h3 className="font-bold text-slate-800 text-lg">Employee Profile</h3>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
      </div>

      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white shadow-lg">
            {user.username?.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{user.username}</h2>
          <p className="text-slate-500 text-sm font-medium">{user.email}</p>
          <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-indigo-50 text-indigo-600 border border-indigo-100">
            {user.companyRole}
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-slate-100 font-bold text-xs uppercase text-slate-400 tracking-wider">Personal Details</div>

          <div className="flex gap-3 items-start">
            <Mail size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-bold">Email</div>
              <div className="text-sm font-medium text-slate-700">{user.email}</div>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <WorkIcon size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-bold">Category</div>
              <div className="text-sm font-medium text-slate-700">{user.employeeCategory || 'Active Member'}</div>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <Calendar size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-bold">Joined</div>
              <div className="text-sm font-medium text-slate-700">
                {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Address - Phase 3 */}
          <div className="flex gap-3 items-start">
            <MapPin size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-bold">Address</div>
              <div className="text-sm font-medium text-slate-700 whitespace-pre-wrap">
                {user.address ? (
                  <>
                    {user.address.street && <div>{user.address.street}</div>}
                    {(user.address.city || user.address.state) && <div>{user.address.city}, {user.address.state} {user.address.zip}</div>}
                    {user.address.country && <div>{user.address.country}</div>}
                  </>
                ) : <span className="text-slate-400 italic">No address provided</span>}
              </div>
            </div>
          </div>

          {/* Resume - Phase 3 */}
          <div className="flex gap-3 items-start">
            <ExternalLink size={16} className="text-slate-400 mt-0.5" />
            <div>
              <div className="text-xs text-slate-400 font-bold">Documents</div>
              {user.resumeUrl ? (
                <a href={user.resumeUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:underline">View Resume</a>
              ) : <span className="text-sm text-slate-400 italic">No resume uploaded</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-slate-100 flex gap-3">
          <button className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
            Edit Profile
          </button>
          <button className="px-4 py-2 border border-red-100 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors">
            Disable
          </button>
        </div>
      </div>
    </div>
  );
};

const UserList = ({ companyId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  useEffect(() => {
    if (!companyId) return;
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.members || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [companyId]);

  // Filter Logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = (user.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.companyRole === filterRole;
    return matchesSearch && matchesRole;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading directory...</div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fadeIn relative">
      {/* Header & Controls */}
      <div className="p-6 border-b border-slate-100 space-y-4 bg-slate-50/30">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            Team Directory
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{users.length}</span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWizard(true)}
              className="bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2 transform hover:scale-105 active:scale-95"
            >
              <UserPlus size={18} /> Add Employee
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none font-medium text-slate-600"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="member">Members</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {showWizard && (
        <OnboardingWizard
          companyId={companyId}
          onClose={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); alert('Invitation sent successfully!'); }}
        />
      )}

      {selectedUser && (
        <UserProfileDrawer
          user={selectedUser}
          companyId={companyId}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Rich Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Employee</th>
              <th className="text-left py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="text-left py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Joined</th>
              <th className="text-right py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentUsers.map(user => (
              <tr key={user._id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => setSelectedUser(user)}>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border-2 border-white shadow-sm">
                      {(user.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{user.username}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${user.companyRole === 'owner' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                    user.companyRole === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                      user.companyRole === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                    {user.companyRole}
                  </span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500 font-medium">
                  {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr><td colSpan="4" className="text-center py-12 text-slate-400 italic">No team members found matching your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div className="text-xs text-slate-500 font-medium">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} employees
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-slate-600"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors text-slate-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Dashboard Component ---

const SupportHelpDesk = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setTickets(res.data.tickets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/support/tickets`, {
        subject, description, priority
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setShowNew(false);
      setSubject('');
      setDescription('');
      fetchTickets();
    } catch (err) {
      alert('Failed to create ticket');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tickets Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-800">Support Tickets</h3>
              <p className="text-sm text-slate-500">Direct line to Platform Administration</p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              <UserPlus size={18} /> New Ticket
            </button>
          </div>

          {showNew && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-xl mb-6">
              <h4 className="font-bold text-lg mb-4">Create New Ticket</h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500"
                  placeholder="Subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                />
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium outline-none focus:border-indigo-500 min-h-[100px]"
                  placeholder="Describe your issue..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
                <div className="flex justify-between items-center">
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-sm"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Submit</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {loading ? <div className="text-slate-400 text-center py-8">Loading tickets...</div> :
              tickets.length === 0 ? <div className="text-slate-400 text-center py-8 bg-white rounded-2xl border border-slate-100">No tickets found. Need help? Create one!</div> :
                tickets.map(ticket => (
                  <div key={ticket._id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800">{ticket.subject}</h4>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${ticket.status === 'open' ? 'bg-blue-50 text-blue-600' :
                        ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm mb-3 line-clamp-2">{ticket.description}</p>
                    <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                      <span className="uppercase tracking-wider">{ticket.priority}</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Legal / Docs Section */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Shield size={20} /> Legal Center
            </h3>
            <p className="text-slate-400 text-sm mb-6">Verified documents and agreements.</p>

            <div className="space-y-3">
              {['Company_Registration.pdf', 'Service_Agreement_v1.pdf', 'Terms_of_Use.pdf'].map((doc, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">PDF</div>
                  <div className="flex-1 truncate text-sm font-medium text-slate-200">{doc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
            <h4 className="font-bold text-indigo-900 mb-2">Need Live Support?</h4>
            <p className="text-indigo-700 text-sm mb-4">Our team is available 24/7 for critical issues.</p>
            <button className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
              Chat with Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const CompanySettings = ({ companyId }) => {
  const [formData, setFormData] = useState({
    name: '', phone: '', website: '',
    address: { street: '', city: '', state: '', zip: '', country: '' },
    socials: { linkedin: '', twitter: '' }
  });
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const c = res.data.company;
        setFormData({
          name: c.name || '',
          phone: c.settings?.phone || '',
          website: c.website || '',
          address: c.settings?.address || { street: '', city: '', state: '', zip: '', country: '' },
          socials: c.settings?.socialLinks || { linkedin: '', twitter: '' }
        });
      } catch (err) { console.error(err); }
    };
    fetchSettings();
  }, [companyId]);

  const handleChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/companies/${companyId}`, {
        name: formData.name,
        website: formData.website,
        settings: {
          phone: formData.phone,
          address: formData.address,
          socialLinks: formData.socials
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
          <Building size={20} className="text-indigo-500" /> Company Profile
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
            <input
              value={formData.name} onChange={e => handleChange(null, 'name', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
            <input
              value={formData.phone} onChange={e => handleChange(null, 'phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Website</label>
            <input
              value={formData.website} onChange={e => handleChange(null, 'website', e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-50">
          <h4 className="font-bold text-sm text-slate-700 mb-4">Address</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <input
                placeholder="Street Address"
                value={formData.address.street} onChange={e => handleChange('address', 'street', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
              />
            </div>
            <input
              placeholder="City"
              value={formData.address.city} onChange={e => handleChange('address', 'city', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
            <input
              placeholder="State / Province"
              value={formData.address.state} onChange={e => handleChange('address', 'state', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
            <input
              placeholder="ZIP / Postal Code"
              value={formData.address.zip} onChange={e => handleChange('address', 'zip', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
            <input
              placeholder="Country"
              value={formData.address.country} onChange={e => handleChange('address', 'country', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-50 flex justify-end">
          <button onClick={handleSave} disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const AdminAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch Stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/analytics/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data.stats);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'departments', label: 'Departments', icon: Briefcase },
    { id: 'people', label: 'People', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'support', label: 'Help & Support', icon: CheckCircle },
  ];

  // Show loading if company data not yet loaded
  if (!company) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-lg shadow-indigo-100/20">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Building size={18} />
            </div>
            <span className="font-black text-lg tracking-tight text-slate-800">Chttrix<span className="text-indigo-600">Admin</span></span>
          </div>
        </div>

        <div className="p-4 flex-1">
          <div className="space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm translate-x-1'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <item.icon size={20} className={activeTab === item.id ? 'stroke-2' : 'stroke-1.5'} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Workspace</p>
            <button
              onClick={() => navigate('/workspaces')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              <Globe size={18} /> Go to App
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
              {company?.name?.charAt(0) || 'C'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-slate-800">{company?.name || 'Company'}</p>
              <p className="text-xs text-slate-400 truncate">Admin Console</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none z-0"></div>

        {/* Topbar */}
        <header className="h-16 px-8 flex items-center justify-between z-10">
          <h2 className="text-xl font-black text-slate-800">
            {menuItems.find(i => i.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 shadow-sm"
              />
            </div>
            <button className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto w-full px-8 pb-8 z-10 custom-scrollbar">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loadingStats ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse"></div>)
                ) : (
                  stats.map((stat, idx) => (
                    <StatCard
                      key={idx}
                      title={stat.title}
                      value={stat.value}
                      change={stat.change}
                      icon={
                        stat.icon === 'Users' ? Users :
                          stat.icon === 'Briefcase' ? Briefcase :
                            stat.icon === 'Hash' ? Briefcase : TrendingUp
                      }
                      color={stat.color}
                    />
                  ))
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-800">Growth Analytics</h3>
                    <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold text-slate-600">
                      <option>Last 30 Days</option>
                      <option>This Year</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-center h-full text-slate-300 font-medium">
                    Chart Visualization Placeholder
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-xl shadow-indigo-200">
                    <h3 className="font-bold text-lg mb-2">Upgrade Plan</h3>
                    <p className="text-indigo-100 text-sm mb-6">Unlock advanced analytics and unlimited department creation.</p>
                    <button className="w-full py-2 bg-white text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors">
                      View Plans
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Security Status</h3>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-500">2FA Enabled</span>
                      <CheckCircle size={16} className="text-green-500" />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-500">SSO Configured</span>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Pro</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DEPARTMENTS TAB */}
          {activeTab === 'departments' && (
            <div className="max-w-5xl mx-auto">
              <DepartmentList companyId={company._id} />
            </div>
          )}

          {/* PEOPLE TAB */}
          {activeTab === 'people' && (
            <div className="max-w-5xl mx-auto">
              <UserList companyId={company?._id} />
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <CompanySettings companyId={company._id} />
          )}

          {/* SUPPORT TAB */}
          {activeTab === 'support' && (
            <SupportHelpDesk />
          )}

        </div>
      </main >

      <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(203, 213, 225, 0.5); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(148, 163, 184, 0.8); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
            `}</style>
    </div >
  );
};

export default AdminAnalyticsDashboard;

// server/src/features/company-org/org-chart.controller.js
// Builds a hierarchical org chart tree for a company.
// Structure: Company → Departments → Teams + Members
const Department = require('../../../models/Department');
const Team = require('../../models/Team');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const { handleError } = require('../../../utils/responseHelpers');
const AuditLog = require('../../../models/AuditLog');

/**
 * GET /api/companies/:id/org-chart
 * Returns the complete org tree for the company.
 */
exports.getOrgChart = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user?.sub;

    // Verify requester belongs to this company
    const dbUser = await User.findById(userId).select('companyId companyRole').lean();
    if (!dbUser || String(dbUser.companyId) !== String(companyId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Fetch company basic info
    const company = await Company.findById(companyId)
      .select('name logo industry')
      .lean();
    if (!company) return res.status(404).json({ message: 'Company not found' });

    // Fetch all active departments (with head + member counts)
    const departments = await Department.find({ company: companyId, isActive: true })
      .populate('head', 'username email profilePicture')
      .populate('managers', 'username email profilePicture')
      .lean();

    // Fetch all active teams indexed by department
    const teams = await Team.find({ company: companyId, isActive: true })
      .populate('lead', 'username email profilePicture')
      .populate('members.user', 'username email profilePicture')
      .lean();

    // Fetch all company users (for unassigned members)
    const allUsers = await User.find({
      companyId,
      accountStatus: { $in: ['active', 'invited'] }
    }).select('username email profilePicture companyRole departments').lean();

    // Build department → teams map
    const teamsByDept = {};
    teams.forEach(team => {
      const deptId = team.department ? team.department.toString() : '_none';
      if (!teamsByDept[deptId]) teamsByDept[deptId] = [];
      teamsByDept[deptId].push(team);
    });

    // Build department → member counts
    const deptNodes = departments.map(dept => ({
      id: dept._id,
      name: dept.name,
      description: dept.description,
      head: dept.head,
      managers: dept.managers || [],
      memberCount: (dept.members || []).length,
      teams: (teamsByDept[dept._id.toString()] || []).map(team => ({
        id: team._id,
        name: team.name,
        description: team.description,
        icon: team.icon,
        color: team.color,
        lead: team.lead,
        memberCount: (team.members || []).length,
        members: (team.members || []).map(m => ({
          id: m.user?._id,
          username: m.user?.username,
          email: m.user?.email,
          profilePicture: m.user?.profilePicture,
          role: m.role
        }))
      }))
    }));

    // Count users not assigned to any department
    const unassignedUsers = allUsers.filter(u => !u.departments || u.departments.length === 0);

    return res.json({
      company: {
        id: company._id,
        name: company.name,
        logo: company.logo,
        industry: company.industry
      },
      totalEmployees: allUsers.length,
      unassignedCount: unassignedUsers.length,
      departments: deptNodes
    });
  } catch (err) {
    return handleError(res, err, 'ORG CHART ERROR');
  }
};

/**
 * GET /api/companies/:id/employees
 * Paginated, searchable employee directory for a company.
 * Query: search, dept, role, status, page, limit
 */
exports.getEmployeeDirectory = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user?.sub;

    // Verify requester belongs to this company
    const dbUser = await User.findById(userId).select('companyId').lean();
    if (!dbUser || String(dbUser.companyId) !== String(companyId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      search = '',
      dept,
      role,
      status = 'active',
      page = 1,
      limit = 50
    } = req.query;

    const filter = { companyId, accountStatus: { $in: ['active', 'invited', 'pending'] } };
    if (status && status !== 'all') filter.accountStatus = status;
    if (role) filter.companyRole = role;

    // Department filter — look up users who are members of that dept
    if (dept) {
      const deptDoc = await Department.findById(dept).select('members').lean();
      if (deptDoc) filter._id = { $in: deptDoc.members };
    }

    // Full-text search on username / email / firstName / lastName
    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { firstName: regex },
        { lastName: regex }
      ];
    }

    const cap = Math.min(parseInt(limit), 200);
    const skip = (parseInt(page) - 1) * cap;

    const [employees, total] = await Promise.all([
      User.find(filter)
        .select('username email firstName lastName profilePicture companyRole accountStatus isOnline lastLoginAt departments phone')
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(cap)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Attach department names in a single query
    const deptIds = [...new Set(employees.flatMap(e => e.departments || []).map(String))];
    const depts = deptIds.length
      ? await Department.find({ _id: { $in: deptIds } }).select('name').lean()
      : [];
    const deptMap = Object.fromEntries(depts.map(d => [String(d._id), d.name]));

    const enriched = employees.map(e => ({
      ...e,
      departmentNames: (e.departments || []).map(id => deptMap[String(id)] || 'Unknown')
    }));

    return res.json({
      employees: enriched,
      pagination: { page: parseInt(page), limit: cap, total, pages: Math.ceil(total / cap) }
    });
  } catch (err) {
    return handleError(res, err, 'EMPLOYEE DIRECTORY ERROR');
  }
};

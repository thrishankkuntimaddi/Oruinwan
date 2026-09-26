const Department = require('../../../models/Department');
const Team = require('../../models/Team');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const { handleError } = require('../../../utils/responseHelpers');
const { recordAdminAction } = require('../../shared/adminAudit');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Nest employees under the person they report to. Anyone whose manager is
 *  missing (or outside the company) becomes a root. */
function buildReportingLines(users) {
  const nodes = new Map(users.map(u => [String(u._id), {
    id: u._id, username: u.username, email: u.email, profilePicture: u.profilePicture,
    companyRole: u.companyRole, reportsTo: u.reportsTo || null, reports: [],
  }]));
  const roots = [];
  for (const node of nodes.values()) {
    const manager = node.reportsTo && nodes.get(String(node.reportsTo));
    if (manager && manager !== node) manager.reports.push(node);
    else roots.push(node);
  }
  return roots;
}

exports.getOrgChart = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user?.sub;

    
    const dbUser = await User.findById(userId).select('companyId companyRole').lean();
    if (!dbUser || String(dbUser.companyId) !== String(companyId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    
    const company = await Company.findById(companyId)
      .select('name logo industry')
      .lean();
    if (!company) return res.status(404).json({ message: 'Company not found' });

    
    const departments = await Department.find({ company: companyId, isActive: true })
      .populate('head', 'username email profilePicture')
      .populate('managers', 'username email profilePicture')
      .lean();

    
    const teams = await Team.find({ company: companyId, isActive: true })
      .populate('lead', 'username email profilePicture')
      .populate('members.user', 'username email profilePicture')
      .lean();

    
    const allUsers = await User.find({
      companyId,
      accountStatus: { $in: ['active', 'invited'] }
    }).select('username email profilePicture companyRole departments reportsTo').lean();

    
    const teamsByDept = {};
    teams.forEach(team => {
      const deptId = team.department ? team.department.toString() : '_none';
      if (!teamsByDept[deptId]) teamsByDept[deptId] = [];
      teamsByDept[deptId].push(team);
    });

    
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
      departments: deptNodes,
      reportingLines: buildReportingLines(allUsers)
    });
  } catch (err) {
    return handleError(res, err, 'ORG CHART ERROR');
  }
};

exports.getEmployeeDirectory = async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.user?.sub;

    
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

    
    if (dept) {
      const deptDoc = await Department.findById(dept).select('members').lean();
      if (deptDoc) filter._id = { $in: deptDoc.members };
    }

    
    if (search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
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
        .select('username email firstName lastName profilePicture companyRole accountStatus isOnline lastLoginAt departments phone reportsTo')
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(cap)
        .lean(),
      User.countDocuments(filter)
    ]);

    
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

/**
 * PUT /api/companies/:id/employees/:userId/manager  { managerId | null }
 * Company admins set who an employee reports to. Both people must belong to the
 * company, and the change may not create a loop.
 */
exports.setManager = async (req, res) => {
  try {
    const companyId = req.params.id;
    if (!req.isPlatformAdmin && String(req.companyId) !== String(companyId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const employeeId = req.params.userId;
    const managerId = req.body?.managerId || null;

    const employee = await User.findOne({ _id: employeeId, companyId }).select('username reportsTo').lean();
    if (!employee) return res.status(404).json({ message: 'Employee not found in this company' });

    if (managerId) {
      if (String(managerId) === String(employeeId)) {
        return res.status(400).json({ message: 'An employee cannot report to themselves' });
      }
      const manager = await User.findOne({ _id: managerId, companyId }).select('_id').lean();
      if (!manager) return res.status(400).json({ message: 'Manager must be in the same company' });

      // Walk up from the new manager; reaching the employee means a loop.
      let cursor = String(managerId);
      for (let hops = 0; cursor && hops < 500; hops++) {
        if (cursor === String(employeeId)) {
          return res.status(400).json({ message: 'That would create a reporting loop' });
        }
        const next = await User.findById(cursor).select('reportsTo').lean();
        cursor = next?.reportsTo ? String(next.reportsTo) : null;
      }
    }

    await User.updateOne({ _id: employeeId }, { $set: { reportsTo: managerId } });
    await recordAdminAction({
      userId: req.user.sub, companyId, action: 'org.reporting_line_changed', category: 'org',
      resourceType: 'User', resourceId: employeeId, resourceName: employee.username,
      details: { previousManager: employee.reportsTo || null, managerId }, req,
    });
    return res.json({ success: true, userId: employeeId, reportsTo: managerId });
  } catch (err) {
    return handleError(res, err, 'SET MANAGER ERROR');
  }
};

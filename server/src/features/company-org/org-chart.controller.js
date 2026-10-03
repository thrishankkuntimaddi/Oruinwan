const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');
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

    
    const dbUser = await identity.users.findById(userId);
    if (!dbUser || String(dbUser.companyId) !== String(companyId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const company = await org.companies.findOne({ _id: companyId }, { admins: false });
    if (!company) return res.status(404).json({ message: 'Company not found' });

    const USER = { type: 'user', fields: ['username', 'email', 'profilePicture'] };
    const departments = await org.departments.find({ company: companyId, isActive: true });
    const teams = await identity.teams.listForCompany(companyId);
    await hydrate(departments, { head: USER, managers: USER });
    await hydrate(teams, { lead: USER, 'members.user': USER });

    const allUsers = await org.users.find(
      { companyId, accountStatus: { $in: ['active', 'invited'] } },
      { org: true, select: 'username email profilePicture companyRole departments reportsTo' }
    );

    
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
        industry: company.metadata?.profile?.industry
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

    
    const dbUser = await identity.users.findById(userId);
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

    
    if (dept) filter.departments = String(dept);

    if (search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { username: regex },
        { email: regex },
        { 'profile.name': regex }
      ];
    }

    const cap = Math.min(parseInt(limit), 200);
    const skip = (parseInt(page) - 1) * cap;

    const [employees, total] = await Promise.all([
      org.users.find(filter, {
        org: true,
        select: 'username email profile profilePicture companyRole accountStatus isOnline lastLoginAt departments phone reportsTo',
        sort: { username: 1 },
        skip,
        limit: cap,
      }),
      org.users.count(filter)
    ]);

    const deptIds = [...new Set(employees.flatMap(e => e.departments || []).map(String))];
    const depts = deptIds.length
      ? await org.departments.find({ _id: { $in: deptIds } }, { members: false })
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

    const employee = await org.users.findOne({ _id: employeeId, companyId });
    if (!employee) return res.status(404).json({ message: 'Employee not found in this company' });

    if (managerId) {
      if (String(managerId) === String(employeeId)) {
        return res.status(400).json({ message: 'An employee cannot report to themselves' });
      }
      const manager = await org.users.findOne({ _id: managerId, companyId });
      if (!manager) return res.status(400).json({ message: 'Manager must be in the same company' });

      // Walk up from the new manager (recursive query); reaching the employee means a loop.
      if (await org.wouldCreateReportingLoop(employeeId, managerId)) {
        return res.status(400).json({ message: 'That would create a reporting loop' });
      }
    }

    await identity.users.update(employeeId, { reportsTo: managerId ? String(managerId) : null });
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

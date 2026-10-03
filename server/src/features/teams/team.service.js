const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { hydrate, DEPARTMENT_MIN } = require('../../identity/hydrate');

const USER_BASIC = { type: 'user', fields: ['username', 'email', 'profilePicture'] };
const USER_ROLE = { type: 'user', fields: ['username', 'email', 'profilePicture', 'companyRole'] };
const DEPT_NAME = { ...DEPARTMENT_MIN, fields: ['name'] };

const same = (a, b) => a != null && b != null && String(a) === String(b);

function notFound() {
  return Object.assign(new Error('Team not found.'), { status: 404 });
}

/** The team if it belongs to the company (and is active when asked). */
async function teamInCompany(teamId, companyId, { activeOnly = true } = {}) {
  const team = await identity.teams.findById(teamId);
  if (!team || !same(team.company, companyId) || (activeOnly && !team.isActive)) return null;
  return team;
}

async function present(team, memberSelector = USER_BASIC, { department = true } = {}) {
  await hydrate(team, { lead: USER_BASIC, 'members.user': memberSelector, ...(department ? { department: DEPT_NAME } : {}) });
  return team;
}

async function getTeams(companyId, departmentId) {
  let teams = await identity.teams.listForCompany(companyId);
  if (departmentId) teams = teams.filter((t) => same(t.department, departmentId));
  return present(teams);
}

async function getTeamById(teamId, companyId) {
  const team = await teamInCompany(teamId, companyId);
  if (!team) throw notFound();
  return present(team, USER_ROLE);
}

/** Department and lead must be in this company (null clears them). Throws 400. */
async function assertTeamRefs(companyId, { department, lead }) {
  const mongoose = require('mongoose');
  const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
  if (department) {
    if (!mongoose.Types.ObjectId.isValid(String(department))) throw bad('Invalid department id.');
    const dept = await org.departments.findOne({ _id: department, company: companyId, isActive: true }, { members: false });
    if (!dept) throw bad('Department not found or does not belong to this company.');
  }
  if (lead) {
    if (!mongoose.Types.ObjectId.isValid(String(lead))) throw bad('Invalid lead id.');
    const u = await org.users.findOne({ _id: lead, companyId });
    if (!u) throw bad('Team lead must be a member of this company.');
  }
}

async function createTeam({ companyId, name, description, icon, color, departmentId, leadId, creatorId }) {
  const wanted = name.trim().toLowerCase();
  const existing = (await identity.teams.listForCompany(companyId)).find((t) => t.name.toLowerCase() === wanted);
  if (existing) {
    const err = new Error(`A team named "${name}" already exists.`);
    err.status = 409;
    throw err;
  }

  if (departmentId) {
    const dept = await org.departments.findOne({ _id: departmentId, company: companyId, isActive: true }, { members: false });
    if (!dept) {
      const err = new Error('Department not found or does not belong to this company.');
      err.status = 404;
      throw err;
    }
  }

  await assertTeamRefs(companyId, { lead: leadId });

  const initialMembers = [];
  if (leadId) initialMembers.push({ user: leadId, role: 'lead' });
  if (creatorId && String(creatorId) !== String(leadId)) initialMembers.push({ user: creatorId, role: 'member' });

  const team = await identity.teams.create({
    company: String(companyId),
    name: name.trim(),
    description: description || '',
    icon: icon || '👥',
    color: color || '#6366f1',
    department: departmentId ? String(departmentId) : null,
    lead: leadId ? String(leadId) : null,
    members: initialMembers,
    isActive: true,
  });

  return present(team, USER_BASIC, { department: false });
}

async function updateTeam(teamId, companyId, updates) {
  const allowed = ['name', 'description', 'icon', 'color', 'department', 'lead'];
  const sanitized = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  if (Object.keys(sanitized).length === 0) {
    const err = new Error('No valid fields to update.');
    err.status = 400;
    throw err;
  }

  await assertTeamRefs(companyId, { department: sanitized.department, lead: sanitized.lead });

  if (!(await teamInCompany(teamId, companyId, { activeOnly: false }))) throw notFound();
  for (const k of ['department', 'lead']) if (sanitized[k] !== undefined) sanitized[k] = sanitized[k] ? String(sanitized[k]) : null;
  const team = await identity.teams.update(teamId, sanitized);
  return present(team, USER_BASIC, { department: false });
}

async function deleteTeam(teamId, companyId) {
  if (!(await teamInCompany(teamId, companyId, { activeOnly: false }))) throw notFound();
  await identity.teams.update(teamId, { isActive: false });
  return { deleted: true, teamId };
}

async function assignMembers(teamId, companyId, userIds, action) {
  const team = await teamInCompany(teamId, companyId);
  if (!team) throw notFound();

  const count = await org.users.count({ _id: { $in: userIds }, companyId });
  if (count !== new Set(userIds.map(String)).size) {
    const err = new Error('One or more users not found or do not belong to this company.');
    err.status = 400;
    throw err;
  }

  const existing = new Set(team.members.map((m) => String(m.user)));
  if (action === 'add') {
    for (const uid of userIds) if (!existing.has(String(uid))) await identity.teams.setMember(teamId, uid, 'member');
  } else {
    for (const uid of userIds) if (existing.has(String(uid))) await identity.teams.removeMember(teamId, uid);
  }

  const out = await identity.teams.findById(teamId);
  await hydrate(out, { 'members.user': USER_ROLE });
  return out;
}

module.exports = { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, assignMembers };

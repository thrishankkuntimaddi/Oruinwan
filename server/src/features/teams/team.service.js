const Team = require('../../models/Team');
const User = require('../../../models/User');
const Department = require('../../../models/Department');

async function getTeams(companyId, departmentId) {
  const query = { company: companyId, isActive: true };
  if (departmentId) query.department = departmentId;

  return Team.find(query)
    .populate('lead', 'username email profilePicture')
    .populate('members.user', 'username email profilePicture')
    .populate('department', 'name')
    .sort({ name: 1 })
    .lean();
}

async function getTeamById(teamId, companyId) {
  const team = await Team.findOne({ _id: teamId, company: companyId, isActive: true })
    .populate('lead', 'username email profilePicture')
    .populate('members.user', 'username email profilePicture companyRole')
    .populate('department', 'name')
    .lean();

  if (!team) {
    const err = new Error('Team not found.');
    err.status = 404;
    throw err;
  }
  return team;
}

async function createTeam({ companyId, name, description, icon, color, departmentId, leadId, creatorId }) {
  
  const existing = await Team.findOne({
    company: companyId,
    name: new RegExp(`^${name.trim()}$`, 'i'),
    isActive: true
  });
  if (existing) {
    const err = new Error(`A team named "${name}" already exists.`);
    err.status = 409;
    throw err;
  }

  
  if (departmentId) {
    const dept = await Department.findOne({ _id: departmentId, company: companyId, isActive: true });
    if (!dept) {
      const err = new Error('Department not found or does not belong to this company.');
      err.status = 404;
      throw err;
    }
  }

  const initialMembers = [];
  if (leadId) {
    initialMembers.push({ user: leadId, role: 'lead', joinedAt: new Date() });
  }
  if (creatorId && String(creatorId) !== String(leadId)) {
    initialMembers.push({ user: creatorId, role: 'member', joinedAt: new Date() });
  }

  const team = await Team.create({
    company: companyId,
    name: name.trim(),
    description: description || '',
    icon: icon || '👥',
    color: color || '#6366f1',
    department: departmentId || null,
    lead: leadId || null,
    members: initialMembers,
    isActive: true
  });

  return Team.findById(team._id)
    .populate('lead', 'username email profilePicture')
    .populate('members.user', 'username email profilePicture')
    .lean();
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

  const team = await Team.findOneAndUpdate(
    { _id: teamId, company: companyId },
    { $set: sanitized },
    { new: true, runValidators: true }
  )
    .populate('lead', 'username email profilePicture')
    .populate('members.user', 'username email profilePicture')
    .lean();

  if (!team) {
    const err = new Error('Team not found.');
    err.status = 404;
    throw err;
  }
  return team;
}

async function deleteTeam(teamId, companyId) {
  const team = await Team.findOne({ _id: teamId, company: companyId });
  if (!team) {
    const err = new Error('Team not found.');
    err.status = 404;
    throw err;
  }
  team.isActive = false;
  await team.save();
  return { deleted: true, teamId };
}

async function assignMembers(teamId, companyId, userIds, action) {
  const team = await Team.findOne({ _id: teamId, company: companyId, isActive: true });
  if (!team) {
    const err = new Error('Team not found.');
    err.status = 404;
    throw err;
  }

  
  const users = await User.find({ _id: { $in: userIds }, companyId }).select('_id').lean();
  if (users.length !== userIds.length) {
    const err = new Error('One or more users not found or do not belong to this company.');
    err.status = 400;
    throw err;
  }

  const now = new Date();

  if (action === 'add') {
    const existingIds = team.members.map(m => m.user.toString());
    const toAdd = userIds.filter(id => !existingIds.includes(id.toString()));
    for (const uid of toAdd) {
      team.members.push({ user: uid, role: 'member', joinedAt: now });
    }
    await team.save();
  } else {
    team.members = team.members.filter(m => !userIds.includes(m.user.toString()));
    await team.save();
  }

  return Team.findById(teamId)
    .populate('members.user', 'username email profilePicture companyRole')
    .lean();
}

module.exports = { getTeams, getTeamById, createTeam, updateTeam, deleteTeam, assignMembers };

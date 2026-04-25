const teamService = require('./team.service');

function handleErr(res, err) {
  const status = err.status || 500;
  console.error('[TEAM CTRL]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

exports.getTeams = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { departmentId } = req.query;
    const teams = await teamService.getTeams(companyId, departmentId);
    return res.json({ teams });
  } catch (err) { return handleErr(res, err); }
};

exports.getTeamById = async (req, res) => {
  try {
    const companyId = req.companyId;
    const team = await teamService.getTeamById(req.params.id, companyId);
    return res.json({ team });
  } catch (err) { return handleErr(res, err); }
};

exports.createTeam = async (req, res) => {
  try {
    const companyId = req.companyId;
    const creatorId = req.user?.sub;
    const { name, description, icon, color, departmentId, leadId } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name is required' });
    const team = await teamService.createTeam({ companyId, name, description, icon, color, departmentId, leadId, creatorId });
    return res.status(201).json({ message: 'Team created', team });
  } catch (err) { return handleErr(res, err); }
};

exports.updateTeam = async (req, res) => {
  try {
    const companyId = req.companyId;
    const team = await teamService.updateTeam(req.params.id, companyId, req.body);
    return res.json({ message: 'Team updated', team });
  } catch (err) { return handleErr(res, err); }
};

exports.deleteTeam = async (req, res) => {
  try {
    const companyId = req.companyId;
    const result = await teamService.deleteTeam(req.params.id, companyId);
    return res.json({ message: 'Team deleted', ...result });
  } catch (err) { return handleErr(res, err); }
};

exports.assignMembers = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { userIds, action } = req.body;
    if (!Array.isArray(userIds) || !userIds.length) return res.status(400).json({ error: 'userIds array is required' });
    if (!['add', 'remove'].includes(action)) return res.status(400).json({ error: 'action must be "add" or "remove"' });
    const team = await teamService.assignMembers(req.params.id, companyId, userIds, action);
    return res.json({ message: `Members ${action}ed`, team });
  } catch (err) { return handleErr(res, err); }
};

const express = require('express');
const router = express.Router();
const ctrl = require('./team.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const memberGate = [requireAuth, requireCompanyMember];
const adminGate  = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

router.get('/',     ...memberGate, ctrl.getTeams);
router.get('/:id',  ...memberGate, ctrl.getTeamById);

router.post('/',                  ...adminGate, ctrl.createTeam);
router.patch('/:id',              ...adminGate, ctrl.updateTeam);
router.delete('/:id',             ...adminGate, ctrl.deleteTeam);
router.patch('/:id/members',      ...adminGate, ctrl.assignMembers);

module.exports = router;

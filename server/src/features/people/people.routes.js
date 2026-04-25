const express = require('express');
const router = express.Router();

const ctrl = require('./people.controller');
const validation = require('./people.validation');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const requireMinMember = (req, res, next) => {
    if (req.companyRole === 'guest') {
        return res.status(403).json({
            success: false,
            error: 'Guests are not permitted to view company member lists.',
            code: 'GUEST_RESTRICTED',
        });
    }
    return next();
};

router.post(
    '/invite',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.inviteEmployee,
    ctrl.inviteEmployee
);

router.get(
    '/members',
    requireAuth,
    requireCompanyMember,
    requireMinMember,
    validation.listMembers,
    ctrl.listMembers
);

router.get(
    '/members/:id',
    requireAuth,
    requireCompanyMember,
    requireMinMember,
    ctrl.getMember
);

router.patch(
    '/members/:id/role',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.changeRole,
    ctrl.changeRole
);

router.patch(
    '/members/:id/status',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    validation.updateStatus,
    ctrl.updateStatus
);

module.exports = router;

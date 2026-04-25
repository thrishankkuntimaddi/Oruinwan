const express = require('express');
const router = express.Router();

const ctrl = require('./updates.controller');
const validation = require('./updates.validation');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

router.get(
    '/updates',
    requireAuth,
    requireCompanyMember,
    validation.getUpdates,
    ctrl.getUpdates
);

router.post(
    '/updates',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('manager'),
    validation.postUpdate,
    ctrl.postUpdate
);

router.delete(
    '/updates/:id',
    requireAuth,
    requireCompanyMember,
    ctrl.deleteUpdate
);

router.post(
    '/updates/:id/react',
    requireAuth,
    requireCompanyMember,
    validation.addReaction,
    ctrl.addReaction
);

router.post(
    '/updates/:id/read',
    requireAuth,
    requireCompanyMember,
    ctrl.markAsRead
);

module.exports = router;

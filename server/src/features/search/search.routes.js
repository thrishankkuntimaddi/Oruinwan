'use strict';

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const searchCtrl  = require('./search.controller');
const { requireWorkspaceAccess } = require('../../shared/utils/workspaceAccess');

// Every search is scoped to a workspace the caller is an active member of.
const member = requireWorkspaceAccess({ from: (req) => req.query?.workspaceId });

router.get('/', requireAuth, member, searchCtrl.search);

router.get('/universal', requireAuth, member, searchCtrl.universalSearch);

router.get('/contacts', requireAuth, member, searchCtrl.searchContactsHandler);

module.exports = router;

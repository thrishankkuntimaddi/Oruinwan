'use strict';

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const searchCtrl  = require('./search.controller');

router.get('/', requireAuth, searchCtrl.search);

router.get('/universal', requireAuth, searchCtrl.universalSearch);

router.get('/contacts', requireAuth, searchCtrl.searchContactsHandler);

module.exports = router;

// server/src/features/search/search.routes.js
'use strict';

const express     = require('express');
const router      = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const searchCtrl  = require('./search.controller');

// ── v2 Unified Search ─────────────────────────────────────────────────────────
// GET /api/search?q=&workspaceId=&type=&from=&to=&channelId=&tags=&limit=&offset=&semantic=
router.get('/', requireAuth, searchCtrl.search);

// ── Legacy endpoints (backward compat) ───────────────────────────────────────
// GET /api/search/universal?workspaceId=&query=
router.get('/universal', requireAuth, searchCtrl.universalSearch);

// GET /api/search/contacts?workspaceId=&query=
router.get('/contacts', requireAuth, searchCtrl.searchContactsHandler);

module.exports = router;

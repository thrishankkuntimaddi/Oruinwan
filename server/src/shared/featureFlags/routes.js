'use strict';

const express = require('express');
const { getFlags } = require('./index');

const router = express.Router();

// Public on purpose: flags only say which screens exist, and the login and
// marketing pages need them before a user has a token.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, flags: getFlags() });
});

module.exports = router;

// server/routes/auth.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');

router.post('/signup', ctrl.signup);
router.get('/verify-email', ctrl.verifyEmail);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh); // path matches cookie path
router.post('/logout', ctrl.logout);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);

module.exports = router;

const express = require('express');
const multer = require('multer');
const router = express.Router();

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole } = require('../../shared/utils/companyRole');

const ctrl = require('./onboarding.controller');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname) ||
            [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
                'text/csv',
                'application/csv',
            ].includes(file.mimetype);
        cb(ok ? null : new Error('Only .xlsx, .xls, and .csv files are accepted.'), ok);
    },
});

const gate = [requireAuth, requireCompanyMember, requireCompanyRole('admin')];

router.post('/individual', ...gate, ctrl.validateIndividual, ctrl.inviteIndividual);

router.post('/bulk', ...gate, upload.single('employeeFile'), ctrl.bulkImport);

router.get('/status/:jobId', ...gate, ctrl.getJobStatus);

router.post('/resend/:userId', ...gate, ctrl.resendInviteEmail);

router.get('/template', ...gate, (req, res) => {
    return res.redirect(`/api/companies/${req.companyId}/setup/template`);
});

router.post('/accept', ctrl.validateAcceptInvite, ctrl.acceptInviteHandler);

module.exports = router;

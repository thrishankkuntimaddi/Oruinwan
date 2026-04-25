const { validationResult } = require('express-validator');
const peopleService = require('./people.service');

function validationGuard(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
        });
    }
    return null;
}

function handleError(res, err) {
    const status = err.status || 500;
    console.error('[PEOPLE CONTROLLER]', err.message);
    return res.status(status).json({ success: false, error: err.message || 'Server error' });
}

exports.inviteEmployee = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const { email, firstName, lastName, companyRole, jobTitle, departments } = req.body;
        const invitedById = req.user.sub || req.user._id;

        const member = await peopleService.inviteEmployee({
            companyId: req.companyId,
            email,
            firstName,
            lastName,
            companyRole,
            jobTitle,
            departments,
            invitedById,
        });

        return res.status(201).json({ success: true, member });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.listMembers = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const { status, role, search } = req.query;
        const members = await peopleService.listMembers(req.companyId, {
            callerRole: req.companyRole,
            status,
            role,
            search,
        });
        return res.json({ success: true, members, total: members.length });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.getMember = async (req, res) => {
    try {
        const member = await peopleService.getMember(req.params.id, req.companyId);
        return res.json({ success: true, member });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.changeRole = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const requesterId = req.user.sub || req.user._id;
        const requesterRole = req.companyRole;
        const { newRole, managedDepartments } = req.body;

        const member = await peopleService.changeRole({
            companyId: req.companyId,
            targetId: req.params.id,
            newRole,
            managedDepartments,
            requesterId,
            requesterRole,
        });

        return res.json({ success: true, member });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.updateStatus = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const requesterId = req.user.sub || req.user._id;
        const requesterRole = req.companyRole;
        const { status, reason } = req.body;

        const member = await peopleService.updateStatus({
            companyId: req.companyId,
            targetId: req.params.id,
            newStatus: status,
            reason,
            requesterId,
            requesterRole,
        });

        return res.json({ success: true, member });
    } catch (err) {
        return handleError(res, err);
    }
};

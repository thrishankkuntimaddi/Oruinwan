const { validationResult } = require('express-validator');
const deptService = require('./department.service');

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
    const message = err.message || 'Server error';
    console.error('[DEPT CONTROLLER]', message);
    return res.status(status).json({ success: false, error: message });
}

exports.getDepartments = async (req, res) => {
    try {
        const departments = await deptService.getDepartments(req.companyId);
        return res.json({ success: true, departments });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.getDepartmentById = async (req, res) => {
    try {
        const dept = await deptService.getDepartmentById(req.params.id, req.companyId);
        return res.json({ success: true, department: dept });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.createDepartment = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const { name, description, head, parentDepartment } = req.body;
        const creatorId = req.user.sub || req.user._id;

        const dept = await deptService.createDepartment({
            companyId: req.companyId,
            name,
            description,
            head,
            parentDepartment,
            creatorId,
        });

        return res.status(201).json({ success: true, department: dept });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.updateDepartment = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const dept = await deptService.updateDepartment(req.params.id, req.companyId, req.body);
        return res.json({ success: true, department: dept });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const result = await deptService.deleteDepartment(req.params.id, req.companyId);
        return res.json({ success: true, ...result });
    } catch (err) {
        return handleError(res, err);
    }
};

exports.assignMembers = async (req, res) => {
    if (validationGuard(req, res)) return;

    try {
        const { userIds, action } = req.body;
        const dept = await deptService.assignMembers(req.params.id, req.companyId, userIds, action);
        return res.json({ success: true, department: dept });
    } catch (err) {
        return handleError(res, err);
    }
};

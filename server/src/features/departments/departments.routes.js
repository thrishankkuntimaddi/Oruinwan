const express = require('express');
const router = express.Router();
const deptController = require('./department.controller');
const deptValidation = require('./department.validation');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const { requireCompanyRole, checkCompanyRole } = require('../../shared/utils/companyRole');

const canManageDepartment = (req, res, next) => {
    const role = req.companyRole;
    const departmentId = req.params.id;

    
    if (checkCompanyRole(role, 'admin')) {
        return next();
    }

    
    if (role === 'manager') {
        const dbUser = req.user._dbUser;
        const managedIds = (dbUser?.managedDepartments || []).map(id => id.toString());

        if (managedIds.includes(departmentId)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'You do not manage this department.',
            code: 'NOT_DEPARTMENT_MANAGER',
        });
    }

    
    return res.status(403).json({
        success: false,
        error: 'Managing department members requires manager access or higher.',
        code: 'INSUFFICIENT_ROLE',
    });
};

router.get(
    '/',
    requireAuth,
    requireCompanyMember,
    deptController.getDepartments
);

router.get(
    '/:id',
    requireAuth,
    requireCompanyMember,
    deptController.getDepartmentById
);

router.post(
    '/',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptValidation.createDepartment,
    deptController.createDepartment
);

router.patch(
    '/:id',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptValidation.updateDepartment,
    deptController.updateDepartment
);

router.delete(
    '/:id',
    requireAuth,
    requireCompanyMember,
    requireCompanyRole('admin'),
    deptController.deleteDepartment
);

router.patch(
    '/:id/members',
    requireAuth,
    requireCompanyMember,
    canManageDepartment,
    deptValidation.assignMembers,
    deptController.assignMembers
);

module.exports = router;

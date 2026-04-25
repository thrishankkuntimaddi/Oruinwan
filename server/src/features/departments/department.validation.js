const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const validObjectId = (field, location = body) =>
    location(field)
        .optional({ nullable: true })
        .custom(isObjectId)
        .withMessage(`${field} must be a valid ID`);

const validObjectIdArray = (field) =>
    body(field)
        .isArray({ min: 1 })
        .withMessage(`${field} must be a non-empty array`)
        .custom((ids) => ids.every(isObjectId))
        .withMessage(`All entries in ${field} must be valid IDs`);

const createDepartment = [
    body('name')
        .trim()
        .notEmpty().withMessage('name is required')
        .isLength({ min: 1, max: 100 }).withMessage('name must be 1–100 characters'),

    body('description')
        .optional()
        .isString()
        .isLength({ max: 500 }).withMessage('description must be at most 500 characters'),

    validObjectId('head'),
    validObjectId('parentDepartment'),
];

const updateDepartment = [
    param('id').custom(isObjectId).withMessage('id must be a valid department ID'),

    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('name must be 1–100 characters'),

    body('description')
        .optional()
        .isString()
        .isLength({ max: 500 }).withMessage('description must be at most 500 characters'),

    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean'),

    validObjectId('head'),
    validObjectId('parentDepartment'),

    
    body().custom((_, { req }) => {
        const allowed = ['name', 'description', 'head', 'parentDepartment', 'isActive', 'managers'];
        const hasAtLeastOne = allowed.some(f => req.body[f] !== undefined);
        if (!hasAtLeastOne) throw new Error('At least one field must be provided to update');
        return true;
    }),
];

const assignMembers = [
    param('id').custom(isObjectId).withMessage('id must be a valid department ID'),

    validObjectIdArray('userIds'),

    body('action')
        .isIn(['add', 'remove'])
        .withMessage("action must be 'add' or 'remove'"),
];

module.exports = {
    createDepartment,
    updateDepartment,
    assignMembers,
};

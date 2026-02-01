/**
 * Company Service - Business Logic Layer
 * 
 * Handles company CRUD operations, member management, and metrics.
 * Extracted from companyController.js to separate business logic from HTTP handling.
 * 
 * @module features/company/company.service
 */

const Company = require('../../models/Company');
const User = require('../../models/User');
const Workspace = require('../../models/Workspace');
const Department = require('../../models/Department');
const { logAction } = require('../../utils/historyLogger');

/**
 * Get company by ID with populated relationships
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Company document
 */
async function getCompanyById(companyId) {
    const company = await Company.findById(companyId)
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name')
        .populate({
            path: 'departments',
            select: 'name head memberCount',
            populate: {
                path: 'head',
                select: 'username email'
            }
        });

    return company;
}

/**
 * Check if user has access to company
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<{hasAccess: boolean, user: Object}>}
 */
async function checkUserAccess(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { hasAccess: false, user: null };
    }

    // User doesn't belong to any company or belongs to this company
    const hasAccess = !user.companyId || user.companyId.toString() === companyId;

    return { hasAccess, user };
}

/**
 * Check if user is admin (owner or admin role)
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Promise<{isAdmin: boolean, user: Object}>}
 */
async function checkIsAdmin(userId, companyId) {
    const user = await User.findById(userId);

    if (!user) {
        return { isAdmin: false, user: null };
    }

    const isAdmin = user.companyId &&
        user.companyId.toString() === companyId &&
        (user.companyRole === 'owner' || user.companyRole === 'admin');

    return { isAdmin, user };
}

/**
 * Update company with validation
 * @param {string} companyId - Company ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated company document
 */
async function updateCompany(companyId, updates) {
    const company = await Company.findByIdAndUpdate(
        companyId,
        { $set: updates },
        { new: true, runValidators: true }
    )
        .populate('admins.user', 'username email profilePicture')
        .populate('defaultWorkspace', 'name');

    return company;
}

/**
 * Get all members of a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} List of company members
 */
async function getCompanyMembers(companyId) {
    const members = await User.find({ companyId })
        .select('username email profilePicture companyRole createdAt lastLoginAt isOnline departments workspaces')
        .populate('departments', 'name')
        .populate('workspaces.workspace', 'name')
        .lean();

    return members;
}

/**
 * Get company metrics (user counts, workspace counts, etc.)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Metrics object
 */
async function getCompanyMetrics(companyId) {
    // Parallel fetch for speed
    const [totalUsers, activeUsers, totalWorkspaces, totalDepartments] = await Promise.all([
        User.countDocuments({ companyId }),
        User.countDocuments({ companyId, isOnline: true }),
        Workspace.countDocuments({ company: companyId }),
        Department.countDocuments({ company: companyId })
    ]);

    return {
        totalUsers,
        activeUsers,
        totalWorkspaces,
        totalDepartments
    };
}

/**
 * Update user role in company
 * @param {Object} params - Update parameters
 * @param {string} params.companyId - Company ID
 * @param {string} params.targetUserId - User whose role is being changed
 * @param {string} params.requesterId - User requesting the change
 * @param {string} params.newRole - New role to assign
 * @param {Object} params.req - Express request object (for logging)
 * @returns {Promise<Object>} Updated user info
 */
async function updateMemberRole({ companyId, targetUserId, requesterId, newRole, req }) {
    const validRoles = ['owner', 'admin', 'manager', 'member', 'guest'];

    if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role');
    }

    // Get company
    const company = await Company.findById(companyId);
    if (!company) {
        throw new Error('Company not found');
    }

    // Check if requester is admin
    if (!company.isAdmin(requesterId)) {
        throw new Error('Only company admins can change roles');
    }

    // Get requester and target user
    const requester = await User.findById(requesterId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
        throw new Error('User not found');
    }

    if (targetUser.companyId.toString() !== companyId) {
        throw new Error('User does not belong to this company');
    }

    // Prevent non-owners from assigning owner role
    if (newRole === 'owner' && requester.companyRole !== 'owner') {
        throw new Error('Only owners can assign owner role');
    }

    // Store old role for logging
    const oldRole = targetUser.companyRole;

    // Update role
    targetUser.companyRole = newRole;
    await targetUser.save();

    // Update company admins array if needed
    if (newRole === 'owner' || newRole === 'admin') {
        const existingAdmin = company.admins.find(
            a => a.user.toString() === targetUserId
        );
        if (!existingAdmin) {
            company.admins.push({ user: targetUserId, role: newRole });
            await company.save();
        }
    } else {
        // Remove from admins if downgraded
        company.admins = company.admins.filter(
            a => a.user.toString() !== targetUserId
        );
        await company.save();
    }

    // Log role change
    await logAction({
        userId: requesterId,
        action: 'user_role_changed',
        description: `Changed ${targetUser.username}'s role to ${newRole}`,
        resourceType: 'user',
        resourceId: targetUserId,
        companyId,
        metadata: { oldRole, newRole },
        req
    });

    return {
        id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        companyRole: targetUser.companyRole
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    getCompanyById,
    checkUserAccess,
    checkIsAdmin,
    updateCompany,
    getCompanyMembers,
    getCompanyMetrics,
    updateMemberRole
};

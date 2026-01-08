// server/utils/memberHelpers.js

/**
 * Member validation and extraction utilities to handle flexible member formats
 * Handles both old format (direct ObjectId) and new format ({ user: ObjectId, joinedAt: Date })
 */

/**
 * Extract member ID from flexible format
 * @param {Object|String} member - Member object or ID string
 * @returns {String} Member ID as string
 */
exports.extractMemberId = (member) => {
    if (!member) return null;

    // New format: { user: ObjectId, joinedAt: Date }
    if (member.user) {
        // Handle populated user object
        return member.user._id ? member.user._id.toString() : member.user.toString();
    }

    // Old format: direct ObjectId
    return member.toString();
};

/**
 * Check if user is a member of the collection
 * @param {Array} members - Array of members
 * @param {String} userId - User ID to check
 * @returns {Boolean} True if user is a member
 */
exports.isMember = (members, userId) => {
    if (!members || !Array.isArray(members)) return false;

    return members.some(m => {
        const memberId = exports.extractMemberId(m);
        return memberId === userId.toString();
    });
};

/**
 * Normalize member format from old to new
 * Converts direct ObjectIds to { user: ObjectId, joinedAt: Date } format
 * @param {Array} members - Array of members in mixed format
 * @param {Date} defaultJoinDate - Default join date (e.g., channel.createdAt)
 * @returns {Array} Normalized members array
 */
exports.normalizeMemberFormat = (members, defaultJoinDate = new Date()) => {
    if (!members || !Array.isArray(members)) return [];

    return members.map(m => {
        // Already in new format
        if (m.user) return m;

        // Convert old format to new
        return {
            user: m,
            joinedAt: defaultJoinDate
        };
    });
};

/**
 * Extract all member IDs from members array
 * @param {Array} members - Array of members
 * @returns {Array} Array of member IDs as strings
 */
exports.getMemberIds = (members) => {
    if (!members || !Array.isArray(members)) return [];

    return members.map(m => exports.extractMemberId(m)).filter(Boolean);
};

/**
 * Check if user is in members array (alternative name for clarity)
 * @param {Array} members - Array of members
 * @param {String} userId - User ID to check
 * @returns {Boolean} True if user is a member
 */
exports.isUserInMembers = (members, userId) => {
    return exports.isMember(members, userId);
};

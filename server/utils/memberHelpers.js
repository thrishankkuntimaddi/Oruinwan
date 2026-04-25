exports.extractMemberId = (member) => {
    if (!member) return null;

    
    if (member.user) {
        
        return member.user._id ? member.user._id.toString() : member.user.toString();
    }

    
    return member.toString();
};

exports.isMember = (members, userId) => {
    if (!members || !Array.isArray(members)) return false;

    return members.some(m => {
        const memberId = exports.extractMemberId(m);
        return memberId === userId.toString();
    });
};

exports.normalizeMemberFormat = (members, defaultJoinDate = new Date()) => {
    if (!members || !Array.isArray(members)) return [];

    return members.map(m => {
        
        if (m.user) return m;

        
        return {
            user: m,
            joinedAt: defaultJoinDate
        };
    });
};

exports.getMemberIds = (members) => {
    if (!members || !Array.isArray(members)) return [];

    return members.map(m => exports.extractMemberId(m)).filter(Boolean);
};

exports.isUserInMembers = (members, userId) => {
    return exports.isMember(members, userId);
};

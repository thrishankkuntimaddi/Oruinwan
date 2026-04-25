const User = require('../../../models/User');
const Department = require('../../../models/Department');
const Workspace = require('../../../models/Workspace');

async function getAnalyticsStats(companyId) {
    if (!companyId) {
        const error = new Error('No company associated with user');
        error.statusCode = 400;
        throw error;
    }

    const [
        usersCount,
        departmentsCount,
        workspacesCount,
        _totalChannels 
    ] = await Promise.all([
        User.countDocuments({ companyId: companyId }),
        Department.countDocuments({ company: companyId }),
        Workspace.countDocuments({ company: companyId }),
        Promise.resolve(0) 
    ]);

    return {
        stats: [
            {
                id: 1,
                title: 'Total Team',
                value: usersCount.toString(),
                change: '+0% since last month',
                icon: 'Users',
                color: '#3b82f6'
            },
            {
                id: 2,
                title: 'Departments',
                value: departmentsCount.toString(),
                change: '+0 added this week',
                icon: 'Briefcase',
                color: '#10b981'
            },
            {
                id: 3,
                title: 'Workspaces',
                value: workspacesCount.toString(),
                change: '+0 created',
                icon: 'Hash',
                color: '#8b5cf6'
            },
            {
                id: 4,
                title: 'Monthly Growth',
                value: '0%',
                change: 'Target: 10%',
                icon: 'TrendingUp',
                color: '#f59e0b'
            }
        ]
    };
}

async function getDepartments(companyId) {
    const departments = await Department.find({ company: companyId })
        .populate('head', 'username email profilePicture')
        .populate('workspaces', 'name id')
        .sort({ createdAt: -1 });

    
    const deptData = await Promise.all(departments.map(async (dept) => {
        const memberCount = await User.countDocuments({ departments: dept._id });
        return {
            id: dept._id,
            name: dept.name,
            head: dept.head ? dept.head.username : '-',
            headId: dept.head ? dept.head._id : null,
            members: memberCount,
            workspaces: dept.workspaces.length,
            created: new Date(dept.createdAt).toLocaleDateString()
        };
    }));

    return { departments: deptData };
}

module.exports = {
    getAnalyticsStats,
    getDepartments
};

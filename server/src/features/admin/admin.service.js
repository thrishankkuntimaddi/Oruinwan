const org = require('../../identity/queries/org');
const { hydrate } = require('../../identity/hydrate');

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
        org.users.count({ companyId: companyId }),
        org.departments.count({ company: companyId }),
        org.workspaces.count({ company: companyId }),
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
    const departments = await org.departments.find({ company: companyId }, { sort: { createdAt: -1 } });
    await hydrate(departments, { head: { type: 'user', fields: ['username', 'email', 'profilePicture'] } });
    const sizes = new Map((await org.departmentSizes(companyId)).map((d) => [String(d._id), d.members]));

    const deptData = departments.map((dept) => {
        const memberCount = sizes.get(String(dept._id)) || 0;
        return {
            id: dept._id,
            name: dept.name,
            head: dept.head ? dept.head.username : '-',
            headId: dept.head ? dept.head._id : null,
            members: memberCount,
            workspaces: dept.workspaces.length,
            created: new Date(dept.createdAt).toLocaleDateString()
        };
    });

    return { departments: deptData };
}

module.exports = {
    getAnalyticsStats,
    getDepartments
};

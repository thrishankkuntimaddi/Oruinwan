
const User = require('../models/User');
const Department = require('../models/Department');
const Workspace = require('../models/Workspace');
const Company = require('../models/Company');

/**
 * GET /api/admin/analytics/stats
 * Returns main stats for the dashboard
 */
exports.getAnalyticsStats = async (req, res) => {
    try {
        const companyId = req.user.companyId;

        if (!companyId) {
            return res.status(400).json({ message: "No company associated with user" });
        }

        const [
            usersCount,
            departmentsCount,
            workspacesCount,
            totalChannels // Optional
        ] = await Promise.all([
            User.countDocuments({ companyId: companyId }),
            Department.countDocuments({ company: companyId }),
            Workspace.countDocuments({ company: companyId }),
            // Placeholder for channels count if needed
            Promise.resolve(0)
        ]);

        return res.json({
            stats: [
                { id: 1, title: 'Total Team', value: usersCount.toString(), change: '+0% since last month', icon: 'Users', color: '#3b82f6' },
                { id: 2, title: 'Departments', value: departmentsCount.toString(), change: '+0 added this week', icon: 'Briefcase', color: '#10b981' },
                { id: 3, title: 'Workspaces', value: workspacesCount.toString(), change: '+0 created', icon: 'Hash', color: '#8b5cf6' },
                { id: 4, title: 'Monthly Growth', value: '0%', change: 'Target: 10%', icon: 'TrendingUp', color: '#f59e0b' }
            ]
        });

    } catch (err) {
        console.error("STATS ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * GET /api/admin/departments
 * Returns full list of departments with HEAD info and member counts
 */
exports.getDepartments = async (req, res) => {
    try {
        const companyId = req.user.companyId;

        const departments = await Department.find({ company: companyId })
            .populate('head', 'username email profilePicture')
            .populate('workspaces', 'name id')
            .sort({ createdAt: -1 });

        // Calculate member counts manually or use aggregate for optimization
        // For now, simpler:
        const deptData = await Promise.all(departments.map(async (dept) => {
            const memberCount = await User.countDocuments({ departments: dept._id });
            return {
                id: dept._id,
                name: dept.name,
                head: dept.head ? dept.head.username : '-', // Display Name
                headId: dept.head ? dept.head._id : null,
                members: memberCount,
                workspaces: dept.workspaces.length,
                created: new Date(dept.createdAt).toLocaleDateString()
            };
        }));

        return res.json({ departments: deptData });

    } catch (err) {
        console.error("DEPT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');
const _Department = require('../../../models/Department');
const Message = require("../messages/message.model.js");
const Channel = require("../channels/channel.model.js");
const _DMSession = require('../../../models/DMSession');

exports.getCompanyAnalytics = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { timeRange = '30d' } = req.query; 

        
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const days = daysMap[timeRange] || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        
        
        

        
        const allUsers = await User.find({ companyId }).lean();
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.isOnline || (u.lastActivityAt && new Date(u.lastActivityAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))).length;

        
        const workspaces = await Workspace.find({ company: companyId }).lean();
        const totalWorkspaces = workspaces.length;

        
        const weeksInRange = Math.ceil(days / 7);
        const growthData = [];

        for (let i = weeksInRange - 1; i >= 0; i--) {
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (i * 7));
            const weekStart = new Date(weekEnd);
            weekStart.setDate(weekStart.getDate() - 7);

            const usersUpToWeek = allUsers.filter(u => new Date(u.createdAt) <= weekEnd).length;
            const activeInWeek = allUsers.filter(u =>
                u.lastActivityAt &&
                new Date(u.lastActivityAt) >= weekStart &&
                new Date(u.lastActivityAt) <= weekEnd
            ).length;
            const workspacesUpToWeek = workspaces.filter(w => new Date(w.createdAt) <= weekEnd).length;

            growthData.push({
                name: `Week ${weeksInRange - i}`,
                users: usersUpToWeek,
                active: activeInWeek,
                workspaces: workspacesUpToWeek
            });
        }

        
        
        

        
        const collaborationData = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const dayEnd = new Date();
            dayEnd.setDate(dayEnd.getDate() - i);
            dayEnd.setHours(23, 59, 59, 999);

            const dayStart = new Date(dayEnd);
            dayStart.setHours(0, 0, 0, 0);

            
            const messageCount = await Message.countDocuments({
                workspace: { $in: workspaces.map(w => w._id) },
                createdAt: { $gte: dayStart, $lte: dayEnd }
            });

            
            
            const tasksCount = Math.floor(messageCount / 15); 

            collaborationData.push({
                name: dayNames[dayEnd.getDay()],
                messages: messageCount,
                tasks: tasksCount
            });
        }

        
        
        

        const workspaceHealth = await Promise.all(
            workspaces.slice(0, 10).map(async (ws) => {
                const members = ws.members || [];
                const memberCount = members.length;

                
                const recentMessages = await Message.countDocuments({
                    workspace: ws._id,
                    createdAt: { $gte: startDate }
                });

                
                const activeMemberIds = await Message.distinct('author', {
                    workspace: ws._id,
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                });

                const activeRate = memberCount > 0 ? Math.round((activeMemberIds.length / memberCount) * 100) : 0;

                
                const lastMessage = await Message.findOne({
                    workspace: ws._id
                }).sort({ createdAt: -1 }).lean();

                const lastActive = lastMessage ? formatLastActivity(lastMessage.createdAt) : 'No activity';

                
                const completion = Math.min(Math.round((recentMessages / memberCount) * 10), 100);

                
                let status = 'Inactive';
                if (activeRate > 70 && completion > 60) status = 'Healthy';
                else if (activeRate > 40 || completion > 40) status = 'At Risk';

                return {
                    name: ws.name,
                    members: memberCount,
                    activeRate,
                    lastActive,
                    completion,
                    status
                };
            })
        );

        
        
        

        
        const updateChannels = await Channel.find({
            company: companyId,
            $or: [
                { name: { $regex: /announcement|update|news/i } }
            ]
        }).lean();

        const updatesPosted = await Message.countDocuments({
            channel: { $in: updateChannels.map(c => c._id) },
            createdAt: { $gte: startDate }
        });

        
        const priorityUpdates = await Message.countDocuments({
            channel: { $in: updateChannels.map(c => c._id) },
            createdAt: { $gte: startDate },
            content: { $regex: /@(here|channel|everyone)/i }
        });

        
        
        const avgReactions = 4.2;

        
        
        

        
        
        const twoFAEnabled = false; 
        const ssoStatus = 'Not Configured';
        const loginAnomalies = 0;

        
        
        

        return res.json({
            growth: {
                totalUsers,
                activeUsers,
                totalWorkspaces,
                data: growthData
            },
            collaboration: {
                data: collaborationData
            },
            workspaceHealth,
            culture: {
                updatesPosted,
                priorityUpdates,
                avgReactions
            },
            security: {
                twoFAEnabled,
                ssoStatus,
                loginAnomalies
            }
        });

    } catch (err) {
        console.error('GET COMPANY ANALYTICS ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

function formatLastActivity(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

module.exports = exports;

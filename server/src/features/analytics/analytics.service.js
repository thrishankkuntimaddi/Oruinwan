const Message = require('../messages/message.model');
const Channel = require('../channels/channel.model');
const Task = require('../../../models/Task');
const ScheduledMeeting = require('../../models/ScheduledMeeting');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');

const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; 

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function _cacheSet(key, data) {
  _cache.set(key, { ts: Date.now(), data });
}

function _dateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
}

function _buildBuckets(days) {
  const buckets = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (days <= 7) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      buckets.push({ label: dayNames[start.getDay()], start, end });
    }
  } else {
    const weeks = Math.ceil(days / 7);
    for (let w = weeks - 1; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      buckets.push({ label: `Week ${weeks - w}`, start, end });
    }
  }
  return buckets;
}

async function getAnalyticsSummary(companyId, period = 30) {
  const cacheKey = `summary:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  const workspaces = await Workspace.find({ company: companyId }).select('_id').lean();
  const wsIds = workspaces.map(w => w._id);

  const [
    totalUsers,
    activeUsers,
    prevActiveUsers,
    totalMessages,
    taskMetrics
  ] = await Promise.all([
    User.countDocuments({ companyId }),

    User.countDocuments({
      companyId,
      $or: [{ isOnline: true }, { lastActivityAt: { $gte: start } }]
    }),

    
    User.countDocuments({
      companyId,
      $or: [
        { isOnline: true },
        { lastActivityAt: { $gte: new Date(start.getTime() - period * 24 * 60 * 60 * 1000), $lt: start } }
      ]
    }),

    Message.countDocuments({
      company: companyId,
      type: { $ne: 'system' },
      createdAt: { $gte: start }
    }),

    Task.aggregate([
      { $match: { company: companyId, deleted: false, createdAt: { $gte: start } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
        }
      }
    ])
  ]);

  const taskTotal = taskMetrics[0]?.total || 0;
  const taskCompleted = taskMetrics[0]?.completed || 0;
  const taskCompletionRate = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  const userGrowth = prevActiveUsers > 0
    ? Math.round(((activeUsers - prevActiveUsers) / prevActiveUsers) * 100)
    : 0;

  const result = {
    summary: {
      totalUsers,
      activeUsers,
      totalWorkspaces: wsIds.length,
      totalMessages,
      taskCompletionRate,
      userGrowth
    }
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getUserActivityAnalytics(companyId, period = 30) {
  const cacheKey = `user-activity:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);
  const buckets = _buildBuckets(period);

  const [topContributors, trendRaw] = await Promise.all([
    
    Message.aggregate([
      {
        $match: {
          company: companyId,
          type: { $ne: 'system' },
          createdAt: { $gte: start }
        }
      },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmpty: true } },
      {
        $project: {
          userId: '$_id',
          messages: '$count',
          name: { $ifNull: ['$user.username', 'Unknown'] },
          avatar: '$user.profilePicture'
        }
      }
    ]),

    
    Promise.all(
      buckets.map(async b => ({
        name: b.label,
        value: await User.countDocuments({
          companyId,
          lastActivityAt: { $gte: b.start, $lte: b.end }
        })
      }))
    )
  ]);

  const result = {
    topContributors,
    trendData: trendRaw
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getWorkspaceAnalytics(companyId, period = 30) {
  const cacheKey = `workspaces:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);
  const workspaces = await Workspace.find({ company: companyId }).lean();

  const workspaceStats = await Promise.all(
    workspaces.slice(0, 15).map(async ws => {
      const [msgCount, taskCount] = await Promise.all([
        Message.countDocuments({ workspace: ws._id, type: { $ne: 'system' }, createdAt: { $gte: start } }),
        Task.countDocuments({ workspace: ws._id, deleted: false, createdAt: { $gte: start } })
      ]);

      const activeSenders = await Message.distinct('sender', {
        workspace: ws._id,
        createdAt: { $gte: start }
      });

      const memberCount = ws.members?.length || 0;
      const activeUsers = activeSenders.length;
      const activeRate = memberCount > 0 ? Math.round((activeUsers / memberCount) * 100) : 0;

      return {
        _id: ws._id,
        name: ws.name,
        memberCount,
        activeUsers,
        activeRate,
        messageCount: msgCount,
        taskCount
      };
    })
  );

  const result = {
    workspaces: workspaceStats.sort((a, b) => b.messageCount - a.messageCount)
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getChannelEngagementAnalytics(companyId, period = 30) {
  const cacheKey = `channels:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  const channelStats = await Message.aggregate([
    {
      $match: {
        company: companyId,
        channel: { $ne: null },
        type: { $ne: 'system' },
        createdAt: { $gte: start }
      }
    },
    {
      $group: {
        _id: '$channel',
        messageCount: { $sum: 1 },
        activeUsers: { $addToSet: '$sender' }
      }
    },
    {
      $lookup: {
        from: 'channels',
        localField: '_id',
        foreignField: '_id',
        as: 'channel'
      }
    },
    { $unwind: { path: '$channel', preserveNullAndEmpty: true } },
    {
      $project: {
        channelId: '$_id',
        name: { $ifNull: ['$channel.name', 'Unknown Channel'] },
        messageCount: 1,
        activeUsers: { $size: '$activeUsers' },
        memberCount: { $size: { $ifNull: ['$channel.members', []] } }
      }
    },
    { $sort: { messageCount: -1 } },
    { $limit: 15 }
  ]);

  const result = { channels: channelStats };
  _cacheSet(cacheKey, result);
  return result;
}

async function getTaskAnalytics(companyId, period = 30) {
  const cacheKey = `tasks:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  const [statusBreakdown, completionDuration, trendData] = await Promise.all([
    
    Task.aggregate([
      { $match: { company: companyId, deleted: false, createdAt: { $gte: start } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    
    Task.aggregate([
      {
        $match: {
          company: companyId,
          deleted: false,
          status: 'done',
          completedAt: { $ne: null },
          createdAt: { $gte: start }
        }
      },
      {
        $project: {
          durationHours: {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              3600000 
            ]
          }
        }
      },
      { $group: { _id: null, avgHours: { $avg: '$durationHours' } } }
    ]),

    
    (async () => {
      const buckets = _buildBuckets(period);
      const rows = await Promise.all(
        buckets.map(async b => {
          const [created, completed] = await Promise.all([
            Task.countDocuments({ company: companyId, deleted: false, createdAt: { $gte: b.start, $lte: b.end } }),
            Task.countDocuments({ company: companyId, deleted: false, completedAt: { $gte: b.start, $lte: b.end } })
          ]);
          return { name: b.label, created, completed };
        })
      );
      return rows;
    })()
  ]);

  const metrics = { todo: 0, inProgress: 0, review: 0, completed: 0, blocked: 0, cancelled: 0, backlog: 0 };
  statusBreakdown.forEach(s => {
    const key = {
      todo: 'todo', in_progress: 'inProgress', review: 'review',
      done: 'completed', blocked: 'blocked', cancelled: 'cancelled', backlog: 'backlog'
    }[s._id] || 'todo';
    metrics[key] = s.count;
  });

  const total = Object.values(metrics).reduce((a, b) => a + b, 0);
  const completionRate = total > 0 ? Math.round((metrics.completed / total) * 100) : 0;
  const avgDurationHours = Math.round(completionDuration[0]?.avgHours || 0);

  const result = {
    metrics,
    summary: { total, completionRate, avgDurationHours },
    trendData
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getMessageVolumeAnalytics(companyId, period = 30) {
  const cacheKey = `messages:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);
  const buckets = _buildBuckets(period);

  const [totals, trendRaw] = await Promise.all([
    Message.aggregate([
      { $match: { company: companyId, type: { $ne: 'system' }, createdAt: { $gte: start } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byChannel: { $sum: { $cond: [{ $ne: ['$channel', null] }, 1, 0] } },
          byDM: { $sum: { $cond: [{ $ne: ['$dm', null] }, 1, 0] } }
        }
      }
    ]),

    Promise.all(
      buckets.map(async b => ({
        name: b.label,
        value: await Message.countDocuments({
          company: companyId,
          type: { $ne: 'system' },
          createdAt: { $gte: b.start, $lte: b.end }
        })
      }))
    )
  ]);

  const result = {
    metrics: {
      total: totals[0]?.total || 0,
      byChannel: totals[0]?.byChannel || 0,
      byDM: totals[0]?.byDM || 0
    },
    trendData: trendRaw
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getEngagementTrends(companyId, period = 30) {
  const cacheKey = `engagement:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dau, wau, mau] = await Promise.all([
    User.countDocuments({ companyId, lastActivityAt: { $gte: dayAgo } }),
    User.countDocuments({ companyId, lastActivityAt: { $gte: weekAgo } }),
    User.countDocuments({ companyId, lastActivityAt: { $gte: monthAgo } })
  ]);

  const dauWauRatio = wau > 0 ? Math.round((dau / wau) * 100) : 0;

  const result = { dau, wau, mau, dauWauRatio };
  _cacheSet(cacheKey, result);
  return result;
}

async function getTeamActivity(companyId, period = 30) {
  const cacheKey = `team-activity:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  const [msgByUser, taskByUser, users] = await Promise.all([
    Message.aggregate([
      { $match: { company: companyId, type: { $ne: 'system' }, createdAt: { $gte: start } } },
      { $group: { _id: '$sender', messages: { $sum: 1 } } }
    ]),

    Task.aggregate([
      { $match: { company: companyId, deleted: false, createdAt: { $gte: start } } },
      { $unwind: '$assignedTo' },
      {
        $group: {
          _id: '$assignedTo',
          tasksAssigned: { $sum: 1 },
          tasksCompleted: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }
        }
      }
    ]),

    User.find({ companyId }).select('_id username profilePicture companyRole').lean()
  ]);

  
  const msgMap = Object.fromEntries(msgByUser.map(m => [m._id.toString(), m.messages]));
  const taskMap = Object.fromEntries(
    taskByUser.map(t => [t._id.toString(), { assigned: t.tasksAssigned, completed: t.tasksCompleted }])
  );

  const teamActivity = users.map(u => {
    const id = u._id.toString();
    return {
      userId: u._id,
      name: u.username,
      avatar: u.profilePicture,
      role: u.companyRole,
      messages: msgMap[id] || 0,
      tasksAssigned: taskMap[id]?.assigned || 0,
      tasksCompleted: taskMap[id]?.completed || 0
    };
  }).filter(u => u.messages > 0 || u.tasksAssigned > 0)
    .sort((a, b) => (b.messages + b.tasksAssigned) - (a.messages + a.tasksAssigned));

  const result = { teamActivity };
  _cacheSet(cacheKey, result);
  return result;
}

async function getWorkloadAnalysis(companyId, period = 30) {
  const cacheKey = `workload:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  const [tasksByUser, users] = await Promise.all([
    Task.aggregate([
      {
        $match: {
          company: companyId,
          deleted: false,
          status: { $nin: ['done', 'cancelled'] },
          createdAt: { $gte: start }
        }
      },
      { $unwind: '$assignedTo' },
      { $group: { _id: '$assignedTo', openTasks: { $sum: 1 } } }
    ]),

    User.find({ companyId }).select('_id username profilePicture companyRole').lean()
  ]);

  const taskMap = Object.fromEntries(tasksByUser.map(t => [t._id.toString(), t.openTasks]));

  const workload = users.map(u => ({
    userId: u._id,
    name: u.username,
    avatar: u.profilePicture,
    role: u.companyRole,
    openTasks: taskMap[u._id.toString()] || 0
  }));

  const counts = workload.map(w => w.openTasks);
  const mean = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const variance = counts.length > 0
    ? counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length
    : 0;
  const stddev = Math.sqrt(variance);
  const overloadThreshold = Math.round(mean + 1.5 * stddev);
  const idleThreshold = Math.max(0, Math.round(mean - stddev));

  const categorized = workload.map(u => ({
    ...u,
    status: u.openTasks > overloadThreshold ? 'overloaded'
      : u.openTasks <= idleThreshold ? 'idle'
        : 'balanced'
  })).sort((a, b) => b.openTasks - a.openTasks);

  const result = {
    workload: categorized,
    stats: {
      mean: Math.round(mean),
      overloadThreshold,
      idleThreshold,
      overloadedCount: categorized.filter(u => u.status === 'overloaded').length,
      idleCount: categorized.filter(u => u.status === 'idle').length,
      balancedCount: categorized.filter(u => u.status === 'balanced').length
    }
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getCommunicationPatterns(companyId, period = 30) {
  const cacheKey = `comms:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const { start } = _dateRange(period);

  
  const hourDist = await Message.aggregate([
    { $match: { company: companyId, type: { $ne: 'system' }, createdAt: { $gte: start } } },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { '_id': 1 } }
  ]);

  const hourlyPattern = Array.from({ length: 24 }, (_, h) => {
    const found = hourDist.find(d => d._id === h);
    return { hour: h, label: `${h}:00`, count: found?.count || 0 };
  });

  
  const topChannels = await Message.aggregate([
    { $match: { company: companyId, channel: { $ne: null }, type: { $ne: 'system' }, createdAt: { $gte: start } } },
    { $group: { _id: '$channel', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'channels', localField: '_id', foreignField: '_id', as: 'c' } },
    { $unwind: { path: '$c', preserveNullAndEmpty: true } },
    { $project: { name: { $ifNull: ['$c.name', 'Unknown'] }, count: 1 } }
  ]);

  const result = { hourlyPattern, topChannels };
  _cacheSet(cacheKey, result);
  return result;
}

module.exports = {
  getAnalyticsSummary,
  getUserActivityAnalytics,
  getWorkspaceAnalytics,
  getChannelEngagementAnalytics,
  getTaskAnalytics,
  getMessageVolumeAnalytics,
  getEngagementTrends,
  getTeamActivity,
  getWorkloadAnalysis,
  getCommunicationPatterns
};

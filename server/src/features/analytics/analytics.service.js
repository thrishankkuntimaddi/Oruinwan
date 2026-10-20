const Channel = require('../channels/channel.model');
const Tasks = require('../tasks/tasks.query');
const org = require('../../identity/queries/org');

// Privacy: these company insights never count or read messages. Messages are end-to-end
// encrypted and the product promise is that only the participants read them, so admins get
// non-message aggregates only (people, sign-in activity, workspaces, channels, tasks).

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

  const workspaces = await org.workspaces.find({ company: companyId }, { members: false, select: '_id' });
  const wsIds = workspaces.map(w => w._id);

  const [
    totalUsers,
    activeUsers,
    prevActiveUsers,
    totalChannels,
    taskMetrics
  ] = await Promise.all([
    org.users.count({ companyId }),

    org.users.count({
      companyId,
      $or: [{ isOnline: true }, { lastActivityAt: { $gte: start } }]
    }),

    
    org.users.count({
      companyId,
      $or: [
        { isOnline: true },
        { lastActivityAt: { $gte: new Date(start.getTime() - period * 24 * 60 * 60 * 1000), $lt: start } }
      ]
    }),

    Channel.countDocuments({ company: companyId, isArchived: { $ne: true } }),

    Tasks.totals({ company: companyId, deleted: false, createdAt: { $gte: start } }).then((t) => [t])
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
      totalChannels,
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

  const buckets = _buildBuckets(period);

  // People active per period bucket (a count, never who or how much they wrote).
  const trendRaw = await Promise.all(
    buckets.map(async b => ({
      name: b.label,
      value: await org.users.count({
        companyId,
        lastActivityAt: { $gte: b.start, $lte: b.end }
      })
    }))
  );

  const result = {
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
  const workspaces = await org.workspaces.find({ company: companyId });

  const workspaceStats = await Promise.all(
    workspaces.slice(0, 15).map(async ws => {
      const [taskCount, channelCount] = await Promise.all([
        Tasks.countDocuments({ workspace: ws._id, deleted: false, createdAt: { $gte: start } }),
        Channel.countDocuments({ workspace: ws._id, isArchived: { $ne: true } }),
      ]);
      return {
        _id: ws._id,
        name: ws.name,
        memberCount: (ws.members || []).filter((m) => m.status !== 'removed').length,
        channelCount,
        taskCount
      };
    })
  );

  const result = {
    workspaces: workspaceStats.sort((a, b) => b.memberCount - a.memberCount)
  };

  _cacheSet(cacheKey, result);
  return result;
}

async function getChannelEngagementAnalytics(companyId, period = 30) {
  const cacheKey = `channels:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  // Public channels by size. Private channels and every message stay out of it.
  const channelStats = (await Channel.find({ company: companyId, isPrivate: { $ne: true }, isArchived: { $ne: true } })
    .select('_id name members')
    .lean())
    .map((c) => ({ channelId: c._id, name: c.name, memberCount: (c.members || []).length }))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 15);

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
    
    Tasks.statusCounts({ company: companyId, deleted: false, createdAt: { $gte: start } }),

    Tasks.avgCompletionHours({ company: companyId, deleted: false, status: 'done', createdAt: { $gte: start } })
      .then((avgHours) => (avgHours == null ? [] : [{ _id: null, avgHours }])),

    (async () => {
      const buckets = _buildBuckets(period);
      const live = { company: companyId, deleted: false };
      const [created, completed] = await Promise.all([
        Tasks.countBuckets(live, 'createdAt', buckets),
        Tasks.countBuckets(live, 'completedAt', buckets),
      ]);
      return buckets.map((b, i) => ({ name: b.label, created: created[i], completed: completed[i] }));
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

async function getEngagementTrends(companyId, period = 30) {
  const cacheKey = `engagement:${companyId}:${period}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dau, wau, mau] = await Promise.all([
    org.users.count({ companyId, lastActivityAt: { $gte: dayAgo } }),
    org.users.count({ companyId, lastActivityAt: { $gte: weekAgo } }),
    org.users.count({ companyId, lastActivityAt: { $gte: monthAgo } })
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

  // Task work per person (assigned / completed). No message counts.
  const [taskByUser, users] = await Promise.all([
    Tasks.groupCount({ company: companyId, deleted: false, createdAt: { $gte: start } }, 'assignee')
      .then((rows) => rows.map((r) => ({ _id: r._id, tasksAssigned: r.count, tasksCompleted: r.done }))),

    org.users.find({ companyId }, { select: '_id username profilePicture companyRole' })
  ]);

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
      tasksAssigned: taskMap[id]?.assigned || 0,
      tasksCompleted: taskMap[id]?.completed || 0
    };
  }).filter(u => u.tasksAssigned > 0)
    .sort((a, b) => (b.tasksCompleted - a.tasksCompleted) || (b.tasksAssigned - a.tasksAssigned));

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
    Tasks.groupCount({ company: companyId, deleted: false, status: { $nin: ['done', 'cancelled'] }, createdAt: { $gte: start } }, 'assignee')
      .then((rows) => rows.map((r) => ({ _id: r._id, openTasks: r.count }))),

    org.users.find({ companyId }, { select: '_id username profilePicture companyRole' })
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

module.exports = {
  getAnalyticsSummary,
  getUserActivityAnalytics,
  getWorkspaceAnalytics,
  getChannelEngagementAnalytics,
  getTaskAnalytics,
  getEngagementTrends,
  getTeamActivity,
  getWorkloadAnalysis
};

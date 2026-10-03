'use strict';

/**
 * In-memory stand-in for the PostgreSQL identity layer, for route tests in the
 * company / admin / org area (not a test file itself).
 *
 *   jest.mock('../../../identity', () => require('<this file>').identity);
 *   jest.mock('../../../identity/queries/org', () => require('<this file>').org);
 *   jest.mock('../../../identity/queries/auth', () => require('<this file>').auth);
 *   jest.mock('../../../shared/postgres', () => require('<this file>').postgres);
 *
 *   const s = require('<this file>');
 *   s.reset();
 *   s.addCompany({ _id: C1, name: 'Acme' });
 *   s.addUser({ _id: U1, companyId: C1, companyRole: 'admin' });
 *   s.addDepartment({ _id: D1, company: C1, name: 'Eng' }, { members: [U1], managers: [U2] });
 *
 * Filters use the same Mongo-style shapes the code passes to org.users.find
 * etc.; the matcher understands the operators the real SQL translator does.
 */

// Loaded lazily: the real module requires shared/postgres, which tests map to this file.
let realOrgModule = null;
const realOrg = () => (realOrgModule || (realOrgModule = jest.requireActual('../../../identity/queries/org')));

const state = {};
let seq = 0;
function reset() {
    Object.assign(state, {
        users: new Map(), companies: new Map(), workspaces: new Map(), departments: new Map(), teams: new Map(),
        deptMembers: [], admins: [], rolePerms: [], wsPerms: new Map(), invites: new Map(), sessions: [],
    });
    seq = 0;
}
reset();

const s = (v) => (v == null ? null : String(v._id || v));
const newId = () => { seq += 1; return seq.toString(16).padStart(24, 'f'); };
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : x))));

// ── seeding ──────────────────────────────────────────────────────────
function addUser(u) {
    const user = {
        accountStatus: 'active', companyRole: 'member', userType: 'company', roles: ['user'], verified: true,
        profile: {}, preferences: {}, createdAt: new Date(), isOnline: false, ...u,
    };
    user._id = s(u._id) || newId();
    if (user.companyId) user.companyId = s(user.companyId);
    state.users.set(user._id, user);
    for (const d of u.departments || []) addDeptMember(d, user._id, 'member');
    for (const d of u.managedDepartments || []) addDeptMember(d, user._id, 'manager');
    delete user.departments; delete user.managedDepartments;
    return user;
}
function addCompany(c, { admins = [] } = {}) {
    const company = { verificationStatus: 'verified', isActive: true, settings: {}, metadata: {}, createdAt: new Date(), ...c };
    company._id = s(c._id) || newId();
    state.companies.set(company._id, company);
    for (const a of admins) state.admins.push({ company: company._id, user: s(a.user), role: a.role || 'admin' });
    return company;
}
function addWorkspace(w) {
    const ws = { isActive: true, isArchived: false, type: 'team', settings: {}, createdAt: new Date(), ...w };
    ws._id = s(w._id) || newId();
    if (ws.company) ws.company = s(ws.company);
    ws.members = (w.members || []).map((m) => ({ status: 'active', role: 'member', joinedAt: new Date(), ...m, user: s(m.user) }));
    state.workspaces.set(ws._id, ws);
    return ws;
}
function addDepartment(d, { members = [], managers = [] } = {}) {
    const dept = { isActive: true, workspaces: [], createdAt: new Date(), ...d };
    dept._id = s(d._id) || newId();
    dept.company = s(dept.company);
    if (dept.head) dept.head = s(dept.head);
    delete dept.members; delete dept.managers;
    state.departments.set(dept._id, dept);
    for (const u of [...(d.members || []), ...members]) addDeptMember(dept._id, u, 'member');
    for (const u of [...(d.managers || []), ...managers]) addDeptMember(dept._id, u, 'manager');
    return dept;
}
function addTeam(t) {
    const team = { isActive: true, description: '', createdAt: new Date(), ...t };
    team._id = s(t._id) || newId();
    team.company = s(team.company);
    team.members = (t.members || []).map((m) => ({ role: 'member', joinedAt: new Date(), ...m, user: s(m.user) }));
    state.teams.set(team._id, team);
    return team;
}
function addDeptMember(deptId, userId, role = 'member') {
    const d = s(deptId); const u = s(userId);
    const row = state.deptMembers.find((r) => r.department === d && r.user === u);
    if (row) { if (role === 'manager') row.role = 'manager'; return; }
    state.deptMembers.push({ department: d, user: u, role });
}

// ── views ────────────────────────────────────────────────────────────
function companyView(c) {
    if (!c) return null;
    const out = { ...clone(c), _id: c._id, id: c._id };
    out.admins = state.admins.filter((a) => a.company === c._id).map((a) => ({ user: a.user, role: a.role }));
    out.isAdmin = (uid) => out.admins.some((a) => a.user === s(uid));
    out.isOwner = (uid) => out.admins.some((a) => a.user === s(uid) && a.role === 'owner');
    return out;
}
function deptView(d) {
    if (!d) return null;
    const rows = state.deptMembers.filter((r) => r.department === d._id);
    return { ...clone(d), _id: d._id, id: d._id, members: rows.map((r) => r.user), managers: rows.filter((r) => r.role === 'manager').map((r) => r.user) };
}
function wsView(w) {
    if (!w) return null;
    const out = { ...clone(w), _id: w._id, id: w._id, members: w.members.map((m) => ({ ...m })) };
    out.isMember = (uid) => out.members.some((m) => m.user === s(uid) && m.status === 'active');
    out.isAdminOrOwner = (uid) => out.members.some((m) => m.user === s(uid) && m.status === 'active' && ['owner', 'admin'].includes(m.role));
    return out;
}
function userView(u) {
    if (!u) return null;
    const out = { ...clone(u), _id: u._id, id: u._id };
    delete out.passwordHash;
    return out;
}
function withOrgSync(u) {
    if (!u) return u;
    const rows = state.deptMembers.filter((r) => r.user === s(u._id) && state.departments.get(r.department)?.isActive !== false);
    u.departments = rows.map((r) => r.department);
    u.managedDepartments = rows.filter((r) => r.role === 'manager').map((r) => r.department);
    u.workspaces = [...state.workspaces.values()].flatMap((w) => w.members.filter((m) => m.user === s(u._id) && m.status === 'active')
        .map((m) => ({ workspace: w._id, role: m.role, joinedAt: m.joinedAt })));
    return u;
}

// ── matcher ──────────────────────────────────────────────────────────
const asStr = (v) => (v instanceof Date ? v.getTime() : v == null ? v : (typeof v === 'object' && (v._id || v.toHexString) ? String(v._id || v) : v));
function cmp(a, b) { const x = a instanceof Date ? a.getTime() : asStr(a); const y = b instanceof Date ? b.getTime() : asStr(b); return x < y ? -1 : x > y ? 1 : 0; }
function valueAt(doc, path) { return path.split('.').reduce((o, p) => (o == null ? undefined : o[p]), doc); }

function special(entity, key, doc) {
    if (entity === 'users' && key === 'departments') return state.deptMembers.filter((r) => r.user === doc._id).map((r) => r.department);
    if (entity === 'users' && key === 'managedDepartments') return state.deptMembers.filter((r) => r.user === doc._id && r.role === 'manager').map((r) => r.department);
    if (entity === 'users' && key === 'workspaces.workspace') return [...state.workspaces.values()].filter((w) => w.members.some((m) => m.user === doc._id && m.status === 'active')).map((w) => w._id);
    if (entity === 'companies' && key === 'admins.user') return state.admins.filter((a) => a.company === doc._id).map((a) => a.user);
    if (entity === 'workspaces' && key === 'members.user') return doc.members.map((m) => m.user);
    if (entity === 'departments' && key === 'members') return state.deptMembers.filter((r) => r.department === doc._id).map((r) => r.user);
    if (entity === 'departments' && key === 'managers') return state.deptMembers.filter((r) => r.department === doc._id && r.role === 'manager').map((r) => r.user);
    return undefined;
}

function fieldMatches(actual, cond) {
    const list = Array.isArray(actual) ? actual.map(asStr) : null;
    const eq = (v) => (list ? list.includes(asStr(v)) : (v === null ? actual == null : (v instanceof RegExp ? v.test(String(actual ?? '')) : cmp(actual, v) === 0 && actual != null)));
    if (cond === null || typeof cond !== 'object' || cond instanceof Date || cond instanceof RegExp || cond.toHexString || (cond._id && !Object.keys(cond).some((k) => k.startsWith('$')))) return eq(cond);
    return Object.entries(cond).every(([op, v]) => {
        switch (op) {
            case '$eq': return eq(v);
            case '$ne': return !eq(v);
            case '$in': return v.some((x) => eq(x));
            case '$nin': return !v.some((x) => eq(x));
            case '$gt': return actual != null && cmp(actual, v) > 0;
            case '$gte': return actual != null && cmp(actual, v) >= 0;
            case '$lt': return actual != null && cmp(actual, v) < 0;
            case '$lte': return actual != null && cmp(actual, v) <= 0;
            case '$exists': return v ? actual !== undefined && actual !== null : actual == null;
            case '$regex': return new RegExp(v instanceof RegExp ? v.source : v, cond.$options || (v instanceof RegExp ? v.flags : '')).test(String(actual ?? ''));
            case '$options': return true;
            case '$elemMatch': return (actual || []).some((m) => Object.entries(v).every(([k, x]) => fieldMatches(m[k], x)));
            default: throw new Error(`identityStore: operator ${op} not supported`);
        }
    });
}

function matches(entity, doc, filter = {}) {
    return Object.entries(filter || {}).every(([key, cond]) => {
        if (cond === undefined) return true;
        if (key === '$or') return cond.some((f) => matches(entity, doc, f));
        if (key === '$and') return cond.every((f) => matches(entity, doc, f));
        const sp = special(entity, key, doc);
        const actual = sp !== undefined ? sp : (key === '_id' || key === 'id' ? doc._id : valueAt(doc, key));
        return fieldMatches(actual, cond);
    });
}

const TABLE = { users: 'users', companies: 'companies', workspaces: 'workspaces', departments: 'departments' };
const VIEW = { users: userView, companies: companyView, workspaces: wsView, departments: deptView };

function sortRows(rows, sort) {
    if (!sort) return rows;
    const entries = Object.entries(sort);
    return rows.sort((a, b) => {
        for (const [k, dir] of entries) { const c = cmp(valueAt(a, k), valueAt(b, k)); if (c) return dir === -1 ? -c : c; }
        return 0;
    });
}

function entity(name) {
    const all = () => [...state[TABLE[name]].values()];
    return {
        find: jest.fn(async (filter = {}, opts = {}) => {
            let rows = sortRows(all().filter((d) => matches(name, d, filter)), opts.sort);
            if (opts.skip) rows = rows.slice(opts.skip);
            if (opts.limit) rows = rows.slice(0, opts.limit);
            let out = rows.map(VIEW[name]);
            if (name === 'users') out = out.map(realOrg().flattenUser);
            if (name === 'users' && opts.org) out.forEach(withOrgSync);
            return opts.select ? out.map((x) => realOrg().project(x, opts.select)) : out;
        }),
        async findOne(filter = {}, opts = {}) { return (await this.find(filter, { ...opts, limit: 1 }))[0] || null; },
        count: jest.fn(async (filter = {}) => all().filter((d) => matches(name, d, filter)).length),
        async exists(filter = {}) { return (await this.count(filter)) > 0; },
        async ids(filter = {}) { return all().filter((d) => matches(name, d, filter)).map((d) => d._id); },
        updateMany: jest.fn(async (filter, patch) => {
            const rows = all().filter((d) => matches(name, d, filter));
            const packed = name === 'users' ? realOrg().packUserPatch(patch) : patch;
            for (const r of rows) applyPatch(r, packed);
            return { modifiedCount: rows.length };
        }),
    };
}

function applyPatch(row, patch) {
    for (const [k, v] of Object.entries(patch || {})) {
        if (v && typeof v === 'object' && v.$merge) { const { $merge, ...rest } = v; row[k] = { ...(row[k] || {}), ...rest }; } // eslint-disable-line no-unused-vars
        else row[k] = v && typeof v === 'object' && (v._id || v.toHexString) ? s(v) : v;
    }
    row.updatedAt = new Date();
}

const org = {
    users: entity('users'), companies: entity('companies'), workspaces: entity('workspaces'), departments: entity('departments'),
    toWhere: (...a) => realOrg().toWhere(...a), project: (...a) => realOrg().project(...a), flattenUser: (...a) => realOrg().flattenUser(...a), packUserPatch: (...a) => realOrg().packUserPatch(...a),
    flattenCompany: (c) => c, publicCompany: (...a) => realOrg().publicCompany(...a), packCompany: (...a) => realOrg().packCompany(...a),
    withOrg: jest.fn(async (list) => { (Array.isArray(list) ? list : [list]).forEach(withOrgSync); return list; }),
    userWithOrg: jest.fn(async (id) => { const u = state.users.get(s(id)); return u ? withOrgSync(realOrg().flattenUser(userView(u))) : null; }),
    insert: jest.fn(async (name, obj) => {
        const add = { users: addUser, companies: addCompany, workspaces: addWorkspace, departments: addDepartment }[name];
        const packed = name === 'companies' ? realOrg().packCompany(obj) : obj;
        if (name === 'companies' && packed.phone) Object.assign(packed, { ownerPhone: packed.phone.ownerPhone, ownerEmail: packed.phone.ownerEmail });
        return VIEW[name](add({ ...packed }));
    }),
    updateUser: jest.fn(async (id, patch) => { const u = state.users.get(s(id)); if (!u) return null; applyPatch(u, realOrg().packUserPatch(patch)); return realOrg().flattenUser(userView(u)); }),
    updateCompany: jest.fn(async (id, patch) => {
        const c = state.companies.get(s(id)); if (!c) return null;
        for (const [k, v] of Object.entries(patch || {})) {
            const dot = k.indexOf('.');
            if (dot > 0) { const head = k.slice(0, dot); c[head] = { ...(c[head] || {}), [k.slice(dot + 1)]: v }; }
            else if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ['metadata', 'settings', 'invitePolicy', 'securitySettings'].includes(k)) c[k] = { ...(c[k] || {}), ...v };
            else c[k] = v && typeof v === 'object' && (v._id || v.toHexString) ? s(v) : v;
        }
        return companyView(c);
    }),
    addWorkspaceMembers: jest.fn(async (wsId, members) => { for (const m of members) identity.workspaces.addMember(wsId, m.user, m); }),
    addCompanyAdmin: jest.fn(async (companyId, userId, role = 'admin') => {
        const row = state.admins.find((a) => a.company === s(companyId) && a.user === s(userId));
        if (row) row.role = role; else state.admins.push({ company: s(companyId), user: s(userId), role });
    }),
    addUserEmail: jest.fn(async () => {}),
    userIdsByAnyEmail: jest.fn(async (email) => [...state.users.values()].filter((u) => [u.email, u.personalEmail].includes(String(email).toLowerCase())).map((u) => u._id)),
    addDepartmentMembers: jest.fn(async (d, ids, role = 'member') => { for (const u of ids) addDeptMember(d, u, role); }),
    removeDepartmentMembers: jest.fn(async (d, ids) => { state.deptMembers = state.deptMembers.filter((r) => !(r.department === s(d) && ids.map(s).includes(r.user))); }),
    demoteDepartmentManagers: jest.fn(async (d, ids) => { for (const r of state.deptMembers) if (r.department === s(d) && ids.map(s).includes(r.user)) r.role = 'member'; }),
    setDepartmentManagers: jest.fn(async (d, ids) => {
        for (const r of state.deptMembers) if (r.department === s(d) && r.role === 'manager' && !ids.map(s).includes(r.user)) r.role = 'member';
        for (const u of ids) addDeptMember(d, u, 'manager');
    }),
    removeUserFromCompanyDepartments: jest.fn(async () => {}),
    setUserDepartments: jest.fn(async (userId, companyId, ids) => {
        state.deptMembers = state.deptMembers.filter((r) => !(r.user === s(userId) && state.departments.get(r.department)?.company === s(companyId) && !ids.map(s).includes(r.department)));
        for (const d of ids) addDeptMember(d, userId, 'member');
    }),
    setUserManagedDepartments: jest.fn(async (userId, ids) => {
        for (const r of state.deptMembers) if (r.user === s(userId) && r.role === 'manager' && !ids.map(s).includes(r.department)) r.role = 'member';
        for (const d of ids) addDeptMember(d, userId, 'manager');
    }),
    departmentMemberIds: jest.fn(async (ids, { role } = {}) => {
        const set = (Array.isArray(ids) ? ids : [ids]).map(s);
        return [...new Set(state.deptMembers.filter((r) => set.includes(r.department) && (!role || r.role === role)).map((r) => r.user))];
    }),
    addDepartmentWorkspace: jest.fn(async (d, w, { setDefault } = {}) => {
        const dept = state.departments.get(s(d)); if (!dept) return;
        if (!dept.workspaces.includes(s(w))) dept.workspaces.push(s(w));
        if (setDefault) dept.defaultWorkspaceId = s(w);
    }),
    setUserCompany: jest.fn(async () => {}),
    expirePendingInvites: jest.fn(async () => 0),
    companySessions: jest.fn(async (companyId) => state.sessions.filter((x) => x.companyId === s(companyId))),
    wouldCreateReportingLoop: jest.fn(async (employeeId, managerId) => {
        let cursor = s(managerId);
        for (let i = 0; cursor && i < 500; i += 1) {
            if (cursor === s(employeeId)) return true;
            cursor = state.users.get(cursor)?.reportsTo ? s(state.users.get(cursor).reportsTo) : null;
        }
        return false;
    }),
    directReports: jest.fn(async () => []),
    companyUserStats: jest.fn(async (companyId) => {
        const us = [...state.users.values()].filter((u) => u.companyId === s(companyId));
        const by = (f) => us.filter(f).length;
        return {
            users: { total: us.length, active: by((u) => u.accountStatus === 'active'), suspended: by((u) => u.accountStatus === 'suspended'), removed: by((u) => u.accountStatus === 'removed'), pending: by((u) => u.accountStatus === 'invited'), online: by((u) => u.isOnline), newSince: 0, activeSince: 0 },
            roles: {}, workspaces: { total: [...state.workspaces.values()].filter((w) => w.company === s(companyId)).length, archived: 0 },
            departments: [...state.departments.values()].filter((d) => d.company === s(companyId) && d.isActive).length, teams: 0,
        };
    }),
    departmentSizes: jest.fn(async (companyId) => [...state.departments.values()].filter((d) => d.company === s(companyId) && d.isActive)
        .map((d) => ({ _id: d._id, name: d.name, members: state.deptMembers.filter((r) => r.department === d._id).length, managers: state.deptMembers.filter((r) => r.department === d._id && r.role === 'manager').length }))),
    roleDistribution: jest.fn(async (companyId) => {
        const out = {};
        for (const u of state.users.values()) if (u.companyId === s(companyId) && u.accountStatus !== 'removed') out[u.companyRole || 'member'] = (out[u.companyRole || 'member'] || 0) + 1;
        return out;
    }),
    userGrowth: jest.fn(async () => []),
    platformStats: jest.fn(async () => ({
        users: state.users.size, activeUsers: [...state.users.values()].filter((u) => u.accountStatus === 'active').length, onlineUsers: 0, newUsers: 0,
        companies: state.companies.size, verifiedCompanies: [...state.companies.values()].filter((c) => c.verificationStatus === 'verified').length,
        pendingCompanies: [...state.companies.values()].filter((c) => c.verificationStatus === 'pending').length, rejectedCompanies: 0, activeCompanies: 0,
        departments: state.departments.size, workspaces: state.workspaces.size,
    })),
    companyCounts: jest.fn(async (ids) => new Map(ids.map((id) => [s(id), { users: [...state.users.values()].filter((u) => u.companyId === s(id)).length, activeUsers: 0, workspaces: 0 }]))),
    workspaceMemberCounts: jest.fn(async () => new Map()),
};

// ── repositories (src/identity index) ────────────────────────────────
const identity = {
    identityStore: () => 'pg',
    usePg: () => true,
    newId,
    users: {
        findById: jest.fn(async (id) => { const u = state.users.get(s(id)); return u ? realOrg().flattenUser(userView(u)) : null; }),
        findByEmail: jest.fn(async (e) => { const u = [...state.users.values()].find((x) => String(x.email).toLowerCase() === String(e).toLowerCase()); return u ? userView(u) : null; }),
        findByUsername: jest.fn(async (n) => userView([...state.users.values()].find((x) => x.username === n))),
        findByPhone: jest.fn(async (p) => userView([...state.users.values()].find((x) => x.phone === p) || null)),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map(s).filter((id) => state.users.has(id)).map((id) => [id, userView(state.users.get(id))]))),
        create: jest.fn(async (u) => userView(addUser({ ...u }))),
        update: jest.fn(async (id, patch) => { const u = state.users.get(s(id)); if (!u) return null; applyPatch(u, patch); return userView(u); }),
        remove: jest.fn(async (id) => {
            state.users.delete(s(id));
            state.deptMembers = state.deptMembers.filter((r) => r.user !== s(id));
            for (const w of state.workspaces.values()) w.members = w.members.filter((m) => m.user !== s(id));
        }),
    },
    companies: {
        findById: jest.fn(async (id) => companyView(state.companies.get(s(id)))),
        findManyByIds: jest.fn(async (ids) => new Map(ids.map(s).filter((id) => state.companies.has(id)).map((id) => [id, companyView(state.companies.get(id))]))),
        addAdmin: jest.fn(async (c, u, role) => org.addCompanyAdmin(c, u, role)),
        removeAdmin: jest.fn(async (c, u) => { state.admins = state.admins.filter((a) => !(a.company === s(c) && a.user === s(u))); }),
    },
    workspaces: {
        findById: jest.fn(async (id) => wsView(state.workspaces.get(s(id)))),
        findManyByIds: jest.fn(async (ids) => ids.map(s).filter((id) => state.workspaces.has(id)).map((id) => wsView(state.workspaces.get(id)))),
        membership: jest.fn(async (wsId, userId) => {
            const w = wsView(state.workspaces.get(s(wsId))); if (!w) return null;
            const member = w.members.find((m) => m.user === s(userId) && m.status === 'active') || null;
            return { workspace: w, member, role: member?.role || null, isAdmin: ['owner', 'admin'].includes(member?.role) };
        }),
        memberWorkspaceIds: jest.fn(async (uid) => [...state.workspaces.values()].filter((w) => w.members.some((m) => m.user === s(uid) && m.status === 'active')).map((w) => w._id)),
        create: jest.fn(async (w) => wsView(addWorkspace({ ...w, members: w.members || [{ user: w.createdBy, role: 'owner' }] }))),
        update: jest.fn(async (id, patch) => { const w = state.workspaces.get(s(id)); if (w) applyPatch(w, patch); return wsView(w); }),
        addMember: jest.fn(async (wsId, userId, { role = 'member', status = 'active' } = {}) => {
            const w = state.workspaces.get(s(wsId)); if (!w) return;
            const m = w.members.find((x) => x.user === s(userId));
            if (m) Object.assign(m, { role, status }); else w.members.push({ user: s(userId), role, status, joinedAt: new Date() });
        }),
        removeMember: jest.fn(async (wsId, userId) => {
            const w = state.workspaces.get(s(wsId)); const m = w && w.members.find((x) => x.user === s(userId));
            if (m) m.status = 'removed';
        }),
        listMembers: jest.fn(async (wsId) => (state.workspaces.get(s(wsId))?.members || []).filter((m) => m.status === 'active')),
    },
    departments: {
        findById: jest.fn(async (id) => deptView(state.departments.get(s(id)))),
        create: jest.fn(async (d) => deptView(addDepartment({ ...d }))),
        update: jest.fn(async (id, patch) => { const d = state.departments.get(s(id)); if (d) applyPatch(d, patch); return deptView(d); }),
        listForCompany: jest.fn(async (c) => [...state.departments.values()].filter((d) => d.company === s(c) && d.isActive).map(deptView)),
        listForUser: jest.fn(async (u) => state.deptMembers.filter((r) => r.user === s(u)).map((r) => deptView(state.departments.get(r.department))).filter(Boolean)),
        managedBy: jest.fn(async (u) => state.deptMembers.filter((r) => r.user === s(u) && r.role === 'manager').map((r) => r.department)),
    },
    teams: {
        findById: jest.fn(async (id) => clone(state.teams.get(s(id)) || null)),
        listForCompany: jest.fn(async (c) => [...state.teams.values()].filter((t) => t.company === s(c) && t.isActive).map(clone)),
        create: jest.fn(async (t) => clone(addTeam({ ...t }))),
        update: jest.fn(async (id, patch) => { const t = state.teams.get(s(id)); if (t) applyPatch(t, patch); return clone(t); }),
        setMember: jest.fn(async (id, u, role = 'member') => { const t = state.teams.get(s(id)); const m = t.members.find((x) => x.user === s(u)); if (m) m.role = role; else t.members.push({ user: s(u), role }); }),
        removeMember: jest.fn(async (id, u) => { const t = state.teams.get(s(id)); t.members = t.members.filter((x) => x.user !== s(u)); }),
    },
    rolePermissions: {
        get: jest.fn(async (c, role) => state.rolePerms.find((r) => r.company === s(c) && r.role === role) || null),
        listForCompany: jest.fn(async (c) => state.rolePerms.filter((r) => r.company === s(c))),
        set: jest.fn(async (c, role, { permissions }) => {
            const row = state.rolePerms.find((r) => r.company === s(c) && r.role === role);
            if (row) row.permissions = permissions; else state.rolePerms.push({ company: s(c), role, permissions });
        }),
    },
    workspacePermissions: {
        get: jest.fn(async (w) => state.wsPerms.get(s(w)) || null),
        upsert: jest.fn(async (w, patch) => { const cur = state.wsPerms.get(s(w)) || { workspace: s(w) }; Object.assign(cur, patch); state.wsPerms.set(s(w), cur); return cur; }),
    },
    identityKeys: { findByUserId: jest.fn(async () => null), batchFindByUserIds: jest.fn(async () => []) },
    deviceSessions: { isRevoked: jest.fn(async () => false), touch: jest.fn(async () => {}) },
    loginSessions: {},
};

// ── queries/auth (middleware + mutable user documents) ───────────────
function userDoc(u) {
    if (!u) return null;
    const doc = withOrgSync(realOrg().flattenUser(userView(u)));
    Object.defineProperty(doc, 'save', {
        enumerable: false,
        value: async () => {
            const row = state.users.get(doc._id) || addUser({ _id: doc._id });
            for (const [k, v] of Object.entries(doc)) {
                if (['departments', 'managedDepartments', 'workspaces', '_id', 'id'].includes(k)) continue;
                row[k] = v;
            }
            for (const d of doc.departments || []) addDeptMember(d, doc._id, 'member');
            for (const w of doc.workspaces || []) identity.workspaces.addMember(w.workspace, doc._id, { role: w.role || 'member' });
            return doc;
        },
    });
    return doc;
}

const auth = {
    loadAuthUser: jest.fn(async (id) => {
        const u = state.users.get(s(id));
        if (!u) return null;
        const out = withOrgSync(realOrg().flattenUser(userView(u)));
        out.sub = out._id;
        return out;
    }),
    userDocs: {
        build: (data = {}) => { const id = s(data._id) || newId(); const u = { ...data, _id: id }; const doc = userDoc(u); return Object.assign(doc, data, { _id: id }); },
        findById: jest.fn(async (id) => userDoc(state.users.get(s(id)))),
        findByEmail: jest.fn(async (e) => userDoc([...state.users.values()].find((x) => x.email === e))),
        findByInviteToken: jest.fn(async (t) => userDoc([...state.users.values()].find((x) => x.inviteToken === t))),
    },
    invites: {
        create: jest.fn(async (i) => { const inv = { status: 'pending', metadata: {}, ...i, _id: newId() }; state.invites.set(inv._id, inv); return { ...inv }; }),
        update: jest.fn(async (id, patch) => { const inv = state.invites.get(s(id)); if (inv) Object.assign(inv, patch); return inv; }),
        findByTokenHash: jest.fn(async (h) => [...state.invites.values()].find((i) => i.tokenHash === h) || null),
        findById: jest.fn(async (id) => state.invites.get(s(id)) || null),
    },
};

// ── postgres (only the raw statements the shared helpers issue) ──────
async function query(text, params = []) {
    if (/SELECT id FROM departments WHERE id = ANY\(\$1\) AND company_id = \$2/.test(text)) {
        return { rows: params[0].filter((id) => state.departments.get(id)?.company === params[1]).map((id) => ({ id })) };
    }
    if (/DELETE FROM company_admins/.test(text)) {
        const [c, u] = params;
        state.admins = state.admins.filter((a) => !(a.company === c && a.user === u && (!/role = 'admin'/.test(text) || a.role === 'admin')));
        return { rows: [], rowCount: 1 };
    }
    if (/DELETE FROM departments WHERE company_id/.test(text)) {
        for (const [id, d] of state.departments) if (d.company === params[0]) state.departments.delete(id);
        return { rows: [], rowCount: 1 };
    }
    if (/department_members/.test(text) && /WHERE user_id = \$1/.test(text)) {
        return { rows: state.deptMembers.filter((r) => r.user === params[0]).map((r) => ({ department_id: r.department, role: r.role })) };
    }
    return { rows: [], rowCount: 0 };
}

const postgres = {
    query: jest.fn(query),
    withTransaction: jest.fn(async (fn) => fn({ query })),
    isPostgresEnabled: () => true,
    getPool: () => null,
    postgresStatus: async () => 'ok',
    closePostgres: async () => {},
    connectPostgres: async () => null,
    poolOptions: () => ({}),
};

module.exports = { state, reset, addUser, addCompany, addWorkspace, addDepartment, addTeam, addDeptMember, matches, identity, org, auth, postgres, newId };

'use strict';

/** Companies on PostgreSQL (migration 0006_identity). */

const { query } = require('../shared/postgres');
const { newId, buildUpdate, columnsFor, insertSql, camelRow, str } = require('./sql');

const COLUMNS = {
    _id: 'id', id: 'id', name: 'name', displayName: 'display_name', logo: 'logo', website: 'website', domain: 'domain',
    domainVerified: 'domain_verified', domainVerification: 'domain_verification', verificationStatus: 'verification_status',
    rejectionReason: 'rejection_reason', isSetupComplete: 'is_setup_complete', setupStep: 'setup_step',
    autoJoinByDomain: 'auto_join_by_domain', allowedEmails: 'allowed_emails', invitePolicy: 'invite_policy',
    defaultWorkspace: 'default_workspace_id', plan: 'plan', billingEmail: 'billing_email', isActive: 'is_active',
    suspendedAt: 'suspended_at', suspensionReason: 'suspension_reason', settings: 'settings', limits: 'limits',
    documents: 'documents', sso: 'sso', securitySettings: 'security_settings', phone: 'phone', metadata: 'metadata',
    createdAt: 'created_at', updatedAt: 'updated_at',
};

function toCompany(row, admins = []) {
    const c = camelRow(row);
    if (!c) return null;
    c.defaultWorkspace = c.defaultWorkspaceId; delete c.defaultWorkspaceId;
    c.admins = admins.map((a) => ({ user: a.user_id, role: a.role, assignedAt: a.assigned_at }));
    c.isAdmin = (userId) => c.admins.some((a) => a.user === str(userId));
    c.isOwner = (userId) => c.admins.some((a) => a.user === str(userId) && a.role === 'owner');
    return c;
}

async function loadAdmins(companyId) {
    const { rows } = await query('SELECT user_id, role, assigned_at FROM company_admins WHERE company_id = $1', [str(companyId)]);
    return rows;
}

async function findById(id) {
    const { rows } = await query('SELECT * FROM companies WHERE id = $1', [str(id)]);
    return rows[0] ? toCompany(rows[0], await loadAdmins(id)) : null;
}

async function findByDomain(domain, { activeOnly = true } = {}) {
    const { rows } = await query(
        `SELECT * FROM companies WHERE lower(domain) = lower($1)${activeOnly ? ' AND is_active = true' : ''}`,
        [String(domain)]
    );
    return rows[0] ? toCompany(rows[0], await loadAdmins(rows[0].id)) : null;
}

async function findManyByIds(ids) {
    const unique = [...new Set((ids || []).map(str).filter(Boolean))];
    if (!unique.length) return new Map();
    const { rows } = await query('SELECT * FROM companies WHERE id = ANY($1)', [unique]);
    return new Map(rows.map((r) => [r.id, toCompany(r)]));
}

async function create(company) {
    const id = str(company._id || company.id) || newId();
    const admins = company.admins || [];
    const { cols, params } = columnsFor({ ...company, _id: undefined, id, admins: undefined }, COLUMNS);
    const { rows } = await query(insertSql('companies', cols), params);
    for (const a of admins) await addAdmin(id, a.user, a.role || 'admin');
    return toCompany(rows[0], await loadAdmins(id));
}

async function update(id, patch) {
    const { sets, params, next } = buildUpdate(patch, COLUMNS);
    if (!sets.length) return findById(id);
    sets.push('updated_at = now()');
    const { rows } = await query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $${next} RETURNING *`, [...params, str(id)]);
    return rows[0] ? toCompany(rows[0], await loadAdmins(id)) : null;
}

async function addAdmin(companyId, userId, role = 'admin') {
    await query(
        `INSERT INTO company_admins (company_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [str(companyId), str(userId), role]
    );
}

async function removeAdmin(companyId, userId) {
    await query('DELETE FROM company_admins WHERE company_id = $1 AND user_id = $2', [str(companyId), str(userId)]);
}

async function count(filter = {}) {
    const where = [];
    const params = [];
    if (filter.verificationStatus) { params.push(filter.verificationStatus); where.push(`verification_status = $${params.length}`); }
    if (filter.isActive !== undefined) { params.push(!!filter.isActive); where.push(`is_active = $${params.length}`); }
    const { rows } = await query(`SELECT count(*)::int AS n FROM companies${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`, params);
    return rows[0].n;
}

async function list({ limit = 50, skip = 0, verificationStatus, search } = {}) {
    const where = [];
    const params = [];
    if (verificationStatus) { params.push(verificationStatus); where.push(`verification_status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(name ILIKE $${params.length} OR domain ILIKE $${params.length})`); }
    params.push(limit, skip);
    const { rows } = await query(
        `SELECT * FROM companies${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );
    return rows.map((r) => toCompany(r));
}

async function remove(id) {
    await query('DELETE FROM companies WHERE id = $1', [str(id)]);
}

module.exports = { COLUMNS, toCompany, findById, findByDomain, findManyByIds, create, update, addAdmin, removeAdmin, count, list, remove };

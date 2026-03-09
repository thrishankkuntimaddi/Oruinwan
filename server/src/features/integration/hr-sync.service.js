// server/src/features/integration/hr-sync.service.js
//
// Phase 4 — Enterprise Integration Layer
//
// HR Provider Connectors:
//   WorkdayConnector   — connector stub for Workday HCM
//   BambooHRConnector  — connector stub for BambooHR
//   RipplingConnector  — connector stub for Rippling HCM
//
// Sync engine:
//   runHrSync()        — pull employees from an HR provider, diff against DB,
//                        create/update/disable accordingly
//
// Architecture notes:
//   - Each connector exposes the same interface: { getEmployees() }
//   - getEmployees() returns a normalized array (see EmployeeRecord below)
//   - The sync engine is provider-agnostic — calls the same flow for all three
//   - Actual API credentials stored in Company.hrIntegration (see schema below)
//   - Full Workday/BambooHR API auth is prepared but not activated (needs client creds)

const axios = require('axios');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Department = require('../../../models/Department');
const { onboardIndividual } = require('../onboarding/onboarding.service');
const { logSecurityEvent } = require('../security/security.service');

// ============================================================================
// NORMALIZED EMPLOYEE RECORD
// ============================================================================

/**
 * @typedef {Object} EmployeeRecord
 * @property {string}  externalId   — HR system's unique user ID
 * @property {string}  email
 * @property {string}  firstName
 * @property {string}  lastName
 * @property {string}  jobTitle
 * @property {string}  department   — department name (not ID)
 * @property {string}  status       — 'active' | 'terminated'
 * @property {string}  [manager]    — manager's externalId (optional)
 */

// ============================================================================
// CONNECTOR: WORKDAY
// ============================================================================

/**
 * Workday HCM Connector
 *
 * Workday uses SOAP/REST + OAuth 2.0 (Client Credentials).
 * The Workers endpoint returns paginated employee data.
 *
 * To activate this connector, the company must supply:
 *   Company.hrIntegration.workday = {
 *     tenantId, clientId, clientSecret, apiVersion ('v39.0')
 *   }
 *
 * Reference: https://community.workday.com/sites/default/files/file-hosting/productionapi/Human_Resources/
 */
class WorkdayConnector {
    constructor(config) {
        this.tenantId = config.tenantId;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.apiVersion = config.apiVersion || 'v39.0';
        this.baseUrl = `https://${this.tenantId}.workday.com/ccx/service/${this.tenantId}/Human_Resources/${this.apiVersion}`;
    }

    /**
     * Obtain a Workday OAuth 2.0 access token.
     * @returns {Promise<string>} — Bearer token
     */
    async _getAccessToken() {
        const tokenUrl = `https://${this.tenantId}.workday.com/ccx/oauth2/${this.tenantId}/token`;
        const resp = await axios.post(tokenUrl, new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        return resp.data.access_token;
    }

    /**
     * Fetch paginated worker list from Workday REST API.
     * @returns {Promise<EmployeeRecord[]>}
     */
    async getEmployees() {
        const token = await this._getAccessToken();
        const workers = [];
        let offset = 0;
        const limit = 100;

        while (true) {
            const resp = await axios.get(`${this.baseUrl}/workers`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { offset, limit, format: 'json' },
            });

            const items = resp.data?.data || [];
            if (items.length === 0) break;

            for (const w of items) {
                workers.push({
                    externalId: w.id,
                    email: w.primaryEmail?.toLowerCase() || `${w.id}@unknown.workday`,
                    firstName: w.name?.givenName || '',
                    lastName: w.name?.familyName || '',
                    jobTitle: w.employeeData?.employeeType?.descriptor || '',
                    department: w.employeeData?.organization?.descriptor || '',
                    status: w.employeeData?.terminated ? 'terminated' : 'active',
                });
            }

            if (items.length < limit) break;
            offset += limit;
        }

        return workers;
    }
}

// ============================================================================
// CONNECTOR: BAMBOOHR
// ============================================================================

/**
 * BambooHR Connector
 *
 * BambooHR uses API key auth (Basic: apiKey + 'x').
 * Employee directory endpoint: GET /api/gateway.php/{company}/v1/employees/directory
 *
 * To activate:
 *   Company.hrIntegration.bamboohr = { companyDomain, apiKey }
 *
 * Reference: https://documentation.bamboohr.com/reference
 */
class BambooHRConnector {
    constructor(config) {
        this.companyDomain = config.companyDomain;
        this.apiKey = config.apiKey;
        this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.companyDomain}/v1`;
    }

    async getEmployees() {
        const resp = await axios.get(`${this.baseUrl}/employees/directory`, {
            auth: { username: this.apiKey, password: 'x' },
            headers: { Accept: 'application/json' },
        });

        const fields = resp.data?.employees || [];

        return fields.map(e => ({
            externalId: String(e.id),
            email: (e.workEmail || e.homeEmail || '').toLowerCase(),
            firstName: e.firstName || '',
            lastName: e.lastName || '',
            jobTitle: e.jobTitle || '',
            department: e.department || '',
            status: e.status?.toLowerCase() === 'inactive' ? 'terminated' : 'active',
        }));
    }
}

// ============================================================================
// CONNECTOR: RIPPLING
// ============================================================================

/**
 * Rippling HCM Connector
 *
 * Rippling uses OAuth 2.0 Bearer tokens.
 * Employees endpoint: GET https://api.rippling.com/platform/api/employees
 *
 * To activate:
 *   Company.hrIntegration.rippling = { accessToken }
 *
 * Reference: https://developer.rippling.com/docs
 */
class RipplingConnector {
    constructor(config) {
        this.accessToken = config.accessToken;
        this.baseUrl = 'https://api.rippling.com/platform/api';
    }

    async getEmployees() {
        const resp = await axios.get(`${this.baseUrl}/employees`, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        const employees = resp.data || [];

        return employees.map(e => ({
            externalId: e.id,
            email: (e.workEmail || e.personalEmail || '').toLowerCase(),
            firstName: e.firstName || '',
            lastName: e.lastName || '',
            jobTitle: e.roleState?.title || '',
            department: e.department?.name || '',
            status: e.roleState?.terminated ? 'terminated' : 'active',
        }));
    }
}

// ============================================================================
// CONNECTOR FACTORY
// ============================================================================

function buildConnector(provider, config) {
    switch (provider) {
        case 'workday': return new WorkdayConnector(config);
        case 'bamboohr': return new BambooHRConnector(config);
        case 'rippling': return new RipplingConnector(config);
        default:
            throw new Error(`Unknown HR provider: ${provider}`);
    }
}

// ============================================================================
// DEPARTMENT RESOLVER
// ============================================================================

async function buildDeptMap(companyId) {
    const depts = await Department.find({ company: companyId, isActive: true })
        .select('_id name').lean();
    return new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));
}

// ============================================================================
// HR SYNC ENGINE
// ============================================================================

/**
 * Run a full HR sync for a company.
 *
 * Algorithm:
 *   1. Load all employees from the HR provider
 *   2. Load all existing users for this company (indexed by scimExternalId or email)
 *   3. For each HR employee:
 *        a. If not exists → call onboardIndividual() (create + invite email)
 *        b. If exists + status:terminated → set accountStatus:'suspended'
 *        c. If exists + attributes changed → update name/title/dept
 *   4. Return sync report { created, updated, disabled, errors, warnings }
 *
 * @param {string}  companyId
 * @param {string}  provider   — 'workday' | 'bamboohr' | 'rippling'
 * @param {Object}  config     — provider-specific credentials
 * @returns {Promise<Object>}  — sync report
 */
async function runHrSync(companyId, provider, config) {
    const report = {
        provider,
        companyId: companyId.toString(),
        startedAt: new Date(),
        created: 0,
        updated: 0,
        disabled: 0,
        errors: [],
        warnings: [],
    };

    try {
        const connector = buildConnector(provider, config);
        const employees = await connector.getEmployees();

        if (employees.length === 0) {
            report.warnings.push('HR provider returned 0 employees — check credentials or permissions');
            return report;
        }

        // Build lookup maps
        const deptMap = await buildDeptMap(companyId);

        // Load all company users indexed by externalId and email
        const existingUsers = await User.find({
            companyId,
            accountStatus: { $ne: 'removed' },
        }).select('_id email accountStatus username jobTitle departments scimExternalId').lean();

        const byExtId = new Map(
            existingUsers
                .filter(u => u.scimExternalId)
                .map(u => [u.scimExternalId, u])
        );
        const byEmail = new Map(existingUsers.map(u => [u.email, u]));

        for (const emp of employees) {
            try {
                const existing = byExtId.get(emp.externalId) || byEmail.get(emp.email);

                // ── Terminated employee ─────────────────────────────────────
                if (emp.status === 'terminated') {
                    if (existing && existing.accountStatus !== 'suspended') {
                        await User.findByIdAndUpdate(existing._id, { accountStatus: 'suspended' });
                        report.disabled++;
                        logSecurityEvent({
                            companyId,
                            eventType: 'account_suspended',
                            outcome: 'success',
                            metadata: { source: `hr-sync:${provider}`, email: emp.email },
                        });
                    }
                    continue;
                }

                // ── New employee ────────────────────────────────────────────
                if (!existing) {
                    const deptId = emp.department
                        ? deptMap.get(emp.department.toLowerCase().trim())
                        : null;

                    await onboardIndividual({
                        companyId,
                        requesterRole: 'admin',
                        invitedBy: null,
                        email: emp.email,
                        firstName: emp.firstName,
                        lastName: emp.lastName,
                        companyRole: 'member',
                        departmentIds: deptId ? [deptId] : [],
                        additionalWorkspaceIds: [],
                        jobTitle: emp.jobTitle,
                    });

                    // Store external ID
                    const created = await User.findOne({ email: emp.email }).lean();
                    if (created && emp.externalId) {
                        await User.findByIdAndUpdate(created._id, { scimExternalId: emp.externalId });
                    }

                    report.created++;
                    continue;
                }

                // ── Existing employee — check for attribute drift ───────────
                const updates = {};

                if (emp.firstName && emp.lastName) {
                    const fullName = `${emp.firstName} ${emp.lastName}`.trim();
                    if (fullName !== existing.username) updates.username = fullName;
                }
                if (emp.jobTitle && emp.jobTitle !== existing.jobTitle) {
                    updates.jobTitle = emp.jobTitle;
                }
                if (emp.externalId && emp.externalId !== existing.scimExternalId) {
                    updates.scimExternalId = emp.externalId;
                }

                if (Object.keys(updates).length > 0) {
                    await User.findByIdAndUpdate(existing._id, updates);
                    report.updated++;
                }

                // Department sync (add if missing, not remove)
                if (emp.department) {
                    const deptId = deptMap.get(emp.department.toLowerCase().trim());
                    if (deptId) {
                        const alreadyIn = (existing.departments || []).map(String).includes(deptId);
                        if (!alreadyIn) {
                            const { assignMembers } = require('../departments/department.service');
                            await assignMembers(deptId, companyId.toString(), [existing._id.toString()], 'add')
                                .catch(() => { });
                        }
                    } else {
                        report.warnings.push(`Department '${emp.department}' not found for ${emp.email}`);
                    }
                }

            } catch (rowErr) {
                report.errors.push({ email: emp.email, error: rowErr.message });
            }
        }

    } catch (fatalErr) {
        report.errors.push({ email: 'FATAL', error: fatalErr.message });
    }

    report.completedAt = new Date();
    return report;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    runHrSync,
    WorkdayConnector,
    BambooHRConnector,
    RipplingConnector,
    buildConnector,
};

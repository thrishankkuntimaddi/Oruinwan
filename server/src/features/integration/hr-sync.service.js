const axios = require('axios');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Department = require('../../../models/Department');
const { onboardIndividual } = require('../onboarding/onboarding.service');
const { logSecurityEvent } = require('../security/security.service');

class WorkdayConnector {
    constructor(config) {
        this.tenantId = config.tenantId;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.apiVersion = config.apiVersion || 'v39.0';
        this.baseUrl = `https://${this.tenantId}.workday.com/ccx/service/${this.tenantId}/Human_Resources/${this.apiVersion}`;
    }

    
    async _getAccessToken() {
        const tokenUrl = `https://${this.tenantId}.workday.com/ccx/oauth2/${this.tenantId}/token`;
        const resp = await axios.post(tokenUrl, new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        return resp.data.access_token;
    }

    
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

function buildConnector(provider, config) {
    switch (provider) {
        case 'workday': return new WorkdayConnector(config);
        case 'bamboohr': return new BambooHRConnector(config);
        case 'rippling': return new RipplingConnector(config);
        default:
            throw new Error(`Unknown HR provider: ${provider}`);
    }
}

async function buildDeptMap(companyId) {
    const depts = await Department.find({ company: companyId, isActive: true })
        .select('_id name').lean();
    return new Map(depts.map(d => [d.name.toLowerCase().trim(), d._id.toString()]));
}

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

        
        const deptMap = await buildDeptMap(companyId);

        
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

                    
                    const created = await User.findOne({ email: emp.email }).lean();
                    if (created && emp.externalId) {
                        await User.findByIdAndUpdate(created._id, { scimExternalId: emp.externalId });
                    }

                    report.created++;
                    continue;
                }

                
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

module.exports = {
    runHrSync,
    WorkdayConnector,
    BambooHRConnector,
    RipplingConnector,
    buildConnector,
};

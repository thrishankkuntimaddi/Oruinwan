const logger = require('../../../utils/logger');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const identity = require('../../identity');
const org = require('../../identity/queries/org');
const { withTransaction } = require('../../shared/postgres');
const Channel = require("../channels/channel.model.js");
const _sendEmail = require('../../../utils/sendEmail');
const { logAction } = require('../../../utils/historyLogger');
const conversationKeysService = require('../../modules/conversations/conversationKeys.service');

function isValidDomain(domain) {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
}

async function processDocuments(documents) {
    const processedDocuments = [];

    if (!documents || !Array.isArray(documents)) {
        return processedDocuments;
    }

    for (const doc of documents) {
        if (doc.content && doc.name) {
            try {
                
                const base64Data = doc.content.replace(/^data:([A-Za-z-+/]+);base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                // Sanitize: basename only, strict charset, bounded length (prevents path traversal).
                const safeBase = path.basename(String(doc.name))
                    .replace(/\s+/g, '_')
                    .replace(/[^A-Za-z0-9._-]/g, '')
                    .replace(/^\.+/, '')
                    .slice(0, 100) || 'document';
                const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeBase}`;
                const mimeType = (doc.content.match(/^data:([A-Za-z-+/]+);base64,/) || [])[1] || 'application/octet-stream';

                // Object storage (GCS, or local disk through the same driver) so every
                // server instance can read the document; served via the authenticated
                // uploads proxy, which restricts verification_docs/ to platform admins.
                const objectPath = `verification_docs/${uniqueName}`;
                const { writeObject } = require('../../modules/uploads/upload.service');
                await writeObject(objectPath, buffer, {
                    contentType: mimeType,
                    metadata: { originalName: safeBase, kind: 'verification_document' },
                });

                processedDocuments.push({
                    name: safeBase,
                    url: `/api/v2/uploads/file?path=${encodeURIComponent(objectPath)}`,
                    uploadedAt: new Date()
                });
            } catch (err) {
                logger.warn('Failed to process verification document:', err.message);
            }
        }
    }

    return processedDocuments;
}

async function registerCompany(params) {
    const {
        companyName,
        adminName,
        adminEmail,
        adminPassword,
        domain,
        documents,
        personalEmail,
        phone,
        role,
        departments = [],
        workspaceName,
        workspaceDescription,
        defaultChannels = ['general', 'announcements'],
        req
    } = params;

    
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
        throw new Error('Company name, admin name, email, and password are required');
    }

    
    if (personalEmail) {
        const ids = await org.userIdsByAnyEmail(personalEmail.toLowerCase());
        const existingOwner = ids.length
            ? await org.users.findOne({ _id: { $in: ids }, userType: 'company', companyRole: 'owner' })
            : null;

        if (existingOwner) {
            throw new Error('Personal email is already linked to a registered company');
        }
    }

    if (phone) {
        const existingPhoneUser = await org.users.findOne({ phone, companyRole: 'owner' });
        const existingCompanyPhone = await org.companies.findOne({ ownerPhone: phone });

        if (existingPhoneUser || existingCompanyPhone) {
            throw new Error('Phone number is already associated with a registered company');
        }
    }

    const existingUser = await identity.users.findByEmail(adminEmail);
    if (existingUser) {
        throw new Error('Admin email already in use');
    }

    if (domain && !isValidDomain(domain)) {
        throw new Error('Invalid domain format');
    }

    if (domain) {
        const existingCompany = await org.companies.findOne({ domain });
        if (existingCompany) {
            throw new Error('Domain already registered');
        }
    }

    const processedDocuments = await processDocuments(documents);
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Company, owner account, owner link and e-mail rows: all or nothing.
    const { company, adminUser } = await withTransaction(async (tx) => {
        const company = await org.insert('companies', {
            name: companyName,
            domain: domain || null,
            domainVerified: false,
            ownerEmail: personalEmail || adminEmail,
            ownerPhone: phone || null,
            verificationStatus: 'pending',
            documents: processedDocuments,
            metadata: {
                requestedDepartments: departments,
                requestedWorkspaceName: workspaceName,
                requestedWorkspaceDescription: workspaceDescription,
                requestedChannels: defaultChannels,
                companyRole: role
            },
        }, { tx });

        let adminUser;
        try {
            adminUser = await org.insert('users', {
                username: adminName,
                email: adminEmail.toLowerCase(),
                personalEmail: personalEmail ? personalEmail.toLowerCase() : null,
                passwordHash,
                userType: 'company',
                companyId: company._id,
                companyRole: (role || 'owner').toLowerCase(),
                phone: phone || null,
                phoneCode: params.phoneCode || '+91',
                profile: { name: adminName },
                verified: true,
                accountStatus: 'pending_company',
            }, { tx });
        } catch (err) {
            throw new Error(`Failed to create admin user: ${err.message}`);
        }

        await org.addUserEmail(adminUser._id, adminEmail, { verified: true, isPrimary: true, tx });
        if (personalEmail && personalEmail !== adminEmail) {
            await org.addUserEmail(adminUser._id, personalEmail, { verified: true, tx });
        }
        await org.addCompanyAdmin(company._id, adminUser._id, 'owner', { tx });
        company.admins = [{ user: adminUser._id, role: 'owner' }];
        return { company, adminUser };
    });

    await logAction({
        userId: adminUser._id,
        action: 'company_registration_requested',
        description: `Company "${companyName}" registration submitted for verification`,
        resourceType: 'company',
        resourceId: company._id,
        companyId: company._id,
        metadata: { companyName, domain, role },
        req
    });

    return { company, adminUser };
}

/**
 * Default channels for a workspace that already exists in PostgreSQL: Mongo
 * channel documents, their encryption keys, then the workspace's
 * defaultChannels list. Runs after the identity transaction has committed.
 */
async function createDefaultChannels({ company, adminUser, workspace }) {
    const channelsToCreate = ['general', 'announcements'];
    const createdChanIds = [];
    const creationDate = new Date();

    for (const channelName of channelsToCreate) {
        const chan = new Channel({
            workspace: workspace._id,
            company: company._id,
            name: channelName,
            isDefault: true,
            createdBy: adminUser._id,
            members: [{ user: adminUser._id, joinedAt: creationDate }],
            systemEvents: [{
                type: 'channel_created',
                userId: adminUser._id,
                timestamp: creationDate
            }]
        });
        await chan.save();
        createdChanIds.push(chan._id);
    }

    await identity.workspaces.update(workspace._id, { defaultChannels: createdChanIds.map(String) });
    workspace.defaultChannels = createdChanIds;

    for (const chanId of createdChanIds) {
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: chanId.toString(),
                conversationType: 'channel',
                workspaceId: workspace._id.toString(),
                members: [adminUser._id.toString()]
            });
        } catch (keyError) {
            logger.error(`Failed to bootstrap key for channel ${chanId}:`, keyError);
            throw new Error('Failed to initialize channel encryption');
        }
    }
    return workspace;
}

/** Workspace row plus owner membership, inside the caller's transaction. */
async function insertWorkspace({ company, adminUser, deptName, deptId, isDefault, workspaceName }, tx) {
    const ws = await org.insert('workspaces', {
        company: company._id,
        type: 'company',
        name: isDefault ? workspaceName : deptName,
        description: isDefault ? 'Primary company workspace' : `${deptName} Team Workspace`,
        createdBy: adminUser._id,
        department: deptId || null,
    }, { tx });
    await org.addWorkspaceMembers(ws._id, [{ user: adminUser._id, role: 'owner' }], { tx });
    return ws;
}

async function createWorkspaceWithChannels(args) {
    const ws = await withTransaction((tx) => insertWorkspace(args, tx));
    return createDefaultChannels({ ...args, workspace: ws });
}

/**
 * On approval: requested departments, the default workspace with the owner as
 * member, the company's default workspace and the owner's activation in one
 * PostgreSQL transaction; channels in MongoDB afterwards.
 * Accepts { company, adminUser } or { companyId } (the owner is looked up).
 */
async function provisionCompanyResources({ company, adminUser, companyId }) {
    const id = String(company?._id || companyId);
    company = await org.companies.findOne({ _id: id });
    if (!company) throw new Error('Company not found');
    if (!adminUser) {
        const owner = company.admins.find((a) => a.role === 'owner') || company.admins[0];
        adminUser = owner ? await identity.users.findById(owner.user) : null;
        if (!adminUser) throw new Error('Company owner not found');
    }

    const metadata = company.metadata || {};
    const { requestedDepartments = [], requestedWorkspaceName } = metadata;
    const workspaceName = requestedWorkspaceName || `${company.name} Workspace`;

    const { defaultWorkspace, createdDepartmentIds } = await withTransaction(async (tx) => {
        const createdDepartmentIds = [];
        for (const deptName of requestedDepartments) {
            const dept = await org.insert('departments', { name: deptName, company: company._id, head: adminUser._id }, { tx });
            await org.addDepartmentMembers(dept._id, [adminUser._id], 'member', { tx });
            createdDepartmentIds.push(dept._id);
        }
        const defaultWorkspace = await insertWorkspace({ company, adminUser, isDefault: true, workspaceName }, tx);
        await org.updateCompany(company._id, { defaultWorkspace: defaultWorkspace._id }, { tx });
        await org.users.updateMany({ _id: adminUser._id }, { accountStatus: 'active' }, { tx });
        return { defaultWorkspace, createdDepartmentIds };
    });

    await createDefaultChannels({ company, adminUser, workspace: defaultWorkspace });

    return {
        defaultWorkspace,
        departments: createdDepartmentIds,
        channels: defaultWorkspace.defaultChannels
    };
}

module.exports = {
    isValidDomain,
    processDocuments,
    registerCompany,
    createWorkspaceWithChannels,
    provisionCompanyResources
};

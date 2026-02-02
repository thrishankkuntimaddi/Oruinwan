/**
 * Registration Service - Company Registration & Provisioning
 * 
 * Handles company registration workflow, document processing, verification,
 * and resource provisioning (workspaces, departments, channels).
 * This is the most complex service extracted from companyController.js
 * 
 * @module features/company-registration/registration.service
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
const Channel = require("../channels/channel.model.js");
const sendEmail = require('../../../utils/sendEmail');
const { logAction } = require('../../../utils/historyLogger');
const conversationKeysService = require('../../modules/conversations/conversationKeys.service');

/**
 * Validate domain format
 * @param {string} domain - Domain to  validate
 * @returns {boolean} Valid or not
 */
function isValidDomain(domain) {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
}

/**
 * Process uploaded documents (base64 to file system)
 * @param {Array} documents - Array of {name, content} with base64 content
 * @returns {Promise<Array>} Processed documents with file paths
 */
async function processDocuments(documents) {
    const processedDocuments = [];

    if (!documents || !Array.isArray(documents)) {
        return processedDocuments;
    }

    for (const doc of documents) {
        if (doc.content && doc.name) {
            try {
                // Strip base64 header
                const base64Data = doc.content.replace(/^data:([A-Za-z-+/]+);base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');

                const uniqueName = `${Date.now()}_${doc.name.replace(/\s+/g, '_')}`;
                const uploadDir = path.join(__dirname, '../../uploads/verification_docs');

                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const filePath = path.join(uploadDir, uniqueName);
                fs.writeFileSync(filePath, buffer);

                processedDocuments.push({
                    name: doc.name,
                    url: `/uploads/verification_docs/${uniqueName}`,
                    uploadedAt: new Date()
                });
            } catch (err) {
                console.warn(`Failed to process document ${doc.name}:`, err.message);
            }
        }
    }

    return processedDocuments;
}

/**
 * Register new company (pending verification)
 * @param {Object} params - Registration parameters
 * @returns {Promise<Object>} Created company and admin user
 */
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

    // Validation
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
        throw new Error('Company name, admin name, email, and password are required');
    }

    // Check existing personal email
    if (personalEmail) {
        const existingOwner = await User.findOne({
            $or: [
                { email: personalEmail.toLowerCase() },
                { personalEmail: personalEmail.toLowerCase() },
                { 'emails.email': personalEmail.toLowerCase() }
            ],
            userType: 'company',
            companyRole: 'owner'
        });

        if (existingOwner) {
            throw new Error('Personal email is already linked to a registered company');
        }
    }

    // Check existing phone
    if (phone) {
        const existingPhoneUser = await User.findOne({ phone, companyRole: 'owner' });
        const existingCompanyPhone = await Company.findOne({ ownerPhone: phone });

        if (existingPhoneUser || existingCompanyPhone) {
            throw new Error('Phone number is already associated with a registered company');
        }
    }

    // Check existing admin email
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
        throw new Error('Admin email already in use');
    }

    // Validate domain
    if (domain && !isValidDomain(domain)) {
        throw new Error('Invalid domain format');
    }

    // Check domain availability
    if (domain) {
        const existingCompany = await Company.findOne({ domain });
        if (existingCompany) {
            throw new Error('Domain already registered');
        }
    }

    // Process documents
    const processedDocuments = await processDocuments(documents);

    // Create company (pending verification)
    const company = new Company({
        name: companyName,
        domain: domain || null,
        domainVerified: false,
        ownerEmail: personalEmail || adminEmail,
        ownerPhone: phone || null,
        verificationStatus: 'pending',
        verificationDocuments: processedDocuments,
        metadata: {
            requestedDepartments: departments,
            requestedWorkspaceName: workspaceName,
            requestedWorkspaceDescription: workspaceDescription,
            requestedChannels: defaultChannels,
            companyRole: role
        },
        admins: []
    });

    await company.save();

    // Create admin user (pending status)
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = new User({
        username: adminName,
        email: adminEmail.toLowerCase(),
        personalEmail: personalEmail ? personalEmail.toLowerCase() : null,
        passwordHash,
        userType: 'company',
        companyId: company._id,
        companyRole: (role || 'owner').toLowerCase(), // Convert to lowercase to match enum
        phone: phone || null,
        phoneCode: params.phoneCode || '+91',
        profile: {
            name: adminName
        },
        emails: personalEmail && personalEmail !== adminEmail
            ? [{ email: personalEmail, isPrimary: false, verified: true }]
            : [],
        verified: true,
        accountStatus: 'pending_company',
        departments: []
    });

    try {
        await adminUser.save();
    } catch (err) {
        // Cleanup company if user creation fails
        await Company.findByIdAndDelete(company._id);
        throw new Error(`Failed to create admin user: ${err.message}`);
    }

    // Link admin to company
    company.admins.push({
        user: adminUser._id,
        role: 'owner'
    });
    await company.save();

    // Log action
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
 * Create workspace with default channels
 * Helper function for provisioning
 */
async function createWorkspaceWithChannels({ company, adminUser, deptName, deptId, isDefault, workspaceName }) {
    const ws = new Workspace({
        company: company._id,
        type: 'company',
        name: isDefault ? workspaceName : deptName,
        description: isDefault ? 'Primary company workspace' : `${deptName} Team Workspace`,
        createdBy: adminUser._id,
        department: deptId || undefined,
        members: [{ user: adminUser._id, role: 'owner' }]
    });
    await ws.save();

    // Create default channels
    const channelsToCreate = ['general', 'announcements'];
    const createdChanIds = [];
    const creationDate = new Date();

    for (const channelName of channelsToCreate) {
        const chan = new Channel({
            workspace: ws._id,
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

    ws.defaultChannels = createdChanIds;
    await ws.save();

    // Bootstrap conversation keys for E2EE
    for (const chanId of createdChanIds) {
        try {
            await conversationKeysService.bootstrapConversationKey({
                conversationId: chanId.toString(),
                conversationType: 'channel',
                workspaceId: ws._id.toString(),
                members: [adminUser._id.toString()]
            });
        } catch (keyError) {
            console.error(`Failed to bootstrap key for channel ${chanId}:`, keyError);
            throw new Error('Failed to initialize channel encryption');
        }
    }

    return ws;
}

/**
 * Provision company resources after verification approval
 * Creates departments, workspaces, and channels
 * @param {Object} params - Provisioning parameters
 * @returns {Promise<Object>} Provisioned resources
 */
async function provisionCompanyResources({ company, adminUser }) {
    const metadata = company.metadata || {};
    const {
        requestedDepartments = [],
        requestedWorkspaceName,
        requestedChannels = ['general', 'announcements']
    } = metadata;

    const createdDepartmentIds = [];
    const workspaceName = requestedWorkspaceName || `${company.name} Workspace`;

    // Create requested departments (without auto-workspaces)
    for (const deptName of requestedDepartments) {
        const dept = new Department({
            name: deptName,
            company: company._id,
            head: adminUser._id,
            members: [adminUser._id],
            createdAt: new Date()
        });
        await dept.save();
        createdDepartmentIds.push(dept._id);
    }

    // Create DEFAULT workspace for entire company
    const defaultWorkspace = await createWorkspaceWithChannels({
        company,
        adminUser,
        isDefault: true,
        workspaceName
    });

    // Link default workspace to company
    company.defaultWorkspace = defaultWorkspace._id;

    // Update admin user with workspace and departments
    adminUser.workspaces = [{
        workspace: defaultWorkspace._id,
        role: 'owner'
    }];
    adminUser.departments = createdDepartmentIds;
    adminUser.accountStatus = 'active'; // Activate account

    await adminUser.save();
    await company.save();

    return {
        defaultWorkspace,
        departments: createdDepartmentIds,
        channels: defaultWorkspace.defaultChannels
    };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
    isValidDomain,
    processDocuments,
    registerCompany,
    createWorkspaceWithChannels,
    provisionCompanyResources
};

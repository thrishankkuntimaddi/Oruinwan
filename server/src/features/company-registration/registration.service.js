const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
const Company = require('../../../models/Company');
const Workspace = require('../../../models/Workspace');
const Department = require('../../../models/Department');
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

    
    if (phone) {
        const existingPhoneUser = await User.findOne({ phone, companyRole: 'owner' });
        const existingCompanyPhone = await Company.findOne({ ownerPhone: phone });

        if (existingPhoneUser || existingCompanyPhone) {
            throw new Error('Phone number is already associated with a registered company');
        }
    }

    
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
        throw new Error('Admin email already in use');
    }

    
    if (domain && !isValidDomain(domain)) {
        throw new Error('Invalid domain format');
    }

    
    if (domain) {
        const existingCompany = await Company.findOne({ domain });
        if (existingCompany) {
            throw new Error('Domain already registered');
        }
    }

    
    const processedDocuments = await processDocuments(documents);

    
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

    
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = new User({
        username: adminName,
        email: adminEmail.toLowerCase(),
        personalEmail: personalEmail ? personalEmail.toLowerCase() : null,
        passwordHash,
        userType: 'company',
        companyId: company._id,
        companyRole: (role || 'owner').toLowerCase(), 
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
        
        await Company.findByIdAndDelete(company._id);
        throw new Error(`Failed to create admin user: ${err.message}`);
    }

    
    company.admins.push({
        user: adminUser._id,
        role: 'owner'
    });
    await company.save();

    
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

async function provisionCompanyResources({ company, adminUser }) {
    const metadata = company.metadata || {};
    const {
        requestedDepartments = [],
        requestedWorkspaceName,
        _requestedChannels = ['general', 'announcements']
    } = metadata;

    const createdDepartmentIds = [];
    const workspaceName = requestedWorkspaceName || `${company.name} Workspace`;

    
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

    
    const defaultWorkspace = await createWorkspaceWithChannels({
        company,
        adminUser,
        isDefault: true,
        workspaceName
    });

    
    company.defaultWorkspace = defaultWorkspace._id;

    
    adminUser.workspaces = [{
        workspace: defaultWorkspace._id,
        role: 'owner'
    }];
    adminUser.departments = createdDepartmentIds;
    adminUser.accountStatus = 'active'; 

    await adminUser.save();
    await company.save();

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

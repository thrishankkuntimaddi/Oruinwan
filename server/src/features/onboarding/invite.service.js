const crypto = require('crypto');
const User = require('../../../models/User');
const sendEmail = require('../../../utils/sendEmail');
const { inviteTemplate } = require('../../../utils/emailTemplates');

const INVITE_EXPIRY_MS = 72 * 60 * 60 * 1000;

function _sha256(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

async function createInviteToken(user) {
    const rawToken = crypto.randomBytes(32).toString('hex'); 
    const tokenHash = _sha256(rawToken);

    user.inviteToken = tokenHash;
    user.inviteTokenExpiry = new Date(Date.now() + INVITE_EXPIRY_MS);
    user.inviteEmailStatus = 'pending';

    await user.save();
    return rawToken; 
}

async function sendInviteEmail(toEmail, companyName, rawToken, options = {}) {
    const { name = '', jobTitle = '' } = options;

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${rawToken}`;
    const tpl = inviteTemplate(name, companyName, inviteLink, { jobTitle });
    try {
        await sendEmail({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text });
        return { sent: true };
    } catch (err) {
        console.warn('[INVITE] Email failed for', toEmail, '—', err.message);
        return { sent: false, reason: err.message };
    }
}

async function acceptInvite(rawToken, password) {
    if (!rawToken || !password) {
        throw Object.assign(new Error('Token and password are required.'), { status: 400 });
    }
    if (password.length < 8) {
        throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 400 });
    }

    const tokenHash = _sha256(rawToken);

    const user = await User.findOne({
        inviteToken: tokenHash,
        inviteTokenExpiry: { $gt: new Date() },  
    });

    if (!user) {
        throw Object.assign(new Error('Invalid or expired invite link. Please ask your admin to resend the invite.'), { status: 400 });
    }

    if (user.accountStatus === 'active') {
        
        
        
        if (user.inviteToken || user.inviteTokenExpiry) {
            user.inviteToken = null;
            user.inviteTokenExpiry = null;
            await user.save();
        }
        
        return { user: _safeUser(user), alreadyActive: true };
    }

    
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    
    user.passwordHash = passwordHash;
    user.accountStatus = 'active';
    user.verified = true;
    user.inviteToken = null;
    user.inviteTokenExpiry = null;
    user.inviteEmailStatus = 'accepted';

    await user.save();

    
    if (user.companyId) {
        const { logSecurityEvent } = require('../security/security.service');
        logSecurityEvent({
            companyId: user.companyId,
            actorId: user._id,
            eventType: 'invite_accepted',
            outcome: 'success',
            metadata: { email: user.email },
        });
    }

    

    
    if (user.departments && user.departments.length > 0 && user.companyId) {
        try {
            const { assignMembers } = require('../departments/department.service');
            await assignMembers(
                user.departments[0].toString(), 
                user.companyId.toString(),
                [user._id.toString()],
                'add'
            );
            
            for (let i = 1; i < user.departments.length; i++) {
                await assignMembers(
                    user.departments[i].toString(),
                    user.companyId.toString(),
                    [user._id.toString()],
                    'add'
                );
            }
        } catch (err) {
            
            console.warn('[INVITE] assignMembers failed on acceptance:', err.message);
        }
    }

    return { user: _safeUser(user), alreadyActive: false };
}

async function resendInvite(userId, companyId) {
    const user = await User.findOne({
        _id: userId,
        companyId,
        accountStatus: 'invited',
    });

    if (!user) {
        throw Object.assign(
            new Error('User not found or already active. Only pending invites can be resent.'),
            { status: 404 }
        );
    }

    
    const Company = require('../../../models/Company');
    const company = await Company.findById(companyId).lean();
    if (!company) throw Object.assign(new Error('Company not found.'), { status: 404 });

    
    const rawToken = await createInviteToken(user);

    const emailResult = await sendInviteEmail(user.email, company.name, rawToken, {
        name: user.username || '',
        jobTitle: user.jobTitle || '',
    });

    
    user.inviteEmailStatus = emailResult.sent ? 'sent' : 'failed';
    await user.save();

    return { sent: emailResult.sent };
}

function _safeUser(user) {
    return {
        _id: user._id,
        username: user.username,
        email: user.email,
        companyRole: user.companyRole,
        accountStatus: user.accountStatus,
    };
}

module.exports = {
    createInviteToken,
    sendInviteEmail,
    acceptInvite,
    resendInvite,
    _sha256, 
};

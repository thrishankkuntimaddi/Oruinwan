'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
// Identity lives in PostgreSQL; userDocs returns a mutable user document with save() (see identity/queries/auth.js).
const identity = require('../../identity');
const { userDocs, emailTaken, companyByAllowedEmail, companyForAutoJoin, invites } = require('../../identity/queries/auth');
const sendEmail = require('../../../utils/sendEmail');
const {
  passwordResetTemplate,
  passwordSetTemplate,
  verifyEmailTemplate,
  reactivateAccountTemplate,
  emailVerificationTemplate,
  generateVerificationCode,
} = require('../../../utils/emailTemplates');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const { saveWithRetry } = require('../../../utils/mongooseRetry');
const { setRefreshTokenCookie, clearRefreshTokenCookie, isNativeClient, getRefreshTokenFromRequest } = require('../../../utils/cookieHelper');
const { sha256 } = require('../../../utils/hashUtils');
const { handleError } = require('../../../utils/responseHelpers');
const logger = require('../../shared/utils/logger');
const { parseDeviceInfo, getClientIP } = require('../../../utils/deviceParser');
const AuditLog = require('../../../models/AuditLog');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10);

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      roles: user.roles,
      
      
      
      
      companyRole: user.companyRole || null
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken(user) {
  // jti makes every refresh token unique: two issued in the same second for the same
  // user would otherwise hash to the same stored row.
  return jwt.sign(
    { sub: user._id.toString(), jti: crypto.randomBytes(9).toString('base64url') },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: `${REFRESH_DAYS}d` }
  );
}

exports.signup = async (req, res) => {
  logger.debug('signup invoked');
  try {
    const { username, email, password, phone, phoneCode, inviteToken } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    if (await emailTaken(email))
      return res.status(409).json({ message: "Email already in use" });

    
    if (await identity.users.findByUsername(username))
      return res.status(409).json({ message: "Username already in use" });

    
    if (phone) {
      const existingPhone = await identity.users.findByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({ message: "Phone number already in use" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(rawToken);

    
    let userType = "personal";
    let companyId = null;
    let companyRole = "member";
    let workspacesToJoin = [];
    let assignedDepartment = null;
    let assignedManager = null;

    

    const emailLower = email.toLowerCase();
    const Channel = require("../channels/channel.model.js");

    
    const extractDomain = (email) => {
      const match = email.match(/@(.+)$/);
      return match ? match[1].toLowerCase() : null;
    };

    
    if (inviteToken) {
      const inviteHash = sha256(inviteToken);
      const invite = await invites.findUsable(inviteHash, emailLower);

      if (invite) {
        userType = "company";
        companyId = invite.company;
        companyRole = invite.role && invite.role !== "owner" ? invite.role : "member"; // never grants ownership
        assignedDepartment = invite.department;
        assignedManager = invite.metadata?.managerId;

        if (invite.workspace) {
          workspacesToJoin.push(invite.workspace);
        }

        
        await invites.update(invite._id, { status: 'accepted', used: true, usedBy: null, usedAt: new Date() });
      } else {
        
      }
    }

    
    if (!companyId) {
      const companyWithAllowedEmail = await companyByAllowedEmail(emailLower);

      if (companyWithAllowedEmail) {
        userType = "company";
        companyId = companyWithAllowedEmail._id;
        companyRole = companyWithAllowedEmail.invitePolicy?.defaultRole || "member";

        if (companyWithAllowedEmail.defaultWorkspace) {
          workspacesToJoin.push(companyWithAllowedEmail.defaultWorkspace);
        }

      }
    }

    
    if (!companyId) {
      const domain = extractDomain(emailLower);

      if (domain) {
        const companyWithDomain = await companyForAutoJoin(domain);

        if (companyWithDomain) {
          userType = "company";
          companyId = companyWithDomain._id;
          companyRole = companyWithDomain.invitePolicy?.defaultRole || "member";

          if (companyWithDomain.defaultWorkspace) {
            workspacesToJoin.push(companyWithDomain.defaultWorkspace);
          }

        }
      }
    }

    

    

    const user = userDocs.build({
      username,
      email: emailLower,
      phone: phone || null,
      phoneCode: phoneCode || "+1",
      passwordHash,
      userType,
      companyId,
      companyRole,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: Date.now() + 86400000,
      verified: false, 
      departments: assignedDepartment ? [assignedDepartment] : [],
      reportsTo: assignedManager
    });

    
    
    
    const AVATAR_POOL = [
      
      ['lorelei-neutral', 'Alexandra'], ['lorelei-neutral', 'Jordan'], ['lorelei-neutral', 'Morgan'],
      ['lorelei-neutral', 'Cameron'], ['lorelei-neutral', 'Avery'], ['lorelei-neutral', 'Quinn'],
      ['lorelei-neutral', 'Riley'], ['lorelei-neutral', 'Reese'], ['lorelei-neutral', 'Sage'],
      ['lorelei-neutral', 'Emery'], ['lorelei-neutral', 'Parker'], ['lorelei-neutral', 'Hayden'],
      ['lorelei-neutral', 'Finley'], ['lorelei-neutral', 'River'], ['lorelei-neutral', 'Kendall'],
      
      ['notionists-neutral', 'Atlas'], ['notionists-neutral', 'Cleo'], ['notionists-neutral', 'Darwin'],
      ['notionists-neutral', 'Elliot'], ['notionists-neutral', 'Fable'], ['notionists-neutral', 'Glen'],
      ['notionists-neutral', 'Haven'], ['notionists-neutral', 'Inigo'], ['notionists-neutral', 'Jules'],
      ['notionists-neutral', 'Knox'], ['notionists-neutral', 'Lael'], ['notionists-neutral', 'Maren'],
      ['notionists-neutral', 'Noel'], ['notionists-neutral', 'Orion'], ['notionists-neutral', 'Piper'],
      
      ['micah', 'Adam'], ['micah', 'Benjamin'], ['micah', 'Charles'], ['micah', 'Daniel'],
      ['micah', 'Edward'], ['micah', 'Francis'], ['micah', 'George'], ['micah', 'Hannah'],
      ['micah', 'Isabelle'], ['micah', 'Julian'], ['micah', 'Katrina'], ['micah', 'Leonard'],
      ['micah', 'Margaret'], ['micah', 'Nathan'], ['micah', 'Olivia'],
      
      ['identicon', 'Alpha01'], ['identicon', 'Beta02'], ['identicon', 'Gamma03'], ['identicon', 'Delta04'],
      ['identicon', 'Epsilon05'], ['identicon', 'Zeta06'], ['identicon', 'Eta07'], ['identicon', 'Theta08'],
      ['identicon', 'Iota09'], ['identicon', 'Kappa10'], ['identicon', 'Lambda11'], ['identicon', 'Mu12'],
      ['identicon', 'Nu13'], ['identicon', 'Xi14'], ['identicon', 'Omicron15'],
      
      ['rings', 'Cobalt'], ['rings', 'Crimson'], ['rings', 'Dune'], ['rings', 'Eclipse'],
      ['rings', 'Flux'], ['rings', 'Granite'], ['rings', 'Horizon'], ['rings', 'Indigo'],
      ['rings', 'Jasper'], ['rings', 'Lunar'], ['rings', 'Marble'], ['rings', 'Nordic'],
      ['rings', 'Onyx'], ['rings', 'Prism'],
      
      ['shapes', 'Apex'], ['shapes', 'Bolt'], ['shapes', 'Core'], ['shapes', 'Drive'],
      ['shapes', 'Edge'], ['shapes', 'Forge'], ['shapes', 'Grid'], ['shapes', 'Hub'],
      ['shapes', 'Ion'], ['shapes', 'Jolt'], ['shapes', 'Key'], ['shapes', 'Link'],
      ['shapes', 'Matrix'], ['shapes', 'Node'],
      
      ['miniavs', 'Prof1'], ['miniavs', 'Prof2'], ['miniavs', 'Prof3'], ['miniavs', 'Prof4'],
      ['miniavs', 'Prof5'], ['miniavs', 'Prof6'], ['miniavs', 'Prof7'], ['miniavs', 'Prof8'],
      ['miniavs', 'Prof9'], ['miniavs', 'Prof10'], ['miniavs', 'Prof11'], ['miniavs', 'Prof12'],
      ['miniavs', 'Prof13'], ['miniavs', 'Prof14'], ['miniavs', 'Prof15'], ['miniavs', 'Prof16'],
    ];
    const [style, seed] = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
    user.profilePicture = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=200`;

    await saveWithRetry(user);

    

    // An invite to a personal (company-less) workspace joins it too; it was consumed above.
    if (workspacesToJoin.length > 0) {
      for (const workspaceId of workspacesToJoin) {
        const workspace = await identity.workspaces.findById(workspaceId);

        if (workspace && !workspace.isMember(user._id)) {
          await identity.workspaces.addMember(workspace._id, user._id, { role: 'member' });

          require('../../shared/events/bus').publish('member.joined', { userId: String(user._id), role: 'member', source: 'registration' },
            { workspaceId: workspace._id, companyId: workspace.company || companyId, actorId: user._id }).catch(() => {});

          
          user.workspaces.push({
            workspace: workspaceId,
            role: "member"
          });

          
          const defaultChannels = await Channel.find({
            workspace: workspaceId,
            isDefault: true
          });

          for (const channel of defaultChannels) {
            
            const isAlreadyMember = channel.members.some(m => {
              const memberId = m.user ? m.user.toString() : m.toString();
              return memberId === user._id.toString();
            });

            if (!isAlreadyMember) {
              
              channel.members = channel.members.map(m => {
                if (m.user) return m;
                return {
                  user: m,
                  joinedAt: channel.createdAt || new Date()
                };
              });

              channel.members.push({
                user: user._id,
                joinedAt: new Date()
              });
              await channel.save();

            }
          }

        }
      }

      await saveWithRetry(user);
    }

    
    

    

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;

    
    try {
      const emailTpl = verifyEmailTemplate(username, verifyUrl);
      await sendEmail({
        to: email,
        subject: emailTpl.subject,
        html: emailTpl.html,
        text: emailTpl.text,
      });
      logger.info({ email }, 'Verification email sent');
    } catch (_emailError) {
      if (process.env.NODE_ENV === 'production') {
        // Never log tokens in production; the user can request a resend.
        logger.error({ err: _emailError.message, email }, 'Verification email could not be sent');
      } else {
        logger.warn({ err: _emailError.message }, 'Email delivery failed — logging verification link (development only)');
        logger.info({ email, verifyUrl }, 'EMAIL VERIFICATION LINK');
      }
    }

    return res.status(201).json({
      message: "Signup successful, verify your email.",
      userType,
      companyId: companyId || null
    });

  } catch (_err) {
    return handleError(res, _err, "SIGNUP ERROR");
  }
};

exports.verifyEmail = async (req, res) => {
  logger.debug('verifyEmail invoked');
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ message: "Missing token or email" });
    }

    const tokenHash = sha256(token);

    const user = await userDocs.findByVerificationToken(email, tokenHash);

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;
    // The sign-up address is the primary entry in the user's email list: verified now too.
    for (const e of user.emails || []) if (e.email === String(user.email).toLowerCase()) e.verified = true;

    await saveWithRetry(user);

    return res.json({ message: "Email verified" });
  } catch (_err) {
    logger.error({ err: _err }, '[VERIFY EMAIL] failed');
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  logger.debug('login invoked');
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    
    
    

    
    const matchDomain = email.match(/@(.+)$/);
    const domain = matchDomain ? matchDomain[1].toLowerCase() : null;
    let isCompanyAccount = false;
    let targetCompanyId = null;


    
    
    
    if (domain) {
      
      const company = await identity.companies.findByDomain(domain);
      if (company) {
        if (company.verificationStatus === 'rejected') {
          return res.status(403).json({ message: `Company domain ${domain} is rejected. Contact support.` });
        }
        isCompanyAccount = true;
        targetCompanyId = company._id;
      }
    }

    
    
    const user = await userDocs.findByEmail(email);
    // The login flow reads the company through user.companyId (populate in the old model).
    if (user && user.companyId) user.companyId = (await identity.companies.findById(user.companyId)) || user.companyId;

    if (!user) {
      
      return res.status(400).json({ message: "Invalid credentials" });
    }

    
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      });
    }

    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedLoginAttempts = 0;
        logger.warn({ email: user.email }, '[LOGIN] Account locked after 5 failed attempts');
      }

      await user.save();

      
      if (user.companyId) {
        const { logSecurityEvent } = require('../security/security.service');
        logSecurityEvent({
          companyId: user.companyId._id || user.companyId,
          actorId: user._id,
          eventType: 'login_failure',
          outcome: 'failure',
          metadata: { email: user.email, attempts: user.failedLoginAttempts },
          req,
        });
      }

      return res.status(400).json({ message: "Invalid credentials" });
    }

    
    if (user.authProvider && user.authProvider !== 'local' && !user.passwordLoginEnabled) {
      return res.status(403).json({
        message: "Password login has been disabled for this account. Please use OAuth login."
      });
    }

    
    if (user.deactivatedAt) {
      
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      
      if (!user.otpCodes) {
        user.otpCodes = [];
      }

      
      user.otpCodes.push({
        code: otpCode,
        type: 'reactivation',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), 
        used: false
      });

      await user.save();
      logger.info({ email }, '[LOGIN] OTP saved for deactivated user reactivation');

      
      try {
        const reactivateTpl = reactivateAccountTemplate(user.username, otpCode);
        await sendEmail({
          to: user.email,
          subject: reactivateTpl.subject,
          html: reactivateTpl.html,
          text: reactivateTpl.text,
        });
      } catch (emailErr) {
        logger.error({ err: emailErr }, 'Failed to send reactivation OTP email');
      }

      return res.status(403).json({
        message: "Account is deactivated",
        requiresReactivation: true,
        email: user.email
      });
    }

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email first" });

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ message: "Account Suspended." });
    }

    // Two-factor: the password was right, now the authenticator code is required too.
    // Wrong codes count as failed attempts, so the usual lockout also stops code guessing.
    if (user.twoFactorEnabled) {
      const otp = String(req.body.otp || '').replace(/\s+/g, '');
      if (!otp) {
        return res.status(401).json({ requires2FA: true, message: "Enter the 6-digit code from your authenticator app." });
      }
      const withSecret = user;
      const { verifyUserTotp } = require('../security/totp');
      if (!(await verifyUserTotp(withSecret?.twoFactorSecret, otp))) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          user.failedLoginAttempts = 0;
          logger.warn({ email: user.email }, '[LOGIN] Account locked after 5 failed 2FA codes');
        }
        await user.save();
        return res.status(401).json({ requires2FA: true, invalidCode: true, message: "That code didn't work. Check your authenticator app and try again." });
      }
    }

    let redirectTo = "/workspaces";
    let isAdmin = false;

    if (isCompanyAccount) {
      
      if (!user.companyId || user.companyId._id.toString() !== targetCompanyId.toString()) {
        
        
        
        
      }

      
      const role = user.companyRole; 

      
      const company = user.companyId; 
      const needsSetup = company && !company.isSetupComplete;

      if (role === 'owner' || role === 'admin') {
        isAdmin = true;

        if (needsSetup) {
          
          if (!company.setupStep || company.setupStep === 0) {
            redirectTo = "/company/confirm";  
          } else {
            redirectTo = "/company/setup";    
          }
        } else {
          
          if (role === 'owner') {
            redirectTo = "/owner/dashboard";
          } else {
            redirectTo = "/admin/dashboard";
          }
        }
      } else if (role === 'manager') {
        redirectTo = "/manager/dashboard";
      } else {
        
        redirectTo = "/workspaces";
      }
    } else {
      
      redirectTo = "/workspaces";
    }

    
    if (user.roles && user.roles.includes('chttrix_admin')) {
      redirectTo = "/platform-admin";
    }

    
    
    

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = sha256(refreshToken);

    
    if (user.refreshTokens.length >= 3) {
      user.refreshTokens.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      while (user.refreshTokens.length >= 3) {
        user.refreshTokens.shift();
      }
    }

    user.refreshTokens.push({
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      deviceInfo: req.get("User-Agent") || "Unknown",
      ip: getClientIP(req),
      startedAt: new Date(),
    });

    
    const isFirstLogin = user.lastLoginAt === null || user.lastLoginAt === undefined;

    
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    user.lastLoginAt = new Date();
    user.isOnline = true;

    
    user.lastLoginMethod = 'password';
    user.lastLoginMethodAt = new Date();

    await saveWithRetry(user);
    setRefreshTokenCookie(res, refreshToken);

    
    if (user.companyId) {
      const { logSecurityEvent } = require('../security/security.service');
      logSecurityEvent({
        companyId: user.companyId._id || user.companyId,
        actorId: user._id,
        eventType: 'login_success',
        outcome: 'success',
        metadata: { email: user.email, method: 'password' },
        req,
      });
    }

    
    const responseUser = {
      id: user._id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      verified: user.verified,
      userType: user.userType,
      companyId: user.companyId ? user.companyId._id : null,
      companyRole: user.companyRole,
      profilePicture: user.profilePicture,
      userStatus: user.userStatus,
      preferences: user.preferences,
      
      isTemporaryPassword: user.isTemporaryPassword || false,
      passwordInitialized: user.passwordInitialized !== false, 
    };

    const response = {
      message: "Login successful",
      accessToken,
      
      
      
      user: responseUser,
      redirectTo: redirectTo,
      isAdmin: isAdmin
    };

    // Native mobile clients cannot read the httpOnly cookie — hand them the refresh token in the body.
    if (isNativeClient(req)) {
      response.refreshToken = refreshToken;
    }

    
    if (user.companyId) {
      response.company = {
        id: user.companyId._id,
        name: user.companyId.name,
        domain: user.companyId.domain,
        defaultWorkspace: user.companyId.defaultWorkspace,
        isSetupComplete: user.companyId.isSetupComplete,
        verificationStatus: user.companyId.verificationStatus
      };
      response.user.companyStatus = user.companyId.verificationStatus;

      
      if (user.companyId.verificationStatus === 'pending') {
        response.redirectTo = "/pending-verification";
      }
    }

    
    
    
    
    if (user.isTemporaryPassword && !user.passwordInitialized) {
      response.redirectTo = '/setup-password';
      response.requiresPasswordSetup = true;
    }
    

    return res.json(response);

  } catch (_err) {
    return handleError(res, _err, "LOGIN ERROR");
  }
};

exports.refresh = async (req, res) => {
  logger.debug('refresh invoked');
  const MAX_RETRIES = 3;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      
      // Web: httpOnly cookie only. Native (x-client-platform: ios|android): body.refreshToken (cookie fallback).
      const nativeClient = isNativeClient(req);
      const refreshToken = getRefreshTokenFromRequest(req);

      if (!refreshToken) {
        logger.warn('[REFRESH] No refresh token found');
        return res.status(401).json({ message: 'No refresh token' });
      }

      logger.debug({ native: nativeClient }, '[REFRESH] Token source');

      const refreshHash = sha256(refreshToken);

      const user = await identity.users.findByRefreshTokenHash(refreshHash);

      if (!user) {
        logger.warn('[REFRESH] Invalid refresh token — no user found');
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      // A rotated token past its grace period (or any expired one) is dead even before cleanup.
      if (!user.refreshToken?.expiresAt || new Date(user.refreshToken.expiresAt) <= new Date()) {
        logger.warn('[REFRESH] Refresh token expired');
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      logger.debug({ email: user.email }, '[REFRESH] User found');

      
      try {
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        logger.debug('[REFRESH] JWT signature valid');
      } catch (_err) {
        logger.warn({ err: _err.message }, '[REFRESH] Invalid JWT signature');
        return res.status(403).json({ message: 'Invalid refresh token signature' });
      }

      const newAccess = generateAccessToken(user);
      const newRefresh = generateRefreshToken(user);

      logger.debug('[REFRESH] New tokens generated');

      // Row-level writes (no whole-document save): two tabs refreshing at once must
      // not drop each other's new token. The old token lives on for a 30 s grace period.
      const graceEnd = new Date(Date.now() + 30000);
      if (new Date(user.refreshToken.expiresAt) > graceEnd) await identity.users.expireRefreshToken(refreshHash, graceEnd);
      await identity.users.addRefreshToken(user._id, {
        tokenHash: sha256(newRefresh),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
        deviceInfo: req.get('User-Agent') || 'Unknown',
        ip: getClientIP(req),
        // The rotated token continues the same session: keep when it started.
        startedAt: user.refreshToken?.startedAt || new Date(),
      });
      await identity.users.pruneRefreshTokens(user._id);
      logger.debug('[REFRESH] User tokens persisted');

      
      setRefreshTokenCookie(res, newRefresh);

      logger.debug('[REFRESH] Token refresh completed successfully');
      const refreshResponse = { accessToken: newAccess };
      if (nativeClient) refreshResponse.refreshToken = newRefresh;
      return res.json(refreshResponse);

    } catch (_err) {
      if (_err.name === 'VersionError' && attempts < MAX_RETRIES - 1) {
        logger.warn({ attempt: attempts + 1, max: MAX_RETRIES }, '[REFRESH] VersionError — retrying');
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      logger.error({ err: _err }, '[REFRESH] ERROR');
      return res.status(500).json({ message: 'Server error' });
    }
  }
};

exports.logout = async (req, res) => {
  try {
    const token = getRefreshTokenFromRequest(req);
    if (!token) return res.json({ message: "Logged out" });

    const hash = sha256(token);

    await identity.users.deleteRefreshToken(hash);

    clearRefreshTokenCookie(res);

    return res.json({ message: "Logged out" });
  } catch (_err) {
    return handleError(res, _err, "LOGOUT ERROR");
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const token = getRefreshTokenFromRequest(req);
    if (!token) return res.json({ message: "Logged out from all devices" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      clearRefreshTokenCookie(res);
      return res.json({ message: "Logged out" });
    }

    
    
    
    
    const tokenHash = sha256(token);
    const user = await identity.users.findByRefreshTokenHash(tokenHash);

    if (!user) {
      
      clearRefreshTokenCookie(res);
      return res.json({ message: 'Logged out' });
    }

    await identity.users.deleteAllRefreshTokens(decoded.sub);

    clearRefreshTokenCookie(res);

    return res.json({ message: "Logged out from all devices" });

  } catch (_err) {
    return handleError(res, _err, "LOGOUT ALL ERROR");
  }
};

exports.forgotPassword = async (req, res) => {
  logger.info('🔄 [MODULAR AUTH] Function invoked: forgotPassword');
  try {
    const { email } = req.body;

    const user = await userDocs.findByEmail(email);

    if (!user) {

      return res.json({ message: "If that email exists, reset link sent" });
    }

    const raw = crypto.randomBytes(32).toString("hex");
    const hash = sha256(raw);

    user.resetPasswordTokenHash = hash;
    user.resetPasswordExpires = Date.now() + 3600000;
    await saveWithRetry(user);

    const url = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&email=${encodeURIComponent(email)}`;

    
    try {
      const template = passwordResetTemplate(user.username, url);
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      logger.info(`✅ Password reset email sent to ${email}`);
    } catch (_emailError) {
      if (process.env.NODE_ENV === 'production') {
        logger.error({ err: _emailError.message, email }, 'Password reset email could not be sent');
      } else {
        logger.warn({ err: _emailError.message, email, resetUrl: url }, 'PASSWORD RESET LINK (development only)');
      }
    }

    return res.json({ message: "Reset link sent if account exists" });
  } catch (_err) {
    logger.error("FORGOT ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  logger.info('🔄 [MODULAR AUTH] Function invoked: resetPassword');
  try {
    const { token, email, password } = req.body;

    const found = token ? await userDocs.findByResetToken(sha256(token)) : null;
    const user = found && String(found.email).toLowerCase() === String(email || '').toLowerCase() ? found : null;

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];

    await saveWithRetry(user);

    return res.json({ message: "Password reset successful" });

  } catch (_err) {
    logger.error("RESET ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

const THEMES = ['light', 'dark', 'auto'];
const TEXT_SIZES = ['small', 'default', 'large', 'larger'];

/**
 * True when the account has a password the user chose (or was given). OAuth sign-ups get a
 * random or placeholder hash they never learn, so those only count once passwordSetAt is set.
 */
function computeHasPassword(user) {
  const hash = user?.passwordHash;
  if (!hash || typeof hash !== 'string' || !hash.startsWith('$2')) return false;
  if (user.authProvider && user.authProvider !== 'local' && !user.passwordSetAt) return false;
  return true;
}

/** preferences as the client sees them, with every default filled in. */
function serializePreferences(prefs) {
  const { privacyWithDefaults } = require('./privacy.service');
  const { regionWithDefaults } = require('./accountPreferences');
  const { NOTIFICATION_PREF_DEFAULTS } = require('./notificationPreferences');
  const p = prefs && typeof prefs.toObject === 'function' ? prefs.toObject() : (prefs || {});
  const notifications = { ...NOTIFICATION_PREF_DEFAULTS };
  for (const k of Object.keys(NOTIFICATION_PREF_DEFAULTS)) {
    if (typeof p.notifications?.[k] === 'boolean') notifications[k] = p.notifications[k];
  }
  return {
    theme: THEMES.includes(p.theme) ? p.theme : 'light',
    appearance: { textSize: TEXT_SIZES.includes(p.appearance?.textSize) ? p.appearance.textSize : 'default' },
    privacy: privacyWithDefaults(p.privacy),
    region: regionWithDefaults(p.region),
    notifications,
  };
}

exports.computeHasPassword = computeHasPassword;
exports.serializePreferences = serializePreferences;

exports.getMe = async (req, res) => {
  try {
    const userObject = await loadMe(req.user.sub);
    if (!userObject) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(userObject);
  } catch (_err) {
    logger.error("GET ME ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * The signed-in user's own record, sanitised: no secrets, plus `hasPassword` and
 * `preferences` with defaults. Used by GET /me and returned by PUT /me.
 */
async function loadMe(userId) {
    // passwordHash is loaded only to compute hasPassword; it is deleted below.
    const user = await userDocs.findById(userId);
    if (user && user.companyId) user.companyId = (await identity.companies.findById(user.companyId)) || user.companyId;

    if (!user) {
      return null;
    }

    
    if (!user.emails || user.emails.length === 0) {
      user.emails = [{
        email: user.email,
        verified: true, 
        isPrimary: true,
        addedAt: user.createdAt || new Date()
      }];
      await saveWithRetry(user);
    } else {
      
      const primaryExists = user.emails.some(e => e.isPrimary);
      if (!primaryExists) {
        
        const mainEmailEntry = user.emails.find(e => e.email === user.email);
        if (mainEmailEntry) {
          mainEmailEntry.isPrimary = true;
          await saveWithRetry(user);
        } else {
          
          user.emails.unshift({
            email: user.email,
            verified: true,
            isPrimary: true,
            addedAt: user.createdAt || new Date()
          });
          await saveWithRetry(user);
        }
      }
    }

    
    const userObject = user.toObject();

    // Defense in depth: never return secrets from /me even if a projection changes.
    for (const field of ['passwordHash', 'refreshTokens', 'twoFactorSecret', 'otpCodes', 'inviteToken',
      'resetPasswordTokenHash', 'verificationTokenHash', 'deviceTokens']) {
      delete userObject[field];
    }
    if (userObject.encryption) delete userObject.encryption.encryptedPrivateKey;

    // Reduced company object — never expose phoneOTP, domainVerificationToken, ssoConfig, etc.
    if (userObject.companyId && typeof userObject.companyId === 'object' && userObject.companyId._id) {
      const c = userObject.companyId;
      userObject.companyId = {
        _id: c._id,
        name: c.name,
        displayName: c.displayName,
        logo: c.logo,
        domain: c.domain,
        verificationStatus: c.verificationStatus,
        isSetupComplete: c.isSetupComplete,
        setupStep: c.setupStep,
        defaultWorkspace: c.defaultWorkspace,
        plan: c.plan,
        isActive: c.isActive,
      };
    }

    
    if (userObject.companyId && typeof userObject.companyId === 'object') {
      userObject.company = {
        id: userObject.companyId._id,
        name: userObject.companyId.name,
        domain: userObject.companyId.domain,
        defaultWorkspace: userObject.companyId.defaultWorkspace,
        isSetupComplete: userObject.companyId.isSetupComplete,
        setupStep: userObject.companyId.setupStep
      };
      
      
      
      
      
    }

    if (userObject.emails) {
      userObject.emails = userObject.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }));
    }

    
    if (userObject.phone && userObject.phone.startsWith('+')) {
      
      
      const phoneMatch = userObject.phone.match(/^(\+\d{1,3})(\d+)$/);

      if (phoneMatch) {
        const extractedCode = phoneMatch[1]; 
        const extractedPhone = phoneMatch[2]; 

        
        user.phoneCode = extractedCode;
        user.phone = extractedPhone;
        await saveWithRetry(user);

        
        userObject.phoneCode = extractedCode;
        userObject.phone = extractedPhone;

        logger.info(`📞 Migrated phone for user ${user.email}: ${extractedCode} ${extractedPhone}`);
      }
    } else if (userObject.phone && /^\d{11,13}$/.test(userObject.phone)) {
      
      
      let extractedCode = "+1"; 
      let extractedPhone = userObject.phone;

      
      if (userObject.phone.startsWith('91') && userObject.phone.length === 12) {
        
        extractedCode = "+91";
        extractedPhone = userObject.phone.substring(2);
      } else if (userObject.phone.startsWith('44') && userObject.phone.length === 12) {
        
        extractedCode = "+44";
        extractedPhone = userObject.phone.substring(2);
      } else if (userObject.phone.startsWith('1') && userObject.phone.length === 11) {
        
        extractedCode = "+1";
        extractedPhone = userObject.phone.substring(1);
      }

      
      user.phoneCode = extractedCode;
      user.phone = extractedPhone;
      await saveWithRetry(user);

      
      userObject.phoneCode = extractedCode;
      userObject.phone = extractedPhone;

      logger.info(`📞 Migrated phone (no prefix) for user ${user.email}: ${extractedCode} ${extractedPhone}`);
    }

    userObject.hasPassword = computeHasPassword(user);
    userObject.preferences = serializePreferences(user.preferences);
    delete userObject.passwordHash;

    return userObject;
}

const PHONE_RE = /^[0-9][0-9 -]{2,18}[0-9]$/;
const PHONE_CODE_RE = /^\+[1-9][0-9]{0,2}$/;

exports.updateMe = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (body.username !== undefined) {
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ message: "Name must be between 2 and 50 characters" });
      }
      user.username = username;
    }

    // Phone: '' or null clears it. The field has a unique sparse index, so it is unset
    // rather than stored as '' (two '' values would collide).
    let phoneChanged = false;
    if (body.phone !== undefined) {
      const raw = body.phone === null ? '' : String(body.phone).trim();
      if (raw === '') {
        user.phone = undefined;
      } else {
        const digits = raw.replace(/[\s-]/g, '');
        if (!PHONE_RE.test(raw) || raw.length < 4 || raw.length > 20 || digits.length < 4) {
          return res.status(400).json({ message: "Phone number must be 4-20 characters: digits, spaces or dashes" });
        }
        if (digits !== user.phone) {
          user.phone = digits;
          phoneChanged = true;
        }
      }
    }
    if (body.phoneCode !== undefined && body.phoneCode !== null && body.phoneCode !== '') {
      const code = String(body.phoneCode).trim();
      if (!PHONE_CODE_RE.test(code)) {
        return res.status(400).json({ message: "Country code must look like +1 to +999" });
      }
      user.phoneCode = code;
    }

    if (!user.profile) user.profile = {};

    if (body.dob !== undefined) {
      if (body.dob === '' || body.dob === null) {
        user.profile.dob = undefined;
      } else {
        const dob = new Date(body.dob);
        const today = new Date();
        if (isNaN(dob.getTime())) {
          return res.status(400).json({ message: "Invalid date of birth" });
        }
        const age = today.getFullYear() - dob.getFullYear();
        if (dob > today) {
          return res.status(400).json({ message: "Date of birth cannot be in the future" });
        }
        if (age < 13) {
          return res.status(400).json({ message: "You must be at least 13 years old" });
        }
        user.profile.dob = dob;
      }
    }

    // About: '' clears it.
    if (body.about !== undefined) {
      const about = body.about === null ? '' : String(body.about).trim();
      if (about.length > 500) {
        return res.status(400).json({ message: "About section must be 500 characters or less" });
      }
      user.profile.about = about;
    }

    if (body.address !== undefined) {
      const address = body.address === null ? '' : String(body.address).trim();
      if (address.length > 300) return res.status(400).json({ message: "Address must be 300 characters or less" });
      user.profile.address = address;
    }
    if (body.company !== undefined) {
      const company = body.company === null ? '' : String(body.company).trim();
      if (company.length > 100) return res.status(400).json({ message: "Company must be 100 characters or less" });
      user.profile.company = company;
    }
    if (body.showCompany !== undefined) {
      if (typeof body.showCompany !== 'boolean') return res.status(400).json({ message: "showCompany must be a boolean" });
      user.profile.showCompany = body.showCompany;
    }

    if (!user.preferences) user.preferences = {};
    if (body.preferences && typeof body.preferences === 'object') {
      if (body.preferences.theme !== undefined) {
        if (!THEMES.includes(body.preferences.theme)) {
          return res.status(400).json({ message: `theme must be one of: ${THEMES.join(', ')}` });
        }
        user.preferences.theme = body.preferences.theme;
      }
      const textSize = body.preferences.appearance?.textSize;
      if (textSize !== undefined) {
        if (!TEXT_SIZES.includes(textSize)) {
          return res.status(400).json({ message: `appearance.textSize must be one of: ${TEXT_SIZES.join(', ')}` });
        }
        user.set('preferences.appearance.textSize', textSize);
      }
    }

    if (phoneChanged) {
      const existingUser = await identity.users.findByPhone(user.phone);
      if (existingUser && String(existingUser._id) !== String(user._id)) {
        return res.status(409).json({ message: "That phone number is already used by another account" });
      }
    }

    await saveWithRetry(user);

    const me = await loadMe(user._id);
    return res.json({
      message: "Profile updated",
      // Same shape as GET /me, plus the flat profile fields older clients read.
      user: {
        ...me,
        id: user._id,
        dob: me?.profile?.dob || "",
        about: me?.profile?.about || "",
        address: me?.profile?.address || "",
        company: me?.profile?.company || "",
        showCompany: me?.profile?.showCompany ?? true,
      }
    });

  } catch (_err) {
    logger.error({ err: _err.message, code: _err.code }, "UPDATE PROFILE ERROR");

    if (_err.code === '23505') {
      // PostgreSQL unique violation, e.g. constraint users_phone_key.
      const field = String(_err.constraint || '').replace(/^users_/, '').replace(/_key$/, '');
      if (field === 'phone') {
        return res.status(409).json({ message: "That phone number is already used by another account" });
      }
      return res.status(409).json({
        message: `That ${field} is already in use by another account`
      });
    }
    if (_err.name === 'ValidationError') {
      return res.status(400).json({ message: _err.message });
    }

    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Keep only the session the request came from (its refresh token), revoking every other.
 * Returns the number of sessions revoked.
 */
function keepOnlyCurrentSession(req, user) {
  const token = getRefreshTokenFromRequest(req);
  const currentHash = token ? sha256(token) : null;
  const before = user.refreshTokens.length;
  user.refreshTokens = user.refreshTokens.filter(t => currentHash && t.tokenHash === currentHash);
  user.markModified('refreshTokens');
  return before - user.refreshTokens.length;
}

function isStrongPassword(pw) {
  return typeof pw === 'string' &&
    pw.length >= 8 &&
    pw.length <= 16 &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw);
}
const PASSWORD_RULE = "Password must be 8-16 characters with an uppercase letter, a number and a special character";

async function auditAuthEvent(req, userId, action, description, severity = 'info') {
  try {
    await AuditLog.create({
      userId,
      action,
      resource: 'User',
      resourceId: userId,
      description,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      category: 'security',
      severity,
    });
  } catch (err) {
    logger.warn({ err: err.message, action }, '[AUDIT] Could not write auth event');
  }
}

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, oldPassword, newPassword } = req.body || {};
    const passwordToCheck = currentPassword || oldPassword;

    if (typeof passwordToCheck !== 'string' || !passwordToCheck || typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!computeHasPassword(user)) {
      return res.status(400).json({ message: "Your account has no password yet. Set one instead.", code: 'NO_PASSWORD' });
    }

    const match = await bcrypt.compare(passwordToCheck, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Current password is incorrect" });

    if (!isStrongPassword(newPassword))
      return res.status(400).json({ message: PASSWORD_RULE });

    if (await bcrypt.compare(newPassword, user.passwordHash))
      return res.status(400).json({ message: "New password must be different from your current password" });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordSetAt = new Date();
    user.isTemporaryPassword = false;
    const revoked = keepOnlyCurrentSession(req, user);
    await saveWithRetry(user);

    await auditAuthEvent(req, user._id, 'auth.password_changed', `Password changed; ${revoked} other session(s) signed out`, 'warning');

    return res.json({ message: "Password updated", otherSessionsRevoked: revoked });

  } catch (_err) {
    logger.error("PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    const userId = req.user.sub;

    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await userDocs.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only for accounts without a password (Google / GitHub / LinkedIn / SSO sign-ups).
    if (computeHasPassword(user)) {
      return res.status(400).json({
        message: "Your account already has a password. Use change password instead.",
        code: 'HAS_PASSWORD'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_RULE });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordSetAt = new Date();
    user.passwordLoginEnabled = true;
    const revoked = keepOnlyCurrentSession(req, user);
    await saveWithRetry(user);

    logger.info({ userId: String(user._id), provider: user.authProvider }, 'Password set for account without one');
    await auditAuthEvent(req, user._id, 'auth.password_set', `Password set; ${revoked} other session(s) signed out`, 'warning');

    try {
      const { passwordSetTemplate } = require('../../../utils/emailTemplates');
      const template = passwordSetTemplate(user.username, user.authProvider);

      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });
    } catch (emailErr) {
      logger.warn({ err: emailErr.message }, 'Failed to send password set confirmation email');
    }

    return res.json({
      message: "Password set successfully! You can now login with email + password",
      otherSessionsRevoked: revoked
    });

  } catch (_err) {
    logger.error("SET PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.googleLogin = async (req, res) => {
  logger.info('🔄 [MODULAR AUTH] Function invoked: googleLogin');
  try {
    const { credential, accessToken: googleAccessToken } = req.body;

    let email, name, picture, googleId;

    if (credential) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      googleId = payload.sub;
    } else if (googleAccessToken) {
      const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
      email = response.data.email;
      name = response.data.name;
      picture = response.data.picture;
      googleId = response.data.sub;
    } else {
      return res.status(400).json({ message: "Missing Google token" });
    }

    let user = await userDocs.findByEmail(email);

    
    let isNewUser = false;
    let needsPasswordSetup = false;

    
    if (!user) {
      isNewUser = true;
      needsPasswordSetup = true;

      const randomPassword = crypto.randomBytes(16).toString("hex");
      const randomHash = await bcrypt.hash(randomPassword, 12);

      user = await userDocs.create({
        username: name,
        email,
        verified: true,
        googleId,
        profilePicture: picture,
        googleAccount: true,
        authProvider: "google", 
        passwordHash: randomHash, 
      });
    } else {
      
      
      if (user.googleAccount && !user.passwordHash) {
        needsPasswordSetup = true;
      }

      // Same gates as password login: Google must not bypass suspension, deactivation or 2FA.
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        return res.status(429).json({ message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).` });
      }
      if (user.accountStatus === 'suspended' || user.accountStatus === 'removed') {
        return res.status(403).json({ message: "Account Suspended." });
      }
      if (user.deactivatedAt) {
        const otpCode = crypto.randomInt(100000, 1000000).toString();
        user.otpCodes = user.otpCodes || [];
        user.otpCodes.push({ code: otpCode, type: 'reactivation', expiresAt: new Date(Date.now() + 10 * 60 * 1000), used: false });
        await user.save();
        try {
          const reactivateTpl = reactivateAccountTemplate(user.username, otpCode);
          await sendEmail({ to: user.email, subject: reactivateTpl.subject, html: reactivateTpl.html, text: reactivateTpl.text });
        } catch (emailErr) {
          logger.error({ err: emailErr }, 'Failed to send reactivation OTP email');
        }
        return res.status(403).json({ message: "Account is deactivated", requiresReactivation: true, email: user.email });
      }
      if (user.twoFactorEnabled) {
        const otp = String(req.body.otp || '').replace(/\s+/g, '');
        if (!otp) {
          return res.status(401).json({ requires2FA: true, message: "Enter the 6-digit code from your authenticator app." });
        }
        const withSecret = user;
        const { verifyUserTotp } = require('../security/totp');
        if (!(await verifyUserTotp(withSecret?.twoFactorSecret, otp))) {
          user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
          if (user.failedLoginAttempts >= 5) {
            user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            user.failedLoginAttempts = 0;
          }
          await user.save();
          return res.status(401).json({ requires2FA: true, invalidCode: true, message: "That code didn't work. Check your authenticator app and try again." });
        }
      }
    }


    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push({
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      deviceInfo: req.get('User-Agent') || 'Unknown',
      ip: getClientIP(req),
      startedAt: new Date(),
    });

    
    user.lastLoginMethod = 'oauth';
    user.lastLoginMethodAt = new Date();

    await saveWithRetry(user);

    
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      message: "Google login success",
      accessToken,
      ...(isNativeClient(req) ? { refreshToken } : {}),
      isFirstLogin: isNewUser,  
      requiresPasswordSetup: needsPasswordSetup,  
      user: {
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        userStatus: user.userStatus,
        googleAccount: user.googleAccount,
      },
    });

  } catch (_err) {
    logger.error("GOOGLE LOGIN ERROR:", _err);
    return res.status(500).json({ message: "Google login failed" });
  }
};

exports.googleAuth = exports.googleLogin;

// A rotated refresh token lives on for a 30s grace period; hide those so one device
// does not show up twice.
const GRACE_HIDE_MS = 60 * 1000;

function describeSession(t, currentHash) {
  const info = parseDeviceInfo(t.deviceInfo && t.deviceInfo !== 'Unknown' ? t.deviceInfo : null);
  const ua = (t.deviceInfo || '').toLowerCase();
  let type = 'desktop';
  if (info.deviceType === 'tablet' || ua.includes('ipad')) type = 'tablet';
  else if (info.deviceType === 'mobile' || ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) type = 'mobile';

  let device = info.device || null;
  if (!device) {
    if (ua.includes('iphone')) device = 'iPhone';
    else if (ua.includes('ipad')) device = 'iPad';
    else if (ua.includes('android')) device = 'Android device';
    else if (ua.includes('cros')) device = 'Chromebook';
    else if (ua.includes('mac os')) device = 'Mac';
    else if (ua.includes('windows')) device = 'Windows PC';
    else if (ua.includes('linux')) device = 'Linux computer';
    else device = 'Unknown device';
  }

  return {
    id: String(t._id),
    device,
    browser: info.browser && info.browser !== 'Unknown' && info.browser !== 'Unknown Browser' ? info.browser : '',
    os: type,
    osName: info.os && info.os !== 'Unknown' && info.os !== 'Unknown OS' ? info.os : '',
    ip: t.ip || null,
    location: null,
    lastActive: t.createdAt || null,
    createdAt: t.startedAt || t.createdAt || null,
    expiresAt: t.expiresAt || null,
    current: !!currentHash && t.tokenHash === currentHash,
  };
}

function currentTokenHash(req) {
  const token = getRefreshTokenFromRequest(req);
  return token ? sha256(token) : null;
}

/**
 * GET /api/auth/sessions -> [{ id, device, browser, os: 'mobile'|'desktop'|'tablet', osName,
 *   ip, location, lastActive, createdAt, expiresAt, current }] (current first, then most recent).
 */
exports.getSessions = async (req, res) => {
  try {
    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentHash = currentTokenHash(req);

    // Drop duplicate hashes (legacy data) while we are here.
    const seenHashes = new Set();
    const uniqueTokens = [];
    for (const t of user.refreshTokens) {
      if (seenHashes.has(t.tokenHash)) continue;
      seenHashes.add(t.tokenHash);
      uniqueTokens.push(t);
    }
    if (uniqueTokens.length !== user.refreshTokens.length) {
      user.refreshTokens = uniqueTokens;
      user.markModified('refreshTokens');
      await saveWithRetry(user);
    }

    const visibleAfter = Date.now() + GRACE_HIDE_MS;
    const sessions = user.refreshTokens
      .filter(t => t.tokenHash === currentHash || !t.expiresAt || new Date(t.expiresAt).getTime() > visibleAfter)
      .map(t => describeSession(t, currentHash));

    sessions.sort((a, b) => {
      if (a.current) return -1;
      if (b.current) return 1;
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    res.json(sessions);
  } catch (_err) {
    logger.error("GET SESSIONS ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

/** DELETE /api/auth/sessions/:id -> { message } | 404 unknown id. Revoking the current one signs this device out. */
exports.revokeSession = async (req, res) => {
  try {
    const sessionId = String(req.params.id || '');
    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const session = user.refreshTokens.find(t => String(t._id) === sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const isCurrent = session.tokenHash === currentTokenHash(req);
    user.refreshTokens = user.refreshTokens.filter(t => String(t._id) !== sessionId);
    user.markModified('refreshTokens');
    await saveWithRetry(user);

    if (isCurrent) clearRefreshTokenCookie(res);

    res.json({ message: "Session revoked", current: isCurrent });
  } catch (_err) {
    logger.error("REVOKE SESSION ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

/** DELETE /api/auth/sessions/others -> { message, revoked } (never the current session). */
exports.revokeOtherSessions = async (req, res) => {
  try {
    const user = await userDocs.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentHash = currentTokenHash(req);
    if (!currentHash || !user.refreshTokens.some(t => t.tokenHash === currentHash)) {
      return res.status(400).json({ message: "Could not identify your current session. Sign in again and retry." });
    }

    const revoked = keepOnlyCurrentSession(req, user);
    await saveWithRetry(user);

    res.json({ message: "All other sessions revoked", revoked });
  } catch (_err) {
    logger.error("REVOKE OTHERS ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.sub;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await userDocs.findById(userId);

    
    if (user.emails && user.emails.length >= 5) {
      return res.status(400).json({ message: "Maximum 5 email addresses allowed" });
    }

    
    if (user.emails && user.emails.some(e => e.email === normalizedEmail)) {
      return res.status(400).json({ message: "Email already added to your account" });
    }

    
    if (await emailTaken(normalizedEmail, userId)) {
      return res.status(400).json({ message: "Email already in use" });
    }

    
    const code = generateVerificationCode();
    const tokenHash = sha256(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    
    if (!user.emails) user.emails = [];

    user.emails.push({
      email: normalizedEmail,
      verified: false,
      isPrimary: false,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: expiresAt
    });

    await saveWithRetry(user);

    
    
    logger.info("\n" + "=".repeat(80));
    logger.info(`📧 VERIFICATION CODE: ${code}`);
    logger.info("=".repeat(80) + "\n");

    try {
      const template = emailVerificationTemplate(user.username, code);
      await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } catch (emailErr) {
      logger.error("Failed to send verification email:", emailErr);
      if (process.env.NODE_ENV !== 'production') {
        // Development only: surface the code in the server log, never to the client.
        logger.warn({ code }, 'EMAIL VERIFICATION CODE (development only)');
      }
    }

    const response = {
      message: "Email added. Please check your inbox for verification code.",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    };

    res.json(response);

  } catch (_err) {
    logger.error("ADD EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyEmailCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const userId = req.user.sub;

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    const user = await userDocs.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    
    const codeHash = sha256(code);
    if (emailEntry.verificationTokenHash !== codeHash) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    
    if (new Date() > emailEntry.verificationTokenExpires) {
      return res.status(400).json({ message: "Verification code expired. Please request a new one." });
    }

    
    emailEntry.verified = true;
    emailEntry.verificationTokenHash = undefined;
    emailEntry.verificationTokenExpires = undefined;

    await saveWithRetry(user);

    res.json({
      message: "Email verified successfully",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (_err) {
    logger.error("VERIFY EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await userDocs.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    
    const code = generateVerificationCode();
    const tokenHash = sha256(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); 

    emailEntry.verificationTokenHash = tokenHash;
    emailEntry.verificationTokenExpires = expiresAt;

    await saveWithRetry(user);

    
    logger.info("\n" + "=".repeat(80));
    logger.info(`📧 VERIFICATION CODE: ${code}`);
    logger.info("=".repeat(80) + "\n");

    
    try {
      const template = emailVerificationTemplate(user.username, code);
      await sendEmail({
        to: emailEntry.email,
        subject: template.subject,
        text: template.text,
        html: template.html
      });

      res.json({ message: "Verification code sent. Please check your inbox." });
    } catch (emailErr) {
      logger.error("Failed to send verification email:", emailErr);
      if (process.env.NODE_ENV !== 'production') {
        // Development only: the code goes to the server log, never to the client.
        logger.warn({ code }, 'EMAIL VERIFICATION CODE (development only)');
        return res.json({ message: 'Email delivery failed. Check the server console for the code (development only).' });
      }
      return res.status(502).json({ message: 'Could not send the verification email. Please try again later.' });
    }

  } catch (_err) {
    logger.error("RESEND VERIFICATION ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.setPrimaryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await userDocs.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (!emailEntry.verified) {
      return res.status(400).json({ message: "Cannot set unverified email as primary" });
    }

    
    user.emails.forEach(e => {
      e.isPrimary = false;
    });

    
    emailEntry.isPrimary = true;

    
    user.email = emailEntry.email;

    await saveWithRetry(user);

    res.json({
      message: "Primary email updated",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (_err) {
    logger.error("SET PRIMARY EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await userDocs.findById(userId);
    const emailEntry = user.emails.id(id);

    if (!emailEntry) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (emailEntry.isPrimary) {
      return res.status(400).json({ message: "Cannot delete primary email. Set another email as primary first." });
    }

    
    const verifiedEmails = user.emails.filter(e => e.verified);
    if (verifiedEmails.length === 1 && emailEntry.verified) {
      return res.status(400).json({ message: "Cannot delete your only verified email" });
    }

    
    user.emails.pull(id);
    await saveWithRetry(user);

    res.json({
      message: "Email deleted",
      emails: user.emails.map(e => ({
        id: e._id,
        email: e.email,
        verified: e.verified,
        isPrimary: e.isPrimary,
        addedAt: e.addedAt
      }))
    });

  } catch (_err) {
    logger.error("DELETE EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.skipPassword = async (req, res) => {
  logger.info('🔄 [MODULAR AUTH] Function invoked: skipPassword');
  try {
    const userId = req.user.sub;
    const user = await userDocs.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (user.authProvider === 'local') {
      return res.status(400).json({
        message: "This endpoint is only for OAuth users"
      });
    }

    if (user.passwordSetAt) {
      return res.status(400).json({
        message: "Password already set. Cannot skip."
      });
    }

    
    user.passwordSkipped = true;
    await saveWithRetry(user);

    return res.json({
      message: "Password setup skipped. You can set a password later in settings.",
      passwordSkipped: true
    });

  } catch (_err) {
    logger.error("SKIP PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.setOAuthPassword = exports.setPassword;

exports.setupTempPassword = async (req, res) => {
  logger.info('\uD83D\uDD04 [MODULAR AUTH] Function invoked: setupTempPassword');
  try {
    const { password } = req.body;
    const userId = req.user.sub;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await userDocs.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    
    
    
    if (!user.isTemporaryPassword || user.passwordInitialized) {
      return res.status(400).json({
        message: 'Password setup is not required for this account. Use the regular password-change flow.'
      });
    }

    
    const strong =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!strong) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters with an uppercase letter, a number, and a special character.'
      });
    }

    
    user.passwordHash = await bcrypt.hash(password, 12);
    user.isTemporaryPassword = false;  
    user.passwordInitialized = true;   
    user.passwordSetAt = new Date();

    await saveWithRetry(user);

    logger.info(`\u2705 [SETUP TEMP PW] Password initialized for user: ${user.email}`);

    return res.json({
      message: 'Password set successfully. You can now log in with your new password.',
      passwordInitialized: true,
    });

  } catch (_err) {
    return handleError(res, _err, 'SETUP TEMP PASSWORD ERROR');
  }
};



exports.generateToken = (user) => {
  return jwt.sign(
    { sub: user._id, username: user.username, role: user.roles?.[0] || 'user' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' } 
  );
};

exports.getUsersList = async (req, res) => {
  try {
    const currentUserId = req.user.sub;

    
    const { query } = require('../../shared/postgres');
    const { rows } = await query('SELECT id, username, email, profile_picture FROM users WHERE id <> $1 ORDER BY username LIMIT 100', [String(currentUserId)]);
    const users = rows.map((r) => ({ _id: r.id, username: r.username, email: r.email, profilePicture: r.profile_picture }));

    res.json({ users });
  } catch (_err) {
    logger.error("GET USERS ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.githubCallback = async (req, res) => {
  
  const token = exports.generateToken(req.user);

  
  const requiresPasswordSetup = req.user.authProvider !== 'local' && !req.user.passwordSetAt && !req.user.passwordSkipped;
  const params = new URLSearchParams({
    access: token,
    requiresPasswordSetup: requiresPasswordSetup.toString()
  });

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success#${params.toString()}`);
};

exports.linkedinInitiate = (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state: Math.random().toString(36).substring(7), 
  });

  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
};

exports.linkedinCallback = async (req, res) => {
  try {
    const { code, error, error_description } = req.query;

    if (error) {
      logger.error('LinkedIn OAuth error:', error, error_description);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
    }

    
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    
    const userInfoRes = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const linkedinUser = userInfoRes.data;
    logger.info('LinkedIn user profile:', linkedinUser);

    
    let user = await userDocs.findByProvider('linkedin', linkedinUser.sub);

    if (!user && linkedinUser.email) {
      
      user = await userDocs.findByEmail(linkedinUser.email);
      if (user) {
        // Only link to an existing account when that account's email is verified,
        // it is not already linked elsewhere, and LinkedIn vouches for the email.
        // Otherwise an attacker could take over an account by registering its email.
        if (!user.verified || user.linkedinId || linkedinUser.email_verified === false) {
          return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_exists`);
        }
        user.linkedinId = linkedinUser.sub;
        if (linkedinUser.picture) user.profilePicture = linkedinUser.picture;
        await user.save();
      }
    }

    if (!user) {
      
      user = await userDocs.create({
        linkedinId: linkedinUser.sub,
        username: linkedinUser.name || linkedinUser.given_name || `linkedin_${linkedinUser.sub}`,
        email: linkedinUser.email,
        profilePicture: linkedinUser.picture,
        authProvider: "linkedin",
        passwordHash: "oauth-linkedin-" + linkedinUser.sub,
        verified: true,
        passwordSetAt: null,  
        passwordLoginEnabled: false  
      });
    }

    const token = exports.generateToken(user);

    
    const requiresPasswordSetup = user.authProvider !== 'local' && !user.passwordSetAt && !user.passwordSkipped;
    const params = new URLSearchParams({
      access: token,
      requiresPasswordSetup: requiresPasswordSetup.toString()
    });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success#${params.toString()}`);
  } catch (_err) {
    logger.error({ err: _err.response?.data || _err.message }, 'LinkedIn OAuth callback error');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
};

exports.deactivateAccount = async (req, res) => {
  try {
    const userId = req.user.sub;

    const user = await userDocs.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Company-managed accounts are suspended/removed by company admins, not by the user.
    if (user.userType === "company" || user.companyId) {
      return res.status(403).json({
        message: "Your account is managed by your company. Ask an administrator to deactivate it."
      });
    }

    if (user.deactivatedAt) {
      clearRefreshTokenCookie(res);
      return res.json({ message: "Account already deactivated", deactivated: true });
    }

    user.deactivatedAt = new Date();
    user.isOnline = false;
    // Sign out everywhere: refresh tokens die now, access tokens within their 15 min lifetime.
    user.refreshTokens = [];

    await saveWithRetry(user);

    try {
      await identity.deviceSessions.revokeAllExcept(userId, null);
    } catch (err) {
      logger.warn({ err: err.message }, 'Could not revoke device sessions on deactivate');
    }

    await auditAuthEvent(req, user._id, 'auth.deactivated', 'Account deactivated by user', 'warning');
    clearRefreshTokenCookie(res);

    logger.info(`🔒 Account deactivated for user: ${user.username} (${userId})`);

    return res.json({
      message: "Account deactivated successfully",
      deactivated: true
    });
  } catch (_err) {
    logger.error("DEACTIVATE ACCOUNT ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.verifyReactivationOTP = async (req, res) => {
  try {
    const { email, otpCode, password } = req.body;

    if (!email || !otpCode || !password) {
      return res.status(400).json({ message: "Email, OTP code, and password required" });
    }

    
    const user = await userDocs.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (!user.deactivatedAt) {
      return res.status(400).json({ message: "Account is not deactivated" });
    }

    
    if (!user.otpCodes || user.otpCodes.length === 0) {
      logger.info('❌ No OTP codes found for user:', email);
      return res.status(400).json({ message: "No OTP found. Please try logging in again." });
    }

    const otpRecord = user.otpCodes.find(
      otp => otp.code === otpCode && otp.type === 'reactivation' && !otp.used
    );

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    
    otpRecord.used = true;
    otpRecord.usedAt = new Date();

    
    user.deactivatedAt = null;

    
    // Use the same token format/hashing/cookie as login so /refresh can rotate it.
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push({
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
      deviceInfo: req.get('user-agent') || 'Unknown',
      ip: getClientIP(req),
      startedAt: new Date(),
      createdAt: new Date()
    });

    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    logger.info(`✅ Account reactivated for user: ${user.username} (${user._id})`);

    return res.json({
      message: "Account reactivated successfully",
      accessToken,
      ...(isNativeClient(req) ? { refreshToken } : {}),
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (_err) {
    logger.error("VERIFY REACTIVATION OTP ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

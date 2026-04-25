'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../../models/User');
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
const { setRefreshTokenCookie, clearRefreshTokenCookie } = require('../../../utils/cookieHelper');
const { _TIME } = require('../../../constants');
const { sha256 } = require('../../../utils/hashUtils');
const { handleError } = require('../../../utils/responseHelpers');
const logger = require('../../shared/utils/logger');

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
  return jwt.sign(
    { sub: user._id.toString() },
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

    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email already in use" });

    
    if (await User.findOne({ username }))
      return res.status(409).json({ message: "Username already in use" });

    
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone });
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
    const Company = require("../../../models/Company");
    const Invite = require("../../../models/Invite");
    const Workspace = require("../../../models/Workspace");
    const Channel = require("../channels/channel.model.js");

    
    const extractDomain = (email) => {
      const match = email.match(/@(.+)$/);
      return match ? match[1].toLowerCase() : null;
    };

    
    if (inviteToken) {
      const inviteHash = sha256(inviteToken);
      const invite = await Invite.findOne({
        tokenHash: inviteHash,
        email: emailLower,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (invite) {
        userType = "company";
        companyId = invite.company;
        companyRole = invite.role || "member";
        assignedDepartment = invite.department;
        assignedManager = invite.metadata?.managerId;

        if (invite.workspace) {
          workspacesToJoin.push(invite.workspace);
        }

        
        invite.status = 'accepted'; 
        invite.used = true;
        invite.usedBy = null; 
        await invite.save();
      } else {
        
      }
    }

    
    if (!companyId) {
      const companyWithAllowedEmail = await Company.findOne({
        allowedEmails: emailLower,
        isActive: true
      });

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
        const companyWithDomain = await Company.findOne({
          domain,
          domainVerified: true,
          autoJoinByDomain: true,
          isActive: true
        });

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

    

    

    const user = new User({
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

    

    if (companyId && workspacesToJoin.length > 0) {
      for (const workspaceId of workspacesToJoin) {
        const workspace = await Workspace.findById(workspaceId);

        if (workspace && !workspace.isMember(user._id)) {
          
          workspace.members.push({
            user: user._id,
            role: "member"
          });
          await workspace.save();

          
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
      logger.warn({ err: _emailError.message }, 'SMTP error — logging verification link');
      logger.info({ email, verifyUrl }, 'EMAIL VERIFICATION LINK (SMTP not configured)');
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

    const user = await User.findOne({
      email,
      verificationTokenHash: tokenHash,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.verified = true;
    user.verificationTokenHash = undefined;
    user.verificationTokenExpires = undefined;

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

    const Company = require("../../../models/Company");

    
    
    
    if (domain) {
      
      const company = await Company.findOne({ domain: domain, isActive: true });
      if (company) {
        if (company.verificationStatus === 'rejected') {
          return res.status(403).json({ message: `Company domain ${domain} is rejected. Contact support.` });
        }
        isCompanyAccount = true;
        targetCompanyId = company._id;
      }
    }

    
    
    const user = await User.findOne({ email }).populate("companyId");

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
      redirectTo = "/chttrix-admin";
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
      
      const refreshToken = req.cookies?.jwt || req.body?.refreshToken;

      if (!refreshToken) {
        logger.warn('[REFRESH] No refresh token found (cookie or body)');
        return res.status(401).json({ message: 'No refresh token' });
      }

      const isCookieToken = !!req.cookies?.jwt;
      logger.debug({ source: isCookieToken ? 'cookie' : 'body' }, '[REFRESH] Token source');

      const refreshHash = sha256(refreshToken);

      const user = await User.findOne({
        "refreshTokens.tokenHash": refreshHash
      });

      if (!user) {
        logger.warn('[REFRESH] Invalid refresh token — no user found');
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

      const oldTokenIndex = user.refreshTokens.findIndex(t => t.tokenHash === refreshHash);

      if (oldTokenIndex !== -1) {
        user.refreshTokens[oldTokenIndex].expiresAt = new Date(Date.now() + 30000);
        logger.debug('[REFRESH] Old token marked for 30s grace period');
      }

      user.refreshTokens.push({
        tokenHash: sha256(newRefresh),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000),
        deviceInfo: req.get('User-Agent') || 'Unknown'
      });

      
      const beforeCleanup = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(
        t => t.expiresAt > new Date()
      );

      if (beforeCleanup !== user.refreshTokens.length) {
        logger.debug({ cleaned: beforeCleanup - user.refreshTokens.length }, '[REFRESH] Expired tokens cleaned up');
      }

      await user.save();
      logger.debug('[REFRESH] User tokens persisted');

      
      setRefreshTokenCookie(res, newRefresh);

      logger.debug('[REFRESH] Token refresh completed successfully');
      return res.json({ accessToken: newAccess });

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
    const token = req.cookies?.jwt;
    if (!token) return res.json({ message: "Logged out" });

    const hash = sha256(token);

    const user = await User.findOne({ "refreshTokens.tokenHash": hash });

    if (user) {
      user.refreshTokens = user.refreshTokens.filter(t => t.tokenHash !== hash);
      await saveWithRetry(user);
    }

    clearRefreshTokenCookie(res);

    return res.json({ message: "Logged out" });
  } catch (_err) {
    return handleError(res, _err, "LOGOUT ERROR");
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return res.json({ message: "Logged out from all devices" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      clearRefreshTokenCookie(res);
      return res.json({ message: "Logged out" });
    }

    
    
    
    
    const tokenHash = sha256(token);
    const user = await User.findOne({ 'refreshTokens.tokenHash': tokenHash });

    if (!user) {
      
      clearRefreshTokenCookie(res);
      return res.json({ message: 'Logged out' });
    }

    await User.findByIdAndUpdate(decoded.sub, { refreshTokens: [] });

    clearRefreshTokenCookie(res);

    return res.json({ message: "Logged out from all devices" });

  } catch (_err) {
    return handleError(res, _err, "LOGOUT ALL ERROR");
  }
};

exports.forgotPassword = async (req, res) => {
  console.log('🔄 [MODULAR AUTH] Function invoked: forgotPassword');
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

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
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (_emailError) {
      
      console.log("\n" + "=".repeat(80));
      console.log("🔐 PASSWORD RESET LINK (SMTP not configured)");
      console.log("=".repeat(80));
      console.log(`User: ${email}`);
      console.log(`Reset Link: ${url}`);
      console.log("=".repeat(80) + "\n");
    }

    return res.json({ message: "Reset link sent if account exists" });
  } catch (_err) {
    console.error("FORGOT ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  console.log('🔄 [MODULAR AUTH] Function invoked: resetPassword');
  try {
    const { token, email, password } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordTokenHash: sha256(token),
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];

    await saveWithRetry(user);

    return res.json({ message: "Password reset successful" });

  } catch (_err) {
    console.error("RESET ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub)
      .select("-passwordHash -refreshTokens")
      .populate('companyId');

    
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

        console.log(`📞 Migrated phone for user ${user.email}: ${extractedCode} ${extractedPhone}`);
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

      console.log(`📞 Migrated phone (no prefix) for user ${user.email}: ${extractedCode} ${extractedPhone}`);
    }

    return res.json(userObject);
  } catch (_err) {
    console.error("GET ME ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);

    
    if (req.body.username !== undefined) user.username = req.body.username;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.phoneCode !== undefined) user.phoneCode = req.body.phoneCode;

    
    if (!user.profile) user.profile = {};

    
    if (req.body.dob !== undefined && req.body.dob !== "") {
      const dob = new Date(req.body.dob);
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

    
    if (req.body.about !== undefined && req.body.about !== "") {
      const about = req.body.about.trim();
      if (about.length > 500) {
        return res.status(400).json({ message: "About section must be 500 characters or less" });
      }
      user.profile.about = about;
    }

    
    if (req.body.address !== undefined) {
      user.profile.address = req.body.address;
    }

    if (req.body.company !== undefined) user.profile.company = req.body.company;
    if (req.body.showCompany !== undefined) user.profile.showCompany = req.body.showCompany;

    
    if (!user.preferences) user.preferences = {};
    if (req.body.preferences) {
      if (req.body.preferences.theme) user.preferences.theme = req.body.preferences.theme;
    }

    
    if (req.body.phone !== undefined && req.body.phone) {
      const existingUser = await User.findOne({
        phone: req.body.phone,
        _id: { $ne: user._id } 
      });

      if (existingUser) {
        return res.status(409).json({ message: "Phone number already in use by another account" });
      }
    }

    await saveWithRetry(user);

    return res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        phoneCode: user.phoneCode,
        dob: user.profile?.dob || "",
        about: user.profile?.about || "",
        address: user.profile?.address || "",
        company: user.profile?.company || "",
        showCompany: user.profile?.showCompany ?? true,
        verified: user.verified,
        roles: user.roles,
        userStatus: user.userStatus,
        preferences: user.preferences
      }
    });

  } catch (_err) {
    console.error("UPDATE PROFILE ERROR:", _err);
    console.error("Error details:", {
      name: _err.name,
      code: _err.code,
      message: _err.message
    });

    
    if (_err.code === 11000) {
      const field = Object.keys(_err.keyPattern || {})[0];
      return res.status(409).json({
        message: `That ${field} is already in use by another account`
      });
    }

    return res.status(500).json({ message: _err.message || "Server error" });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    
    const { currentPassword, oldPassword, newPassword } = req.body;
    const passwordToCheck = currentPassword || oldPassword;

    const user = await User.findById(req.user.sub);

    const match = await bcrypt.compare(passwordToCheck, user.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Old password incorrect" });

    const strong =
      newPassword.length >= 8 &&
      newPassword.length <= 16 &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!strong)
      return res.status(400).json({ message: "Weak password" });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await saveWithRetry(user);

    return res.json({ message: "Password updated" });

  } catch (_err) {
    console.error("PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.setPassword = async (req, res) => {
  console.log('🔄 [MODULAR AUTH] Function invoked: setPassword (OAuth)');
  try {
    const { password } = req.body;
    const userId = req.user.sub;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (!user.authProvider || user.authProvider === 'local') {
      return res.status(400).json({
        message: "This endpoint is only for OAuth users. Use password change endpoint instead."
      });
    }

    
    const strong =
      password.length >= 8 &&
      password.length <= 16 &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!strong) {
      return res.status(400).json({
        message: "Password must be 8-16 characters with uppercase, number, and special character"
      });
    }

    
    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordSetAt = new Date(); 
    user.passwordLoginEnabled = true; 
    await saveWithRetry(user);

    console.log(`✅ Password set for OAuth user: ${user.email} (${user.authProvider})`);

    
    try {
      const { passwordSetTemplate } = require('../../../utils/emailTemplates');
      const template = passwordSetTemplate(user.username, user.authProvider);

      await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text
      });

      console.log(`📧 Password set confirmation email sent to ${user.email}`);
    } catch (emailErr) {
      
      console.warn('⚠️ Failed to send password set confirmation email:', emailErr.message);
      console.log(`💡 Password was set successfully for ${user.email}, but email notification failed (SMTP may not be configured)`);
    }

    return res.json({
      message: "Password set successfully! You can now login with email + password"
    });

  } catch (_err) {
    console.error("SET PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.googleLogin = async (req, res) => {
  console.log('🔄 [MODULAR AUTH] Function invoked: googleLogin');
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

    let user = await User.findOne({ email });

    
    let isNewUser = false;
    let needsPasswordSetup = false;

    
    if (!user) {
      isNewUser = true;
      needsPasswordSetup = true;

      const randomPassword = crypto.randomBytes(16).toString("hex");
      const randomHash = await bcrypt.hash(randomPassword, 12);

      user = await User.create({
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
    }

    
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push({
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    
    user.lastLoginMethod = 'oauth';
    user.lastLoginMethodAt = new Date();

    await saveWithRetry(user);

    
    setRefreshTokenCookie(res, refreshToken);

    return res.json({
      message: "Google login success",
      accessToken,
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
    console.error("GOOGLE LOGIN ERROR:", _err);
    return res.status(500).json({ message: "Google login failed" });
  }
};

exports.googleAuth = exports.googleLogin;

exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    
    const currentToken = req.cookies?.jwt;
    const currentHash = currentToken ? sha256(currentToken) : null;

    
    
    
    

    const seenHashes = new Set();
    const uniqueTokens = [];
    let isDirty = false;

    
    
    
    for (const t of user.refreshTokens) {
      if (seenHashes.has(t.tokenHash)) {

        isDirty = true; 
        continue;
      }
      seenHashes.add(t.tokenHash);
      uniqueTokens.push(t);
    }

    if (isDirty) {

      user.refreshTokens = uniqueTokens;
      user.markModified('refreshTokens'); 
      await saveWithRetry(user);
    }
    

    const sessions = user.refreshTokens.map(t => {
      
      let deviceType = "desktop";
      const ua = (t.deviceInfo || "").toLowerCase();

      
      if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
        deviceType = "mobile";
      }

      
      let deviceName = "Unknown Device";
      if (ua.includes("mac os")) deviceName = "MacBook / Mac";
      else if (ua.includes("windows")) deviceName = "Windows PC";
      else if (ua.includes("iphone")) deviceName = "iPhone";
      else if (ua.includes("android")) deviceName = "Android Device";
      else if (ua.includes("linux")) deviceName = "Linux Machine";
      else if (ua.includes("cros")) deviceName = "Chromebook";

      
      let browser = "";
      if (ua.includes("chrome") && !ua.includes("edg") && !ua.includes("opr")) browser = "Chrome";
      else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
      else if (ua.includes("firefox")) browser = "Firefox";
      else if (ua.includes("edg")) browser = "Edge";
      else if (ua.includes("opr")) browser = "Opera";

      return {
        id: t._id,
        device: deviceName,
        browser: browser, 
        os: deviceType,
        location: "Unknown",
        lastActive: t.createdAt,
        current: t.tokenHash === currentHash
      };
    });

    
    sessions.sort((a, b) => {
      if (a.current) return -1;
      if (b.current) return 1;
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    res.json(sessions);
  } catch (_err) {
    console.error("GET SESSIONS ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const user = await User.findById(req.user.sub);

    
    
    

    user.refreshTokens.pull({ _id: sessionId });
    await saveWithRetry(user);

    res.json({ message: "Session revoked" });
  } catch (_err) {
    console.error("REVOKE SESSION ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.revokeOtherSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    const currentToken = req.cookies?.jwt;

    if (!currentToken) {
      return res.status(400).json({ message: "No active session to keep" });
    }

    const currentHash = sha256(currentToken);

    
    const activeToken = user.refreshTokens.find(t => t.tokenHash === currentHash);

    if (activeToken) {
      user.refreshTokens = [activeToken]; 
    } else {
      
      user.refreshTokens = [];
    }

    user.markModified('refreshTokens');
    await saveWithRetry(user);

    res.json({ message: "All other sessions revoked" });
  } catch (_err) {
    console.error("REVOKE OTHERS ERROR:", _err);
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
    const user = await User.findById(userId);

    
    if (user.emails && user.emails.length >= 5) {
      return res.status(400).json({ message: "Maximum 5 email addresses allowed" });
    }

    
    if (user.emails && user.emails.some(e => e.email === normalizedEmail)) {
      return res.status(400).json({ message: "Email already added to your account" });
    }

    
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { "emails.email": normalizedEmail }
      ]
    });

    if (existingUser && existingUser._id.toString() !== userId) {
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

    
    let devCode = null;
    
    console.log("\n" + "=".repeat(80));
    console.log(`📧 VERIFICATION CODE: ${code}`);
    console.log("=".repeat(80) + "\n");

    try {
      const template = emailVerificationTemplate(user.username, code);
      await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html
      });
    } catch (emailErr) {
      console.error("Failed to send verification email:", emailErr);

      
      console.log("\n" + "=".repeat(80));
      console.log(`📧 EMAIL VERIFICATION CODE (SMTP not configured)`);
      console.log("=".repeat(80));
      console.log(`Code: ${code}`);
      console.log("=".repeat(80) + "\n");

      devCode = code;
    }

    const response = {
      message: devCode
        ? `Email added. Verification code: ${devCode} (Check console in production)`
        : "Email added. Please check your inbox for verification code.",
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
    console.error("ADD EMAIL ERROR:", _err);
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

    const user = await User.findById(userId);
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
    console.error("VERIFY EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
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

    
    console.log("\n" + "=".repeat(80));
    console.log(`📧 VERIFICATION CODE: ${code}`);
    console.log("=".repeat(80) + "\n");

    
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
      console.error("Failed to send verification email:", emailErr);

      
      console.log("\n" + "=".repeat(80));
      console.log(`📧 EMAIL VERIFICATION CODE (SMTP not configured)`);
      console.log("=".repeat(80));
      console.log(`Code: ${code}`);
      console.log("=".repeat(80) + "\n");

      res.json({ message: `Verification code: ${code} (Check server console)` });
    }

  } catch (_err) {
    console.error("RESEND VERIFICATION ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.setPrimaryEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
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
    console.error("SET PRIMARY EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    const user = await User.findById(userId);
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
    console.error("DELETE EMAIL ERROR:", _err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.skipPassword = async (req, res) => {
  console.log('🔄 [MODULAR AUTH] Function invoked: skipPassword');
  try {
    const userId = req.user.sub;
    const user = await User.findById(userId);

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
    console.error("SKIP PASSWORD ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.setOAuthPassword = exports.setPassword;

exports.setupTempPassword = async (req, res) => {
  console.log('\uD83D\uDD04 [MODULAR AUTH] Function invoked: setupTempPassword');
  try {
    const { password } = req.body;
    const userId = req.user.sub;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findById(userId);
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

    console.log(`\u2705 [SETUP TEMP PW] Password initialized for user: ${user.email}`);

    return res.json({
      message: 'Password set successfully. You can now log in with your new password.',
      passwordInitialized: true,
    });

  } catch (_err) {
    return handleError(res, _err, 'SETUP TEMP PASSWORD ERROR');
  }
};

const _passport = require("../../config/passport");

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

    
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("_id username email profilePicture")
      .limit(100)
      .lean();

    res.json({ users });
  } catch (_err) {
    console.error("GET USERS ERROR:", _err);
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

  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?${params.toString()}`);
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
      console.error('LinkedIn OAuth error:', error, error_description);
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
    console.log('LinkedIn user profile:', linkedinUser);

    
    let user = await User.findOne({ linkedinId: linkedinUser.sub });

    if (!user && linkedinUser.email) {
      
      user = await User.findOne({ email: linkedinUser.email });
      if (user) {
        user.linkedinId = linkedinUser.sub;
        if (linkedinUser.picture) user.profilePicture = linkedinUser.picture;
        await user.save();
      }
    }

    if (!user) {
      
      user = await User.create({
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

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/oauth-success?${params.toString()}`);
  } catch (_err) {
    console.error('LinkedIn OAuth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=linkedin_failed`);
  }
};

exports.deactivateAccount = async (req, res) => {
  try {
    const userId = req.user.sub;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    user.deactivatedAt = new Date();

    
    user.refreshTokens = [];

    await user.save();

    console.log(`🔒 Account deactivated for user: ${user.username} (${userId})`);

    return res.json({
      message: "Account deactivated successfully",
      deactivated: true
    });
  } catch (_err) {
    console.error("DEACTIVATE ACCOUNT ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.verifyReactivationOTP = async (req, res) => {
  try {
    const { email, otpCode, password } = req.body;

    if (!email || !otpCode || !password) {
      return res.status(400).json({ message: "Email, OTP code, and password required" });
    }

    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (!user.deactivatedAt) {
      return res.status(400).json({ message: "Account is not deactivated" });
    }

    
    if (!user.otpCodes || user.otpCodes.length === 0) {
      console.log('❌ No OTP codes found for user:', email);
      return res.status(400).json({ message: "No OTP found. Please try logging in again." });
    }

    console.log(`🔍 Checking OTP codes for user ${email}:`, user.otpCodes.map(otp => ({
      code: otp.code,
      type: otp.type,
      used: otp.used,
      expiresAt: otp.expiresAt
    })));
    console.log(`🔍 Looking for OTP code: ${otpCode}`);

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

    
    const accessToken = jwt.sign(
      { sub: user._id, username: user.username, role: user.roles?.[0] || 'user' },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { sub: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    
    user.refreshTokens.push({
      tokenHash: hashedRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      deviceInfo: req.get('user-agent') || 'Unknown',
      createdAt: new Date()
    });

    await user.save();

    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    console.log(`✅ Account reactivated for user: ${user.username} (${user._id})`);

    return res.json({
      message: "Account reactivated successfully",
      accessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (_err) {
    console.error("VERIFY REACTIVATION OTP ERROR:", _err);
    return res.status(500).json({ message: "Server error" });
  }
};

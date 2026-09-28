'use strict';

/**
 * Adds a verified company to the E2E database through the app's own
 * registration + provisioning services: an owner, an admin, a manager who
 * heads Engineering, and members. Used by the company dashboard specs.
 * Idempotent: a second call returns the existing company.
 */

const path = require('path');
const { E2E } = require('./config');

const serverDir = path.join(__dirname, '..', '..', 'server');
const fromServer = (mod) => require(require.resolve(mod, { paths: [serverDir] }));

const COMPANY = {
  name: 'Acme E2E Co',
  domain: 'acme.e2e.oruinwan.test',
  password: 'Company-Passw0rd!',
  users: {
    owner: { email: 'owner@acme.e2e.oruinwan.test', name: 'Olivia Owner', role: 'owner' },
    admin: { email: 'admin@acme.e2e.oruinwan.test', name: 'Adam Admin', role: 'admin' },
    manager: { email: 'manager@acme.e2e.oruinwan.test', name: 'Mona Manager', role: 'manager', dept: 'Engineering', manages: 'Engineering' },
    dev: { email: 'dev@acme.e2e.oruinwan.test', name: 'Dev One', role: 'member', dept: 'Engineering' },
    designer: { email: 'designer@acme.e2e.oruinwan.test', name: 'Dana Designer', role: 'member', dept: 'Design' },
  },
};

async function seedCompany(mongoUri = E2E.mongoUri) {
  if (!/_e2e$/.test(mongoUri)) throw new Error(`Refusing to seed a non-E2E database: ${mongoUri}`);
  process.env.SERVER_KEK = process.env.SERVER_KEK || E2E.serverKek;
  const mongoose = fromServer('mongoose');
  const bcrypt = fromServer('bcryptjs');
  const User = require(path.join(serverDir, 'models', 'User'));
  const Company = require(path.join(serverDir, 'models', 'Company'));
  const Department = require(path.join(serverDir, 'models', 'Department'));
  const Workspace = require(path.join(serverDir, 'models', 'Workspace'));
  const reg = require(path.join(serverDir, 'src', 'features', 'company-registration', 'registration.service'));

  const wasConnected = mongoose.connection.readyState === 1;
  if (!wasConnected) await mongoose.connect(mongoUri);
  try {
    const u = COMPANY.users;
    let owner = await User.findOne({ email: u.owner.email });
    let company;
    if (!owner) {
      const out = await reg.registerCompany({
        companyName: COMPANY.name, adminName: u.owner.name, adminEmail: u.owner.email,
        adminPassword: COMPANY.password, domain: COMPANY.domain, role: 'owner',
        departments: ['Engineering', 'Design'], workspaceName: 'Acme E2E HQ',
      });
      company = out.company; owner = out.adminUser;
      company.verificationStatus = 'verified';
      company.isSetupComplete = true;
      await company.save();
      await reg.provisionCompanyResources({ company, adminUser: owner });
    } else {
      company = await Company.findById(owner.companyId);
    }
    const hq = await Workspace.findById(company.defaultWorkspace);
    const depts = await Department.find({ company: company._id });
    const byName = Object.fromEntries(depts.map((d) => [d.name, d]));
    const hash = await bcrypt.hash(COMPANY.password, 10);
    const ids = { owner: String(owner._id) };

    for (const [key, spec] of Object.entries(u)) {
      if (key === 'owner') continue;
      let user = await User.findOne({ email: spec.email });
      if (!user) {
        const dept = spec.dept ? byName[spec.dept] : null;
        const manages = spec.manages ? byName[spec.manages] : null;
        const wsRole = spec.role === 'admin' ? 'admin' : 'member';
        user = await User.create({
          username: spec.name, email: spec.email, passwordHash: hash, verified: true, userType: 'company',
          companyId: company._id, companyRole: spec.role, accountStatus: 'active', authProvider: 'local',
          profile: { name: spec.name }, refreshTokens: [],
          departments: dept ? [dept._id] : [], managedDepartments: manages ? [manages._id] : [],
          workspaces: [{ workspace: hq._id, role: wsRole, joinedAt: new Date() }],
        });
        hq.members.push({ user: user._id, role: wsRole, status: 'active', joinedAt: new Date() });
        if (dept) await Department.updateOne({ _id: dept._id }, { $addToSet: { members: user._id } });
        if (manages) await Department.updateOne({ _id: manages._id }, { $addToSet: { managers: user._id }, $set: { head: user._id } });
        if (spec.role === 'admin') await Company.updateOne({ _id: company._id }, { $push: { admins: { user: user._id, role: 'admin' } } });
      }
      ids[key] = String(user._id);
    }
    await hq.save();
    return {
      companyId: String(company._id),
      workspaceId: String(hq._id),
      departments: Object.fromEntries(depts.map((d) => [d.name, String(d._id)])),
      users: ids,
    };
  } finally {
    if (!wasConnected) await mongoose.disconnect();
  }
}

module.exports = { seedCompany, COMPANY };

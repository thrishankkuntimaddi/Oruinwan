'use strict';

/**
 * Adds a verified company to the E2E database through the app's own
 * registration + provisioning services: an owner, an admin, a manager who
 * heads Engineering, and members. Used by the company dashboard specs.
 * Idempotent: a second call returns the existing company.
 */

const path = require('path');
const { E2E } = require('./config');
const { usePostgres } = require('./pg');

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

async function seedCompany(mongoUri = E2E.mongoUri, databaseUrl = E2E.databaseUrl) {
  if (!/_e2e$/.test(mongoUri)) throw new Error(`Refusing to seed a non-E2E database: ${mongoUri}`);
  // Identity lives in PostgreSQL: point the server modules at the E2E database before loading them.
  usePostgres(databaseUrl);
  process.env.SERVER_KEK = process.env.SERVER_KEK || E2E.serverKek;
  const mongoose = fromServer('mongoose');
  const bcrypt = fromServer('bcryptjs');
  const identity = require(path.join(serverDir, 'src', 'identity'));
  const org = require(path.join(serverDir, 'src', 'identity', 'queries', 'org'));
  const reg = require(path.join(serverDir, 'src', 'features', 'company-registration', 'registration.service'));

  // Default channels are MongoDB documents, so registration still needs a Mongo connection.
  const wasConnected = mongoose.connection.readyState === 1;
  if (!wasConnected) await mongoose.connect(mongoUri);
  try {
    const u = COMPANY.users;
    let owner = await identity.users.findByEmail(u.owner.email);
    let companyId;
    if (!owner) {
      const out = await reg.registerCompany({
        companyName: COMPANY.name, adminName: u.owner.name, adminEmail: u.owner.email,
        adminPassword: COMPANY.password, domain: COMPANY.domain, role: 'owner',
        departments: ['Engineering', 'Design'], workspaceName: 'Acme E2E HQ',
      });
      companyId = String(out.company._id);
      owner = out.adminUser;
      await org.updateCompany(companyId, { verificationStatus: 'verified', isSetupComplete: true });
      await reg.provisionCompanyResources({ companyId, adminUser: owner });
    } else {
      companyId = String(owner.companyId);
    }
    const company = await org.companies.findOne({ _id: companyId });
    const hqId = String(company.defaultWorkspace);
    const depts = await org.departments.find({ company: companyId });
    const byName = Object.fromEntries(depts.map((d) => [d.name, d]));
    const hash = await bcrypt.hash(COMPANY.password, 10);
    const ids = { owner: String(owner._id) };

    for (const [key, spec] of Object.entries(u)) {
      if (key === 'owner') continue;
      let user = await identity.users.findByEmail(spec.email);
      if (!user) {
        const dept = spec.dept ? byName[spec.dept] : null;
        const manages = spec.manages ? byName[spec.manages] : null;
        const wsRole = spec.role === 'admin' ? 'admin' : 'member';
        user = await identity.users.create({
          username: spec.name, email: spec.email, passwordHash: hash, verified: true, userType: 'company',
          companyId, companyRole: spec.role, accountStatus: 'active', authProvider: 'local',
          profile: { name: spec.name },
        });
        await identity.workspaces.addMember(hqId, user._id, { role: wsRole, status: 'active' });
        if (dept) await org.addDepartmentMembers(dept._id, [user._id], 'member');
        if (manages) {
          await org.addDepartmentMembers(manages._id, [user._id], 'manager');
          await org.departments.updateMany({ _id: manages._id }, { head: user._id });
        }
        if (spec.role === 'admin') await org.addCompanyAdmin(companyId, user._id, 'admin');
      }
      ids[key] = String(user._id);
    }
    return {
      companyId,
      workspaceId: hqId,
      departments: Object.fromEntries(depts.map((d) => [d.name, String(d._id)])),
      users: ids,
    };
  } finally {
    if (!wasConnected) await mongoose.disconnect();
  }
}

module.exports = { seedCompany, COMPANY };

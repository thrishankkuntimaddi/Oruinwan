'use strict';

/**
 * Seeds the E2E databases: two verified personal users who share one workspace,
 * plus a third (carol) who is outside it.
 *
 * Users, workspaces and memberships live in PostgreSQL, so they go through the
 * server's identity repositories. MongoDB (messages, channels, notes) is
 * dropped so every run starts empty.
 *
 * Encryption keys are not seeded. Each user's first UI login generates their
 * identity keys, and the server creates DM keys on first use, which is the
 * same path real users take.
 *
 * Writes the created ids to e2e/.auth/seed.json for the tests.
 */

const fs = require('fs');
const path = require('path');
const { E2E } = require('./config');
const { resetDatabase, closePostgres } = require('./pg');

const serverDir = path.join(__dirname, '..', '..', 'server');
const fromServer = (mod) => require(require.resolve(mod, { paths: [serverDir] }));

async function seed(mongoUri = E2E.mongoUri, databaseUrl = E2E.databaseUrl) {
  if (!/_e2e$/.test(new URL(mongoUri).pathname.slice(1))) {
    throw new Error(`Refusing to seed a non-E2E database: ${mongoUri}`);
  }
  await resetDatabase(databaseUrl);

  const mongoose = fromServer('mongoose');
  const bcrypt = fromServer('bcryptjs');
  const identity = require(path.join(serverDir, 'src', 'identity'));

  await mongoose.connect(mongoUri);
  try {
    await mongoose.connection.dropDatabase();

    const passwordHash = await bcrypt.hash(E2E.password, 10);
    const makeUser = ({ username, email, profilePicture }) => identity.users.create({
      username,
      email,
      ...(profilePicture ? { profilePicture } : {}),
      passwordHash,
      verified: true,
      userType: 'personal',
      accountStatus: 'active',
      companyRole: 'member',
      authProvider: 'local',
    });
    const alice = await makeUser(E2E.users.alice);
    const bob = await makeUser(E2E.users.bob);
    const carol = await makeUser(E2E.users.carol);

    const now = new Date();
    const workspace = await identity.workspaces.create({
      name: E2E.workspaceName,
      createdBy: alice._id,
      company: null,
      type: 'team',
      isActive: true,
      isArchived: false,
      members: [
        { user: alice._id, role: 'owner', status: 'active', joinedAt: now },
        { user: bob._id, role: 'member', status: 'active', joinedAt: now },
      ],
    });

    const out = {
      workspaceId: String(workspace._id),
      users: {
        alice: { ...E2E.users.alice, id: String(alice._id) },
        bob: { ...E2E.users.bob, id: String(bob._id) },
        carol: { ...E2E.users.carol, id: String(carol._id) },
      },
    };
    const authDir = path.join(__dirname, '..', '.auth');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'seed.json'), JSON.stringify(out, null, 2));
    return out;
  } finally {
    await mongoose.disconnect();
    await closePostgres();
  }
}

module.exports = { seed };

if (require.main === module) {
  seed(process.env.E2E_MONGO_URI || E2E.mongoUri, process.env.E2E_DATABASE_URL || E2E.databaseUrl)
    .then((out) => { console.log(JSON.stringify(out, null, 2)); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}

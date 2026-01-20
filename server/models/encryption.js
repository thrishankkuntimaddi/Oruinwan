/**
 * 🔐 E2EE Database Migration (SAFE)
 *
 * Purpose:
 * - Create UserWorkspaceKey collection
 * - NOTHING ELSE
 *
 * ❌ Does NOT touch Message schema
 * ❌ Does NOT mutate existing messages
 */

const mongoose = require('mongoose');

/* ====================
   USER WORKSPACE KEYS
==================== */

const userWorkspaceKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },

    encryptedKey: {
      type: String,
      required: true // Base64
    },

    keyIv: {
      type: String,
      required: true // Base64
    },

    pbkdf2Salt: {
      type: String,
      required: true // Base64
    },

    pbkdf2Iterations: {
      type: Number,
      default: 100000
    },

    keyVersion: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
);

userWorkspaceKeySchema.index(
  { userId: 1, workspaceId: 1 },
  { unique: true }
);

const UserWorkspaceKey = mongoose.model(
  'UserWorkspaceKey',
  userWorkspaceKeySchema
);

/* ====================
   MIGRATIONS
==================== */

async function migrateUp() {
  console.log('🔐 Creating UserWorkspaceKey indexes...');

  await UserWorkspaceKey.createIndexes();

  console.log('✅ UserWorkspaceKey migration complete');
  return { success: true };
}

async function migrateDown() {
  console.log('⚠️ Rolling back UserWorkspaceKey migration...');

  await UserWorkspaceKey.collection.drop();

  console.log('✅ Rollback complete');
  return { success: true };
}

module.exports = {
  UserWorkspaceKey,
  migrateUp,
  migrateDown
};

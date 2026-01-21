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
      required: true
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
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
   WORKSPACE MASTER KEYS
==================== */

/**
 * WorkspaceKey: Stores the master encryption key for each workspace
 * This key is used to encrypt all messages in the workspace
 * For security, it's stored encrypted with the creator's KEK
 */
const workspaceKeySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true
    },

    // Master workspace key encrypted with creator's KEK
    encryptedMasterKey: {
      type: String,
      required: true // Base64
    },

    masterKeyIv: {
      type: String,
      required: true // Base64
    },

    // Salt used to derive creator's KEK (for reference)
    creatorSalt: {
      type: String,
      required: false // Base64
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    keyVersion: {
      type: Number,
      default: 1
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const WorkspaceKey = mongoose.model('WorkspaceKey', workspaceKeySchema);

/* ====================
   MIGRATIONS
==================== */

async function migrateUp() {
  console.log('🔐 Creating UserWorkspaceKey indexes...');

  await UserWorkspaceKey.createIndexes();
  await WorkspaceKey.createIndexes();

  console.log('✅ UserWorkspaceKey migration complete');
  return { success: true };
}

async function migrateDown() {
  console.log('⚠️ Rolling back UserWorkspaceKey migration...');

  await UserWorkspaceKey.collection.drop();
  await WorkspaceKey.collection.drop();

  console.log('✅ Rollback complete');
  return { success: true };
}

module.exports = {
  UserWorkspaceKey,
  WorkspaceKey,
  migrateUp,
  migrateDown
};


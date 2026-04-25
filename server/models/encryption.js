const mongoose = require('mongoose');

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
      required: true 
    },

    keyIv: {
      type: String,
      required: true 
    },

    pbkdf2Salt: {
      type: String,
      required: true 
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

const workspaceKeySchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true
    },

    
    encryptedMasterKey: {
      type: String,
      required: true 
    },

    masterKeyIv: {
      type: String,
      required: true 
    },

    
    creatorSalt: {
      type: String,
      required: false 
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

/**
 * E2EE Database Schema Migration
 * 
 * Creates tables for end-to-end encryption key management:
 * - user_workspace_keys: Stores encrypted workspace keys per user
 * - workspace_keys: Stores workspace master keys
 * - Updates messages table to store encrypted content
 */

const mongoose = require('mongoose');

// ==================== USER WORKSPACE KEYS SCHEMA ====================

const userWorkspaceKeySchema = new mongoose.Schema({
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
    // Encrypted workspace key (encrypted with user's KEK)
    encryptedKey: {
        type: String,
        required: true // Base64-encoded encrypted workspace key
    },
    // IV used for encrypting the workspace key
    keyIv: {
        type: String,
        required: true // Base64-encoded IV
    },
    // PBKDF2 parameters for this user
    pbkdf2Salt: {
        type: String,
        required: true // Base64-encoded salt (unique per user)
    },
    pbkdf2Iterations: {
        type: Number,
        default: 100000 // PBKDF2 iteration count
    },
    // Key version for rotation
    keyVersion: {
        type: Number,
        default: 1
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index: one key per user per workspace
userWorkspaceKeySchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

const UserWorkspaceKey = mongoose.model('UserWorkspaceKey', userWorkspaceKeySchema);

// ==================== WORKSPACE KEYS SCHEMA ====================

const workspaceKeySchema = new mongoose.Schema({
    workspaceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
        unique: true,
        index: true
    },
    // Encrypted master key (encrypted with creator's KEK)
    encryptedMasterKey: {
        type: String,
        required: true // Base64-encoded
    },
    // IV for master key encryption
    masterKeyIv: {
        type: String,
        required: true // Base64-encoded
    },
    // Key version (for rotation)
    keyVersion: {
        type: Number,
        default: 1
    },
    // Key status
    isActive: {
        type: Boolean,
        default: true
    },
    // Rotation tracking
    rotatedAt: {
        type: Date,
        default: null
    },
    // Creator (first admin who created workspace)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const WorkspaceKey = mongoose.model('WorkspaceKey', workspaceKeySchema);

// ==================== UPDATED MESSAGE SCHEMA ====================

/**
 * Extended Message Schema for E2EE
 * 
 * Note: This extends the existing Message model
 * Run this migration AFTER existing messages table exists
 */

const encryptedMessageFields = {
    // Encrypted content (replaces plaintext 'content' field)
    ciphertext: {
        type: String,
        required: false // Will become required after migration
    },
    // Initialization vector for this message
    messageIv: {
        type: String,
        required: false // Will become required after migration
    },
    // Encryption metadata
    encryptionVersion: {
        type: String,
        default: 'aes-256-gcm-v1' // Algorithm version for future upgrades
    },
    // Flag to indicate if message is encrypted
    isEncrypted: {
        type: Boolean,
        default: false // Will be true for new encrypted messages
    },
    // Legacy plaintext field (for backwards compatibility during migration)
    // This will be removed in Phase 2
    content: {
        type: String,
        required: false // Make optional during transition
    }
};

// ==================== MIGRATION FUNCTIONS ====================

/**
 * Run migration to add E2EE tables
 */
async function migrateUp() {
    console.log('🔐 Starting E2EE database migration...');

    try {
        // Create indexes
        await UserWorkspaceKey.createIndexes();
        await WorkspaceKey.createIndexes();

        console.log('✅ UserWorkspaceKey indexes created');
        console.log('✅ WorkspaceKey indexes created');

        // Update Message model (extend existing)
        const Message = mongoose.model('Message');

        // Add new fields to existing messages (all null initially)
        await Message.updateMany(
            {},
            {
                $set: {
                    isEncrypted: false,
                    ciphertext: null,
                    messageIv: null,
                    encryptionVersion: null
                }
            }
        );

        console.log('✅ Message schema updated for E2EE fields');
        console.log('✅ E2EE migration complete!');

        return { success: true };
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

/**
 * Rollback migration (for testing/emergencies)
 */
async function migrateDown() {
    console.log('⚠️  Rolling back E2EE migration...');

    try {
        // Drop E2EE collections
        await UserWorkspaceKey.collection.drop();
        await WorkspaceKey.collection.drop();

        console.log('✅ E2EE collections dropped');

        // Remove E2EE fields from messages
        const Message = mongoose.model('Message');
        await Message.updateMany(
            {},
            {
                $unset: {
                    isEncrypted: '',
                    ciphertext: '',
                    messageIv: '',
                    encryptionVersion: ''
                }
            }
        );

        console.log('✅ E2EE fields removed from messages');
        console.log('✅ Migration rollback complete!');

        return { success: true };
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    UserWorkspaceKey,
    WorkspaceKey,
    encryptedMessageFields,
    migrateUp,
    migrateDown
};

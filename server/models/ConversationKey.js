/**
 * Conversation Key Model
 * 
 * Stores encrypted conversation keys for channels and DMs
 * Each conversation has ONE symmetric key, encrypted separately for each participant
 */

const mongoose = require('mongoose');

const ConversationKeySchema = new mongoose.Schema(
    {
        /**
         * Reference to conversation (Channel or DMSession)
         */
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        /**
         * Type of conversation: 'channel' or 'dm'
         */
        conversationType: {
            type: String,
            enum: ['channel', 'dm'],
            required: true
        },

        /**
         * Workspace this conversation belongs to
         */
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true
        },

        /**
         * Encrypted keys for each participant
         * Each participant has their own encrypted copy of the conversation key
         */
        encryptedKeys: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },

                /**
                 * Conversation key encrypted with user's public identity key
                 * Base64-encoded ciphertext
                 */
                encryptedKey: {
                    type: String,
                    required: true
                },

                /**
                 * For X25519: ephemeral public key used for ECIES
                 * For RSA: null (not needed)
                 */
                ephemeralPublicKey: {
                    type: String,
                    default: null
                },

                /**
                 * Algorithm used to encrypt this key
                 * Should match the user's identity key algorithm
                 */
                algorithm: {
                    type: String,
                    enum: ['X25519', 'RSA-2048'],
                    required: true
                },

                /**
                 * When this encrypted key was added
                 */
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        /**
         * Workspace-encrypted conversation key
         * Allows server to re-encrypt for new members without seeing plaintext
         * Encrypted with workspace master key (AES-256-GCM)
         */
        workspaceEncryptedKey: {
            type: String,
            required: false // Optional for backward compatibility
        },

        /**
         * IV for workspace key encryption
         */
        workspaceKeyIv: {
            type: String,
            required: false
        },

        /**
         * Auth tag for workspace key encryption (GCM mode)
         */
        workspaceKeyAuthTag: {
            type: String,
            required: false
        },

        /**
         * User who created this conversation key
         */
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        /**
         * Key version for future rotation
         */
        version: {
            type: Number,
            default: 1
        },

        /**
         * Is this key active? (for key rotation)
         */
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// Indexes for efficient lookups
ConversationKeySchema.index({ conversationId: 1, conversationType: 1 }, { unique: true });
ConversationKeySchema.index({ workspaceId: 1 });
ConversationKeySchema.index({ 'encryptedKeys.userId': 1 });

// Static method to find by conversation
ConversationKeySchema.statics.findByConversation = function (conversationId, conversationType) {
    return this.findOne({
        conversationId,
        conversationType,
        isActive: true
    });
};

// Static method to find user's accessible conversations
ConversationKeySchema.statics.findByUser = function (userId, workspaceId) {
    return this.find({
        workspaceId,
        'encryptedKeys.userId': userId,
        isActive: true
    });
};

// Instance method to check if user has access
ConversationKeySchema.methods.hasAccess = function (userId) {
    return this.encryptedKeys.some(
        ek => ek.userId.toString() === userId.toString()
    );
};

// Instance method to get user's encrypted key
ConversationKeySchema.methods.getEncryptedKeyForUser = function (userId) {
    return this.encryptedKeys.find(
        ek => ek.userId.toString() === userId.toString()
    );
};

module.exports = mongoose.model('ConversationKey', ConversationKeySchema);

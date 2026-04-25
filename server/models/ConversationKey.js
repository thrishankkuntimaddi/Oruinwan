const mongoose = require('mongoose');

const ConversationKeySchema = new mongoose.Schema(
    {
        
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        
        conversationType: {
            type: String,
            enum: ['channel', 'dm'],
            required: true
        },

        
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true
        },

        
        encryptedKeys: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true
                },

                
                encryptedKey: {
                    type: String,
                    required: true
                },

                
                ephemeralPublicKey: {
                    type: String,
                    default: null
                },

                
                algorithm: {
                    type: String,
                    enum: ['X25519', 'RSA-2048'],
                    required: true
                },

                
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        
        workspaceEncryptedKey: {
            type: String,
            required: false 
        },

        
        workspaceKeyIv: {
            type: String,
            required: false
        },

        
        workspaceKeyAuthTag: {
            type: String,
            required: false
        },

        
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        
        version: {
            type: Number,
            default: 1
        },

        
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

ConversationKeySchema.index({ conversationId: 1, conversationType: 1 }, { unique: true });
ConversationKeySchema.index({ workspaceId: 1 });
ConversationKeySchema.index({ 'encryptedKeys.userId': 1 });

ConversationKeySchema.statics.findByConversation = function (conversationId, conversationType) {
    return this.findOne({
        conversationId,
        conversationType,
        isActive: true
    });
};

ConversationKeySchema.statics.findByUser = function (userId, workspaceId) {
    return this.find({
        workspaceId,
        'encryptedKeys.userId': userId,
        isActive: true
    });
};

ConversationKeySchema.methods.hasAccess = function (userId) {
    return this.encryptedKeys.some(
        ek => ek.userId.toString() === userId.toString()
    );
};

ConversationKeySchema.methods.getEncryptedKeyForUser = function (userId) {
    return this.encryptedKeys.find(
        ek => ek.userId.toString() === userId.toString()
    );
};

module.exports = mongoose.model('ConversationKey', ConversationKeySchema);

const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
    'mention',           
    'dm',                
    'task_assigned',     
    'task_comment',      
    'task_due_soon',     
    'member_joined',     
    'channel_pinned',    
    'huddle_started',    
    'schedule_created',  
    'meeting_reminder',  
    'reaction',          
    'thread_reply',      
    'integration_alert', 
    'ai_suggestion',     
    'digest',            
];

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true,
        },
        title: {
            type: String,
            required: true,
            maxlength: 200,
        },
        body: {
            type: String,
            default: '',
            maxlength: 500,
        },
        
        link: {
            type: String,
            default: null,
        },
        
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
        
        channel: {
            type: String,
            enum: ['in-app', 'email', 'push'],
            default: 'in-app',
        },
    },
    { timestamps: true }
);

notificationSchema.index({ recipient: 1, workspaceId: 1, createdAt: -1 });

notificationSchema.index({ recipient: 1, workspaceId: 1, read: 1 });

notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);

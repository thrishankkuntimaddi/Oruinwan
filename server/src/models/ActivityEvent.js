'use strict';

const mongoose = require('mongoose');

const ACTIVITY_TYPES = ['message', 'task', 'note', 'ai', 'update', 'meeting', 'reaction'];
const ACTIVITY_SUBTYPES = [
  
  'sent', 'deleted', 'edited',
  
  'created', 'completed', 'assigned', 'updated',
  
  'created', 'updated', 'deleted',
  
  'chat', 'summary', 'task_generated',
  
  'posted',
  
  'scheduled', 'started', 'ended',
  
  'added',
];

const activityEventSchema = new mongoose.Schema(
  {
    
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
      index: true,
    },

    
    subtype: {
      type: String,
      enum: ACTIVITY_SUBTYPES,
    },

    
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },

    
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,   
    versionKey: false,
  }
);

activityEventSchema.index({ workspaceId: 1, createdAt: -1 });

activityEventSchema.index({ actor: 1, createdAt: -1 });

const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);

module.exports = ActivityEvent;
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;

const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, 

  name: { type: String, required: true },
  description: { type: String, default: "" },
  topic: { type: String, default: "" }, 

  
  isPrivate: { type: Boolean, default: false },
  isDiscoverable: { type: Boolean, default: true }, 
  isDefault: { type: Boolean, default: false }, 
  isPublic: { type: Boolean, default: false }, 
  isArchived: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    
    
    lastSeenMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }
  }],

  
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  
  lastMessageAt: { type: Date, default: null },
  messageCount: { type: Number, default: 0 },

  
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],

  
  tabs: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['canvas', 'tasks'], default: 'canvas' },
    content: { type: String, default: "" }, 
    drawingData: { type: Array, default: [] }, 
    emoji: { type: String, default: "📄" }, 
    coverColor: { type: String, default: "#6366F1" }, 
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastEditedAt: { type: Date, default: null },
    wordCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

ChannelSchema.index({ workspace: 1, name: 1 }, { unique: true }); 
ChannelSchema.index({ company: 1, isPrivate: 1 });
ChannelSchema.index({ 'members.user': 1 }); 

ChannelSchema.index({ name: 'text', description: 'text', topic: 'text' });

ChannelSchema.methods.isMember = function (userId) {
  if (!this.isPrivate || this.isDefault) return true; 

  
  return this.members.some(m => {
    const memberId = m.user ? m.user.toString() : m.toString();
    return memberId === userId.toString();
  });
};

ChannelSchema.methods.getUserJoinDate = function (userId) {
  const member = this.members.find(m => {
    const memberId = m.user ? m.user.toString() : m.toString();
    return memberId === userId.toString();
  });

  
  
  return member?.joinedAt || new Date();
};

ChannelSchema.methods.isAdmin = function (userId) {
  return this.admins.some(adminId => adminId.toString() === userId.toString());
};

ChannelSchema.methods.isOnlyAdmin = function (userId) {
  return this.admins.length === 1 && this.isAdmin(userId);
};

module.exports = mongoose.model("Channel", ChannelSchema);

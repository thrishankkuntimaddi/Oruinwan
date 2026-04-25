const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  emoji: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { _id: false });

const ChecklistItemSchema = new mongoose.Schema({
  text:       { type: String, required: true },
  checked:    { type: Boolean, default: false },
  checkedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checkedAt:  { type: Date, default: null },
  order:      { type: Number, default: 0 },
}, { _id: true });

const AttachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video', 'file', 'audio', 'voice'], required: true },
  url: String,
  name: String,
  size: Number,
  mimeType: String,   
  duration: Number,   
  thumbnail: String,   
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  dm: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },
  platformSession: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformSession", default: null }, 
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  
  type: {
    type: String,
    enum: [
      'message',          
      'system',           
      'poll',             
      'file',             
      'image',            
      'video',            
      'voice',            
      'contact',          
      'meeting',          
      'checklist',        
      'screen_recording', 
    ],
    default: 'message'
  },

  
  systemEvent: {
    type: String,
    enum: [
      'channel_created',
      'member_joined', 'member_left', 'member_removed', 'member_invited',
      'admin_assigned', 'admin_demoted',
      'channel_renamed', 'channel_desc_changed', 'channel_privacy_changed',
      'message_pinned', 'message_unpinned',
      'messages_cleared',
      null
    ],
    default: null
  },
  systemData: { type: mongoose.Schema.Types.Mixed, default: null }, 

  
  
  
  payload: {
    ciphertext: String,
    messageIv: String,
    isEncrypted: { type: Boolean, default: false }
  },

  text: { type: String, default: '' },

  
  attachments: [AttachmentSchema],

  

  
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    allowMultiple: { type: Boolean, default: false },
    anonymous: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endDate: Date,
    isActive: { type: Boolean, default: true },     
    totalVotes: { type: Number, default: 0 },         
  },

  
  contact: {
    name: String,
    email: String,
    phone: String,
    avatar: String
  },

  
  meeting: {
    title: String,
    startTime: Date,
    duration: Number,   
    meetingLink: String,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },

  
  linkPreview: {
    url: String,
    title: String,
    description: String,
    image: String,
    site: String
  },

  
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, 
  replyCount: { type: Number, default: 0, min: 0 }, 
  lastReplyAt: { type: Date, default: null }, 

  
  
  quotedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

  reactions: [ReactionSchema],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  
  
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

  
  
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  
  checklist: [ChecklistItemSchema],

  
  
  resolvedThreadAt: { type: Date, default: null },
  resolvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  
  
  linkedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

  
  isPinned: { type: Boolean, default: false },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  pinnedAt: { type: Date, default: null },

  
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deletedByName: { type: String, default: null },  
  deletedAt: { type: Date, default: null },
  isDeletedUniversally: { type: Boolean, default: false },
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 

  
  bookmarkedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  
  editedAt: { type: Date, default: null },
  
  editHistory: [{
    text:       { type: String, default: null },     
    ciphertext: { type: String, default: null },     
    messageIv:  { type: String, default: null },     
    isEncrypted:{ type: Boolean, default: false },   
    editedAt:   { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false },    
  version: { type: Number, default: 1 },           
}, { timestamps: true });

MessageSchema.index({ text: 'text' });
MessageSchema.index({ company: 1, channel: 1, createdAt: -1 });
MessageSchema.index({ company: 1, dm: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, createdAt: -1 }); 
MessageSchema.index({ platformSession: 1, createdAt: -1 });
MessageSchema.index({ parentId: 1 }); 
MessageSchema.index({ createdAt: -1 });

MessageSchema.index({ channel: 1, _id: 1 });
MessageSchema.index({ dm: 1, _id: 1 });

module.exports = mongoose.model("Message", MessageSchema);

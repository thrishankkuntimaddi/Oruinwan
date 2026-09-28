const logger = require('../../../utils/logger');
const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  emoji: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { _id: false });

const ChecklistItemSchema = new mongoose.Schema({
  text:       { type: String, default: '' }, // empty for encrypted checklists (text is in the ciphertext)
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
  duration: Number,   // seconds (voice notes, videos)
  thumbnail: String,   
  width: Number,       // pixels, when known (images/videos), to reserve space before load
  height: Number,
  variant: { type: String, enum: ['video_note', 'screen_recording'], default: undefined },
}, { _id: false });

// Plaintext metadata of an integration card (GitHub / Jira). The human summary
// line is still stored end-to-end encrypted in `payload` like any text message.
const IntegrationCardSchema = new mongoose.Schema({
  provider:     { type: String, enum: ['github', 'gitlab', 'jira'], required: true },
  kind:         { type: String, enum: ['pull_request', 'pr_review', 'issue', 'push', 'checks', 'jira_issue'], required: true },
  action:       { type: String, default: null },
  repo:         { type: String, default: null },   // owner/name (GitHub) or project key (Jira)
  number:       { type: Number, default: null },
  key:          { type: String, default: null },   // Jira issue key, e.g. ABC-12
  url:          { type: String, default: null },
  title:        { type: String, default: null },
  state:        { type: String, default: null },   // open | closed | merged | draft (Jira: status name)
  author:       { type: String, default: null },
  authorAvatar: { type: String, default: null },
  branch:       { type: String, default: null },
  base:         { type: String, default: null },
  additions:    { type: Number, default: null },
  deletions:    { type: Number, default: null },
  changedFiles: { type: Number, default: null },
  commits:      { type: Number, default: null },
  reviewState:  { type: String, default: null },
  checks:       { type: mongoose.Schema.Types.Mixed, default: null }, // { status, conclusion }
  taskIds:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  taskKeys:     [{ type: String }],
  extra:        { type: mongoose.Schema.Types.Mixed, default: null },  // push: { commitCount, compareUrl, headCommit }
  updatedAt:    { type: Date, default: Date.now },
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
      'integration',      // card posted by an integration bot (GitHub PR, Jira issue, ...)
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
      'dm_message_pinned', 'dm_message_unpinned',
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

  
  integration: { type: IntegrationCardSchema, default: undefined },

  
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
    editedAt:   { type: Date, default: Date.now },
    // Set when this historical state was itself produced by restoring an older version.
    restoredFromVersion: { type: Number, default: null }
  }],
  // Version number the current content was restored from (null after a normal edit).
  restoredFromVersion: { type: Number, default: null },
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
// One integration card per external object (PR / issue URL) per channel.
MessageSchema.index({ 'integration.url': 1, channel: 1 }, { sparse: true });
MessageSchema.index({ dm: 1, _id: 1 });

MessageSchema.pre("save", function (next) {
  this._wasNew = this.isNew;
  next();
});

MessageSchema.post("save", async function (doc) {
  if (doc._wasNew && doc.channel) {
    try {
      const Channel = mongoose.model("Channel");
      await Channel.findByIdAndUpdate(doc.channel, {
        $inc: { messageCount: 1 },
        $set: { lastMessageAt: doc.createdAt }
      });
    } catch (err) {
      logger.error("[Message Schema post-save] Failed to update channel counters:", err);
    }
  }
});

module.exports = mongoose.model("Message", MessageSchema);

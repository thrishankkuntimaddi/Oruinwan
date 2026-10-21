const mongoose = require('mongoose');

/**
 * A marketplace app. First-party apps are seeded (no owner, status approved);
 * developer apps are created from the Developer portal and go through review:
 *
 *   draft ──submit──▶ submitted ──approve──▶ approved (listed in the marketplace)
 *     ▲                  │  └──────reject──▶ rejected ──edit/submit──▶ submitted
 *     └────withdraw──────┘
 *
 * Installing an approved app issues a workspace-scoped app token (an ApiKey with
 * appId set and the app's declared scopes) and, if the app declares a bot user,
 * a Bot. Uninstalling revokes both.
 */

const APP_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];
const APP_CATEGORIES = ['productivity', 'communication', 'developer', 'automation', 'analytics'];
// Scopes an app may request (the public API scopes; no wildcard, no webhook admin).
const APP_SCOPES = ['messages:read', 'tasks:read', 'tasks:write', 'files:read', 'users:read', 'channels:read'];

const appSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: APP_CATEGORIES,
    default: 'productivity'
  },
  iconUrl: {
    type: String,
    default: null
  },

  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  installedIn: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  developer: {
    type: String,
    default: 'Oruinwan'
  },
  version: {
    type: String,
    default: '1.0.0'
  },

  // ── Developer-submitted apps ──────────────────────────────────────────────
  // Missing on legacy/seeded rows, which count as approved (see APPROVED_QUERY).
  status: { type: String, enum: APP_STATUSES, default: 'approved', index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  homepageUrl: { type: String, default: null },
  webhookUrl: { type: String, default: null },
  redirectUrl: { type: String, default: null },
  scopes: { type: [{ type: String, enum: APP_SCOPES }], default: [] },
  botUser: {
    enabled: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 80, default: null },
  },
  // HMAC key for install/uninstall deliveries to webhookUrl. Only the owner sees it.
  signingSecret: { type: String, default: null, select: false },
  submittedAt: { type: Date, default: null },
  review: {
    note: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
}, {
  timestamps: true
});

/** Apps visible in the marketplace. Rows without a status predate review and are approved. */
const APPROVED_QUERY = {
  isPublished: { $ne: false },
  $or: [{ status: 'approved' }, { status: { $exists: false } }, { status: null }],
};

module.exports = mongoose.model('App', appSchema);
module.exports.APP_STATUSES = APP_STATUSES;
module.exports.APP_CATEGORIES = APP_CATEGORIES;
module.exports.APP_SCOPES = APP_SCOPES;
module.exports.APPROVED_QUERY = APPROVED_QUERY;

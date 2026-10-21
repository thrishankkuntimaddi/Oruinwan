const mongoose = require('mongoose');

/** One rating per user per community template. */
const templateRatingSchema = new mongoose.Schema({
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceTemplate', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });

templateRatingSchema.index({ templateId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TemplateRating', templateRatingSchema);

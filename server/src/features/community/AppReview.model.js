// server/src/features/community/AppReview.model.js
// Ratings & reviews for marketplace apps
const mongoose = require('mongoose');

const appReviewSchema = new mongoose.Schema({
  appId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'App',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    default: '',
    maxlength: 1000,
    trim: true
  }
}, {
  timestamps: true
});

// One review per user per app
appReviewSchema.index({ appId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AppReview', appReviewSchema);

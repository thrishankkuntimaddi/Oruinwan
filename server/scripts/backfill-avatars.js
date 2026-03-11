/**
 * scripts/backfill-avatars.js
 *
 * One-time script: assign a DiceBear avatar URL to every User
 * that currently has no profilePicture set.
 *
 * Usage:
 *   cd server
 *   node scripts/backfill-avatars.js
 */

require('dotenv').config(); // loads server/.env
// Fallback: try parent .env (monorepo setups)
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  require('dotenv').config({ path: '../.env' });
}


const mongoose = require('mongoose');
const User = require('../models/User');

// ─── Avatar generator (mirrors client/src/utils/avatarUtils.js) ────────────

const BG_COLORS = [
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc',
  'ffdfbf', 'c1f0c8', 'f9d8b0', 'ffe4a0',
];

function pickBgColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

function generateAvatarUrl(userId) {
  const seed = String(userId);
  const bg = pickBgColor(seed);
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}&radius=50`;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ No MONGODB_URI / MONGO_URI found in environment. Add it to .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('✅ Connected');

  // Find all users with a missing or empty profilePicture
  const users = await User.find({
    $or: [
      { profilePicture: { $exists: false } },
      { profilePicture: null },
      { profilePicture: '' },
    ],
  }).select('_id username').lean();

  console.log(`📊 Found ${users.length} user(s) without a profile picture`);

  if (users.length === 0) {
    console.log('✅ Nothing to do — all users already have avatars.');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const user of users) {
    const avatarUrl = generateAvatarUrl(user._id);
    await User.updateOne({ _id: user._id }, { $set: { profilePicture: avatarUrl } });
    updated++;
    if (updated % 50 === 0) {
      console.log(`  … ${updated}/${users.length} updated`);
    }
  }

  console.log(`✅ Done — ${updated} user(s) backfilled with DiceBear avatars`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  mongoose.disconnect();
  process.exit(1);
});

'use strict';

const axios = require('axios');
const User = require('../../../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendRaw(token, title, body, data = {}) {
  if (!token) return;

  try {
    await axios.post(
      EXPO_PUSH_URL,
      {
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log(`[Push] Sent to ${token.slice(0, 30)}…`);
  } catch (err) {
    console.error(`[Push] Failed to send to ${token}:`, err.message);
  }
}

async function sendToUser(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId).select('deviceTokens').lean();
    if (!user || !user.deviceTokens || user.deviceTokens.length === 0) return;

    const sends = user.deviceTokens.map(({ token }) => sendRaw(token, title, body, data));
    await Promise.allSettled(sends);
  } catch (err) {
    console.error(`[Push] sendToUser error for ${userId}:`, err.message);
  }
}

async function notifyNewMessage(recipientId, senderName, preview, dmSessionId) {
  await sendToUser(
    recipientId,
    `💬 ${senderName}`,
    preview,
    { type: 'message', dmSessionId }
  );
}

async function notifyTaskReminder(userId, taskTitle) {
  await sendToUser(userId, '📋 Task Reminder', taskTitle, { type: 'task' });
}

module.exports = { sendRaw, sendToUser, notifyNewMessage, notifyTaskReminder };

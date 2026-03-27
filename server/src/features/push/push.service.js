/**
 * Chttrix — Push Notification Service
 *
 * Dispatches push notifications to registered mobile device tokens.
 * Currently implements the Expo Push Notification API as a thin stub.
 * To switch to FCM/APNs, replace the `sendRaw` implementation.
 */
'use strict';

const axios = require('axios');
const User = require('../../../models/User');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a push notification to a single Expo push token.
 * @param {string} token   - Expo push token (ExponentPushToken[...])
 * @param {string} title
 * @param {string} body
 * @param {object} [data]  - Extra data payload for the app
 */
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

/**
 * Send a push notification to all registered devices for a user.
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
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

/**
 * Send a message notification to a user.
 * @param {string} recipientId    - User to notify
 * @param {string} senderName     - Display name of the sender
 * @param {string} preview        - Message preview text
 * @param {string} [dmSessionId]  - For deep-link routing in the app
 */
async function notifyNewMessage(recipientId, senderName, preview, dmSessionId) {
  await sendToUser(
    recipientId,
    `💬 ${senderName}`,
    preview,
    { type: 'message', dmSessionId }
  );
}

/**
 * Send a task-reminder notification to a user.
 * @param {string} userId
 * @param {string} taskTitle
 */
async function notifyTaskReminder(userId, taskTitle) {
  await sendToUser(userId, '📋 Task Reminder', taskTitle, { type: 'task' });
}

module.exports = { sendRaw, sendToUser, notifyNewMessage, notifyTaskReminder };

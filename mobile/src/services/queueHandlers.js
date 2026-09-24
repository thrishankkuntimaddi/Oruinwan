/** Registers the offline-queue handlers (imported once from App.js). */
import { registerQueueHandler } from './offlineQueue';
import { sendChannelMessageApi, sendDirectMessageApi } from './api/messages';
import { updateTask } from './api/tasks';

registerQueueHandler('SEND_CHANNEL_MESSAGE', async (payload) => {
  const { data } = await sendChannelMessageApi(payload);
  return data?.message;
});

registerQueueHandler('SEND_DM_MESSAGE', async (payload) => {
  const { data } = await sendDirectMessageApi(payload);
  return data?.message;
});

registerQueueHandler('UPDATE_TASK', async ({ taskId, updates }) => {
  const { data } = await updateTask(taskId, updates);
  return data?.task;
});

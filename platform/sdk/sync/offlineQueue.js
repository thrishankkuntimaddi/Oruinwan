/**
 * platform/sdk/sync/offlineQueue.js
 *
 * Queues operations performed while the device is offline so they can be
 * replayed once connectivity is restored.
 *
 * Example operation shapes:
 *   { type: 'sendMessage', payload: { ... } }
 *   { type: 'updateTask',  payload: { ... } }
 *   { type: 'editNote',    payload: { ... } }
 *
 * This module is framework-independent and platform-independent.
 * It is safe to use from web, desktop (Electron), and mobile (React Native).
 */

// TODO: Replace this in-memory array with a persistent store once the
//       persistence layer is ready:
//         - Web:     IndexedDB (via idb or localForage)
//         - Desktop: SQLite via better-sqlite3 or electron-store
//         - Mobile:  AsyncStorage or SQLite via react-native-sqlite-storage
const queue = [];

/**
 * Add an operation to the end of the queue.
 *
 * @param {Object} operation - The operation to enqueue.
 * @param {string} operation.type    - Operation identifier (e.g. 'sendMessage').
 * @param {Object} operation.payload - Arbitrary data required to replay the op.
 */
export function enqueue(operation) {
  queue.push(operation);
}

/**
 * Remove and return the first operation from the queue (FIFO).
 *
 * @returns {Object|undefined} The next operation, or undefined if the queue is empty.
 */
export function dequeue() {
  return queue.shift();
}

/**
 * Return a shallow copy of the current queue without mutating it.
 *
 * @returns {Object[]} Snapshot of all pending operations.
 */
export function getQueue() {
  return [...queue];
}

/**
 * Remove all pending operations from the queue.
 *
 * TODO: When persistent storage is added, this must also clear the
 *       underlying store to prevent stale operations from being replayed
 *       after a hard reload.
 */
export function clearQueue() {
  queue.length = 0;
}

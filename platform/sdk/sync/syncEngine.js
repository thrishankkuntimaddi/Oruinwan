/**
 * platform/sdk/sync/syncEngine.js
 *
 * Central coordinator for multi-device synchronization.
 *
 * Responsibilities:
 *   1. Accept operations queued while offline via `queueOperation`.
 *   2. Replay queued operations when connectivity is restored via `flushQueue`.
 *   3. Delegate conflict resolution to the conflictResolver via `resolve`.
 *
 * This module is framework-independent and platform-independent.
 * It is safe to use from web, desktop (Electron), and mobile (React Native).
 * It contains no React code, no Electron code, and no Service Worker logic.
 */

import { enqueue, getQueue, clearQueue } from './offlineQueue.js';
import { resolveConflict } from './conflictResolver.js';

/**
 * Enqueue an operation to be executed once the device is back online.
 *
 * @param {Object} operation - The operation to queue.
 * @param {string} operation.type    - Operation identifier (e.g. 'sendMessage').
 * @param {Object} operation.payload - Data required to replay the operation.
 */
export function queueOperation(operation) {
  enqueue(operation);
}

/**
 * Attempt to replay all queued operations through the appropriate transport
 * layer (API or socket) once the device regains connectivity.
 *
 * TODO: Implement actual replay logic here once the platform transport layer
 *       is finalised. Steps will include:
 *         1. Iterate over getQueue() in FIFO order.
 *         2. Route each operation to the correct SDK handler
 *            (e.g. platform/sdk/api or platform/sdk/socket).
 *         3. On successful replay, dequeue the operation.
 *         4. On failure, apply a back-off retry strategy.
 *         5. Emit progress/completion events for the UI layer to consume.
 *
 * TODO: Consider adding a "sync lock" flag so that concurrent flush calls
 *       do not result in duplicate operation submissions.
 */
export function flushQueue() {
  const operations = getQueue();

  if (operations.length === 0) {
    // Nothing to replay.
    return;
  }

  // TODO: Replace this placeholder with real transport-layer replay.
  //       The transport integration point will live here, keeping the sync
  //       engine decoupled from any specific API or socket implementation.
  console.warn(
    `[SyncEngine] flushQueue called with ${operations.length} pending operation(s). ` +
    'Replay is not yet implemented.'
  );

  // TODO: Only call clearQueue() after all operations have been successfully
  //       confirmed by the server. Premature clearing risks data loss on
  //       partial failure.
  clearQueue();
}

/**
 * Resolve a conflict between a local and a remote version of an entity.
 *
 * Delegates to the shared conflictResolver strategy so that callers do not
 * need to import the resolver directly.
 *
 * @param {Object} local  - The locally-held version of the entity.
 * @param {Object} remote - The remote version of the entity.
 * @returns {Object} The authoritative version after resolution.
 */
export function resolve(local, remote) {
  return resolveConflict(local, remote);
}

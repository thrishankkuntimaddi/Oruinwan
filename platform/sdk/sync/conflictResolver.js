/**
 * platform/sdk/sync/conflictResolver.js
 *
 * Defines conflict resolution strategies for situations where multiple
 * devices have updated the same entity simultaneously.
 *
 * Current strategy: Last-Write-Wins (LWW) based on `updatedAt` timestamp.
 *
 * This module is framework-independent and platform-independent.
 * It is safe to use from web, desktop (Electron), and mobile (React Native).
 */

/**
 * Resolve a conflict between a locally-held version and a remotely-received
 * version of the same entity.
 *
 * Both versions must carry an `updatedAt` field (Unix ms timestamp or ISO
 * 8601 string — anything comparable with the > operator).
 *
 * @param {Object} localVersion  - The version held by this device.
 * @param {Object} remoteVersion - The version received from another device or server.
 * @returns {Object} The version that should be treated as authoritative.
 *
 * TODO: The current Last-Write-Wins strategy is a placeholder.
 *       Future strategies to consider:
 *         - CRDT (Conflict-free Replicated Data Types) for append-only structures
 *           such as message lists and activity feeds.
 *         - Three-way merge for rich text / document fields (similar to Git merge).
 *         - Operational Transformation (OT) for collaborative editing sessions.
 *         - User-prompted resolution for high-stakes conflicts (e.g. task assignments).
 *
 * TODO: When the above strategies are introduced, this function should accept
 *       a `strategy` option so callers can select the appropriate algorithm
 *       per entity type.
 */
export function resolveConflict(localVersion, remoteVersion) {
  // Last-Write-Wins: prefer whichever version has the more recent timestamp.
  if (localVersion.updatedAt > remoteVersion.updatedAt) {
    return localVersion;
  }

  // If timestamps are equal or the remote is newer, defer to the remote version.
  // TODO: Equal-timestamp ties should be broken deterministically (e.g. by
  //       device ID or a vector clock) once those concepts are introduced.
  return remoteVersion;
}

/**
 * platform/sdk/events/activityEvents.js
 *
 * Canonical Activity Event Constants
 *
 * Single source of truth for every (type, subtype) pair used in the
 * Unified Activity Stream.  Import these into:
 *   - Server controllers / services
 *   - Socket handlers
 *   - Client feed renderers
 *   - Tests
 *
 * Usage:
 *   import { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } from 'platform/sdk/events/activityEvents';
 *   activityService.emit(req, { type: ACTIVITY_TYPES.MESSAGE, subtype: ACTIVITY_SUBTYPES.SENT, ... });
 */

'use strict';

// ---------------------------------------------------------------------------
// Primary event types  (must stay in sync with ActivityEvent.js Mongoose enum)
// ---------------------------------------------------------------------------
const ACTIVITY_TYPES = Object.freeze({
  MESSAGE:  'message',
  TASK:     'task',
  NOTE:     'note',
  AI:       'ai',
  UPDATE:   'update',
  MEETING:  'meeting',
  REACTION: 'reaction',
});

// ---------------------------------------------------------------------------
// Subtypes  (namespaced by parent type for clarity)
// ---------------------------------------------------------------------------
const ACTIVITY_SUBTYPES = Object.freeze({
  // message
  SENT:           'sent',
  EDITED:         'edited',
  DELETED:        'deleted',

  // task
  CREATED:        'created',
  UPDATED:        'updated',
  COMPLETED:      'completed',
  ASSIGNED:       'assigned',

  // note  (shares CREATED, UPDATED, DELETED with task)

  // ai
  CHAT:           'chat',
  SUMMARY:        'summary',
  TASK_GENERATED: 'task_generated',

  // update
  POSTED:         'posted',

  // meeting
  SCHEDULED:      'scheduled',
  STARTED:        'started',
  ENDED:          'ended',

  // reaction
  ADDED:          'added',
});

// ---------------------------------------------------------------------------
// Socket event names emitted on workspace:<id> room
// ---------------------------------------------------------------------------
const SOCKET_EVENTS = Object.freeze({
  ACTIVITY_NEW:     'activity:new',
  TASK_CREATED:     'task:created',
  TASK_UPDATED:     'task:updated',
  TASK_ASSIGNED:    'task:assigned',
  TASK_COMPLETED:   'task:completed',
});

module.exports = { ACTIVITY_TYPES, ACTIVITY_SUBTYPES, SOCKET_EVENTS };

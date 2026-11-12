import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { TASK_STATUSES, TASK_TRANSITIONS, canTransition } from '../../../platform/tasks/taskRules.js';
import { STATUS_META, TASK_TRANSITIONS as PHONE } from './constants.js';
import { BOARD_STATUSES } from '../features/tasks/planning.js';

const require = createRequire(import.meta.url);
const server = require('../../../server/utils/workflowValidator.js');

describe('task workflow is one rule everywhere', () => {
  it('the shared rules match what the server enforces', () => {
    for (const from of TASK_STATUSES) {
      expect([...TASK_TRANSITIONS[from]].sort(), from).toEqual([...server.getAllowedTransitions(from)].sort());
      for (const to of TASK_STATUSES) expect(canTransition(from, to), `${from}→${to}`).toBe(server.isValidTransition(from, to));
    }
  });

  it('the phone uses the shared rules and labels (no own copy)', () => {
    expect(PHONE).toBe(TASK_TRANSITIONS);
    expect(canTransition('backlog', 'done')).toBe(true); // was refused on the phone before
    expect(canTransition('todo', 'blocked')).toBe(true);
    expect(STATUS_META.review.label).toBe('In review');
    expect(BOARD_STATUSES[0]).toBe('backlog');
  });
});

import { describe, it, expect } from 'vitest';
import {
  suggestStepId, validateStepIds, variablesFor, insertToken, unknownStepRefs, normaliseCondition,
  conditionInputValue, conditionComplete, looksLikeSchedule, buildAutomationPayload, moveItem, parseSampleData,
} from '../pages/workspace/automationLogic';

describe('automation step ids', () => {
  it('suggests a free id per step type', () => {
    expect(suggestStepId('create_task', [])).toBe('task');
    expect(suggestStepId('create_task', ['task', 'task2'])).toBe('task3');
    expect(suggestStepId('send_message', ['task'])).toBe('message');
    expect(suggestStepId('mystery', [])).toBe('step');
  });

  it('flags invalid and duplicate ids but allows blanks', () => {
    const errors = validateStepIds([{ id: 'ok' }, { id: '' }, { id: '1bad' }, { id: 'ok' }, { id: 'has space' }]);
    expect(errors.map((e) => e.index)).toEqual([2, 3, 4]);
    expect(errors[1].message).toMatch(/earlier step/);
  });
});

describe('automation variables', () => {
  const actions = [
    { id: 'announce', type: 'send_message' },
    { id: '', type: 'create_task' },
    { id: 'assign', type: 'assign_task' },
  ];

  it('offers trigger fields with the noun alias, and no step outputs for the first step', () => {
    const groups = variablesFor('task.created', actions, 0);
    expect(groups[0].group).toBe('Trigger');
    expect(groups[0].items.map((i) => i.token)).toContain('{{task.title}}');
    expect(groups.find((g) => g.group === 'Previous step')).toBeUndefined();
    expect(groups.at(-1).items[0].token).toBe('{{now}}');
  });

  it('offers previous.x and steps.<id>.x (index when there is no id) for later steps', () => {
    const groups = variablesFor('github.pr_merged', actions, 2);
    const tokens = groups.flatMap((g) => g.items.map((i) => i.token));
    expect(tokens).toContain('{{previous.taskId}}');
    expect(tokens).toContain('{{steps.announce.messageId}}');
    expect(tokens).toContain('{{steps.1.issueKey}}');
    expect(tokens).not.toContain('{{steps.assign.taskId}}');
    expect(tokens).toContain('{{github.repo}}');
    expect(groups.some((g) => g.group === 'Raw payload')).toBe(true);
  });

  it('inserts a token at the caret or the end', () => {
    expect(insertToken('Hello ', '{{now}}')).toEqual({ value: 'Hello {{now}}', caret: 13 });
    expect(insertToken('ab', 'X', 1, 1)).toEqual({ value: 'aXb', caret: 2 });
    expect(insertToken('abc', 'X', 0, 3).value).toBe('X');
  });

  it('reports references to steps that do not exist yet', () => {
    expect(unknownStepRefs('{{steps.announce.messageId}} {{steps.0.x}}', actions, 1)).toEqual([]);
    expect(unknownStepRefs('{{steps.assign.taskId}}', actions, 1)).toEqual(['assign']);
    expect(unknownStepRefs('{{previous.taskId}}', actions, 0)).toEqual(['previous']);
  });
});

describe('automation conditions', () => {
  it('normalises values per operator', () => {
    expect(normaliseCondition({ field: ' priority ', operator: 'in', value: 'high, urgent,' })).toEqual({ field: 'priority', operator: 'in', value: ['high', 'urgent'] });
    expect(normaliseCondition({ field: 'size', operator: 'greater_than', value: '10' }).value).toBe(10);
    expect(normaliseCondition({ field: 'due', operator: 'less_than', value: '2026-01-01' }).value).toBe('2026-01-01');
    expect(normaliseCondition({ field: 'x', operator: 'exists', value: 'false' }).value).toBe(false);
    expect(normaliseCondition({ field: 'x', operator: 'exists', value: true }).value).toBe(true);
    expect(normaliseCondition({ field: 'repo', operator: 'matches', value: '^web' })).toEqual({ field: 'repo', operator: 'matches', value: '^web' });
  });

  it('knows when a condition is filled in', () => {
    expect(conditionComplete({ field: 'a', operator: 'exists' })).toBe(true);
    expect(conditionComplete({ field: '', operator: 'equals', value: 'x' })).toBe(false);
    expect(conditionComplete({ field: 'a', operator: 'equals', value: '' })).toBe(false);
    expect(conditionInputValue({ value: ['a', 'b'] })).toBe('a, b');
  });
});

describe('automation schedules and payload', () => {
  it('pre-checks schedules', () => {
    expect(looksLikeSchedule({ type: 'interval', expression: '2h' })).toBe(true);
    expect(looksLikeSchedule({ type: 'interval', expression: 'soon' })).toBe(false);
    expect(looksLikeSchedule({ type: 'cron', expression: '30 9 * * 1-5' })).toBe(true);
    expect(looksLikeSchedule({ type: 'cron', expression: '@daily' })).toBe(true);
    expect(looksLikeSchedule({ type: 'cron', expression: '30 9 *' })).toBe(false);
  });

  it('builds the save payload', () => {
    const payload = buildAutomationPayload({
      name: '  Ship ', description: '', trigger: { type: 'scheduled', config: {} },
      conditions: [{ field: 'priority', operator: 'in', value: 'high,urgent' }, { field: '', operator: 'equals', value: '' }],
      conditionLogic: 'any',
      actions: [{ id: ' announce ', name: '', type: 'send_message', config: { text: 'hi' } }, { id: '', type: 'create_task', config: {}, continueOnError: true }],
      schedule: { type: 'cron', expression: ' 0 9 * * 1 ', timezone: 'Europe/Berlin' },
      isActive: true,
    }, 'ws1');
    expect(payload).toEqual({
      workspaceId: 'ws1', name: 'Ship', description: '', trigger: { type: 'scheduled', config: {} },
      conditions: [{ field: 'priority', operator: 'in', value: ['high', 'urgent'] }],
      conditionLogic: 'any',
      actions: [{ type: 'send_message', config: { text: 'hi' }, id: 'announce' }, { type: 'create_task', config: {}, continueOnError: true }],
      isActive: true,
      schedule: { type: 'cron', expression: '0 9 * * 1', timezone: 'Europe/Berlin' },
    });
    expect(buildAutomationPayload({ name: 'x', trigger: { type: 'task.created' }, actions: [] }, 'w').schedule).toBeNull();
  });

  it('moves steps and parses sample data', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(parseSampleData('')).toEqual({ data: {} });
    expect(parseSampleData('{"a":1}')).toEqual({ data: { a: 1 } });
    expect(parseSampleData('[1]').error).toMatch(/object/);
    expect(parseSampleData('{').error).toMatch(/JSON/);
  });
});

'use strict';

jest.mock('../../../modules/notifications/notificationEventEmitter', () => ({ emit: jest.fn() }));

const emitter = require('../../../modules/notifications/notificationEventEmitter');
const { emitCreated, emitCompleted, taskEventData } = require('../tasks.events');

beforeEach(() => jest.clearAllMocks());

const task = {
    _id: 't1', workspace: 'w1', title: 'Ship', status: 'todo', priority: 'high', tags: ['a'],
    assignedTo: [{ _id: 'u2', username: 'bo' }], createdBy: { _id: 'u1' }, issueKey: 'ENG-1',
};

test('task.created for every created task (create and subtask shapes)', () => {
    const io = {};
    const result = { tasks: [task, { ...task, _id: 't2' }] };
    expect(emitCreated(result, 'u1', io)).toBe(result);
    expect(emitter.emit).toHaveBeenCalledTimes(2);
    expect(emitter.emit).toHaveBeenCalledWith('task.created', expect.objectContaining({
        io, workspaceId: 'w1', taskId: 't1', title: 'Ship', priority: 'high', assigneeIds: ['u2'], assigneeUsernames: ['bo'], userId: 'u1', issueKey: 'ENG-1',
    }));
    emitCreated({ subtask: { ...task, _id: 's1', parentTask: { _id: 't1' } } }, 'u1', io);
    expect(emitter.emit).toHaveBeenLastCalledWith('task.created', expect.objectContaining({ taskId: 's1', parentTaskId: 't1' }));
});

test('task.completed', () => {
    emitCompleted({ ...task, status: 'done' }, 'u3', null);
    expect(emitter.emit).toHaveBeenCalledWith('task.completed', expect.objectContaining({ taskId: 't1', status: 'done', userId: 'u3' }));
});

test('tasks without a workspace (personal) are not emitted, and errors never throw', () => {
    emitCompleted({ ...task, workspace: null }, 'u1', null);
    expect(emitter.emit).not.toHaveBeenCalled();
    emitter.emit.mockImplementationOnce(() => { throw new Error('x'); });
    expect(() => emitCompleted(task, 'u1', null)).not.toThrow();
    expect(taskEventData({ _id: 'x' }).assigneeIds).toEqual([]);
});

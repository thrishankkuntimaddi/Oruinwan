'use strict';

const { DECLARATIONS, createTools } = require('../tools/registry');

describe('schedule_meeting declaration', () => {
  const decl = DECLARATIONS.find((d) => d.name === 'schedule_meeting');

  test('startsAt is optional so the availability finder can pick the time', () => {
    expect(decl.parameters.required).toEqual(['title']);
    expect(Object.keys(decl.parameters.properties)).toEqual(
      expect.arrayContaining(['title', 'startsAt', 'durationMinutes', 'participantIds', 'earliest', 'latest']),
    );
  });

  test('passes the args through to the scheduleMeeting action', async () => {
    const scheduleMeeting = jest.fn(async (args) => ({ success: true, args }));
    const [tool] = createTools({ scheduleMeeting });
    expect(tool.declaration.name).toBe('schedule_meeting');
    const out = await tool.execute({ title: 'Sync', earliest: '2026-11-03T00:00:00Z' }, { userId: 'u1' });
    expect(scheduleMeeting).toHaveBeenCalledWith({ title: 'Sync', earliest: '2026-11-03T00:00:00Z' }, { userId: 'u1' });
    expect(out.success).toBe(true);
  });
});

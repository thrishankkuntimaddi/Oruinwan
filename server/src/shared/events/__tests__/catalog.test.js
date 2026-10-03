'use strict';

const { EVENTS, EVENT_NAMES, isKnownEvent, assertPayload } = require('../catalog');

describe('event catalogue', () => {
    test('every entry documents description, payload, required and since', () => {
        for (const [name, spec] of Object.entries(EVENTS)) {
            expect(name).toMatch(/^[a-z_]+\.[a-z_]+$/);
            expect(spec.description).toBeTruthy();
            expect(spec.since).toMatch(/^\d{4}-\d{2}$/);
            expect(typeof spec.payload).toBe('object');
            for (const key of spec.required) expect(spec.payload).toHaveProperty(key);
        }
        expect(EVENT_NAMES).toEqual(expect.arrayContaining(['message.sent', 'task.created', 'member.joined', 'file.uploaded', 'huddle.started', 'ai.answer_posted']));
    });

    test('isKnownEvent / assertPayload', () => {
        expect(isKnownEvent('task.created')).toBe(true);
        expect(isKnownEvent('task.exploded')).toBe(false);
        expect(() => assertPayload('task.exploded', {})).toThrow(/Unknown event/);
        expect(() => assertPayload('task.created', null)).toThrow(/object payload/);
        expect(() => assertPayload('task.created', { title: 'x' })).toThrow(/missing: taskId/);
        expect(assertPayload('task.created', { taskId: 't1' })).toBe(EVENTS['task.created']);
    });

    test('webhook-supported events are all catalogue events', () => {
        const Webhook = require('../../../features/integrations/webhook.model');
        for (const name of Webhook.SUPPORTED_EVENT_NAMES) expect(isKnownEvent(name)).toBe(true);
    });
});

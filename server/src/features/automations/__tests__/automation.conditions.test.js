'use strict';

const {
    evaluateCondition, evaluateConditions, validateConditions, unsafePatternReason, interpolate, interpolateDeep, resolved,
} = require('../automation.conditions');

const data = {
    title: 'Fix Login Bug',
    priority: 'High',
    storyPoints: 5,
    tags: ['backend', 'Urgent'],
    dueDate: '2026-10-20T10:00:00Z',
    empty: '',
    event: { pull_request: { base: { ref: 'main' } } },
};
const ok = (field, operator, value) => evaluateCondition({ field, operator, value }, data);

describe('operators', () => {
    test('equals / not_equals are case-insensitive', () => {
        expect(ok('priority', 'equals', 'high')).toBe(true);
        expect(ok('priority', 'not_equals', 'low')).toBe(true);
        expect(ok('event.pull_request.base.ref', 'equals', 'main')).toBe(true);
    });

    test('contains / not_contains for strings and arrays', () => {
        expect(ok('title', 'contains', 'login')).toBe(true);
        expect(ok('tags', 'contains', 'urgent')).toBe(true);
        expect(ok('tags', 'contains', 'back')).toBe(false); // arrays match whole elements
        expect(ok('title', 'not_contains', 'signup')).toBe(true);
        expect(ok('tags', 'not_contains', 'backend')).toBe(false);
        expect(ok('missing', 'not_contains', 'x')).toBe(true);
    });

    test('greater_than / less_than with numbers and dates', () => {
        expect(ok('storyPoints', 'greater_than', '3')).toBe(true);
        expect(ok('storyPoints', 'less_than', 3)).toBe(false);
        expect(ok('dueDate', 'less_than', '2026-10-21')).toBe(true);
        expect(ok('dueDate', 'greater_than', '2026-10-21')).toBe(false);
        expect(ok('title', 'greater_than', '3')).toBe(false); // not comparable
    });

    test('in with arrays and comma lists', () => {
        expect(ok('priority', 'in', 'urgent, high')).toBe(true);
        expect(ok('priority', 'in', ['low', 'medium'])).toBe(false);
        expect(ok('tags', 'in', ['urgent', 'x'])).toBe(true);
    });

    test('exists', () => {
        expect(ok('title', 'exists')).toBe(true);
        expect(ok('missing', 'exists')).toBe(false);
        expect(ok('empty', 'exists', true)).toBe(false);
        expect(ok('missing', 'exists', false)).toBe(true);
        expect(ok('missing', 'exists', 'false')).toBe(true);
    });

    test('matches', () => {
        expect(ok('title', 'matches', '^fix\\b')).toBe(true);
        expect(ok('title', 'matches', '/^fix/')).toBe(false); // explicit flags: case-sensitive
        expect(ok('title', 'matches', '/^Fix/')).toBe(true);
        expect(ok('title', 'matches', '(a+)+$')).toBe(false); // unsafe pattern never matches
    });

    test('a missing field does not match ordinary operators', () => {
        for (const op of ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'matches']) {
            expect(ok('missing', op, 'x')).toBe(false);
        }
        expect(ok('title', 'bogus', 'x')).toBe(false);
    });
});

describe('evaluateConditions', () => {
    const conditions = [
        { field: 'priority', operator: 'equals', value: 'low' },
        { field: 'title', operator: 'contains', value: 'bug' },
    ];
    test('all (default) and any', () => {
        expect(evaluateConditions({ conditions }, data)).toBe(false);
        expect(evaluateConditions({ conditions, conditionLogic: 'any' }, data)).toBe(true);
        expect(evaluateConditions({ conditions: [] }, data)).toBe(true);
    });
});

describe('unsafe regex guard', () => {
    test.each(['(a+)+', '(\\w*)*b', '(a|aa)+', '(.*a){2}', '(x)\\1', 'a{10000}', 'x'.repeat(201)])('rejects %s', (p) => {
        expect(unsafePatternReason(p)).not.toBeNull();
    });
    test.each(['^release/v\\d+\\.\\d+$', 'fix|bug', '[A-Z]{2,5}-\\d+', '(feat|fix): .+'])('allows %s', (p) => {
        expect(unsafePatternReason(p)).toBeNull();
    });
});

describe('validateConditions', () => {
    test('normalises values and rejects bad input with 400', () => {
        expect(validateConditions([{ field: ' tags ', operator: 'in', value: ['a', 1] }]))
            .toEqual([{ field: 'tags', operator: 'in', value: ['a', '1'] }]);
        expect(validateConditions([{ field: 'x', operator: 'exists' }])).toEqual([{ field: 'x', operator: 'exists', value: undefined }]);
        expect(validateConditions(undefined)).toEqual([]);
        const bad = [
            [{ field: '', operator: 'equals', value: 'a' }],
            [{ field: 'x', operator: 'like', value: 'a' }],
            [{ field: 'x', operator: 'equals' }],
            [{ field: 'x', operator: 'matches', value: '(a+)+' }],
            [{ field: 'x', operator: 'matches', value: '[' }],
            'nope',
        ];
        for (const b of bad) {
            let err;
            try { validateConditions(b); } catch (e) { err = e; }
            expect(err && err.statusCode).toBe(400);
        }
    });
});

describe('interpolation', () => {
    const ctx = { task: { title: 'Ship it' }, steps: { post: { messageId: 'm1' }, 0: { messageId: 'm1' } }, list: [1, 2] };
    test('replaces known paths and leaves unknown ones', () => {
        expect(interpolate('{{task.title}} / {{ steps.post.messageId }} / {{steps.0.messageId}} / {{nope}}', ctx))
            .toBe('Ship it / m1 / m1 / {{nope}}');
        expect(interpolate('{{list}}', ctx)).toBe('[1,2]');
    });
    test('deep interpolation and resolved()', () => {
        expect(interpolateDeep({ a: ['{{task.title}}'], b: { c: '{{steps.post.messageId}}' }, n: 3 }, ctx))
            .toEqual({ a: ['Ship it'], b: { c: 'm1' }, n: 3 });
        expect(resolved('{{x}}')).toBe(false);
        expect(resolved('  ')).toBe(false);
        expect(resolved('abc')).toBe(true);
        expect(resolved(0)).toBe(true);
    });
});

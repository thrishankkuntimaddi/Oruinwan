'use strict';

const { isBlankNote, initialBlocks } = require('../huddleNotes');

describe('blank huddle notes are not kept', () => {
    test('the untouched template is blank', () => {
        expect(isBlankNote(JSON.stringify(initialBlocks()))).toBe(true);
    });

    test('one word in a paragraph or one action item keeps it', () => {
        const typed = initialBlocks();
        typed[1].content = 'Ship it';
        expect(isBlankNote(JSON.stringify(typed))).toBe(false);
        const action = initialBlocks();
        action[3].content = JSON.stringify([{ id: 'a', text: 'Email Ana', done: false }]);
        expect(isBlankNote(JSON.stringify(action))).toBe(false);
    });

    test('empty markup and spaces still count as blank', () => {
        const blocks = initialBlocks();
        blocks[1].content = '<p>&nbsp; <br></p>';
        expect(isBlankNote(JSON.stringify(blocks))).toBe(true);
    });
});

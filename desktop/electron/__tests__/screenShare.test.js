'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { shareOptions } = require('../screenShare');

test('one screen is "Entire screen"; windows follow, without Oruinwan itself', () => {
  const opts = shareOptions([
    { id: 'screen:1:0', name: 'Screen 1' },
    { id: 'window:2:0', name: 'Figma' },
    { id: 'window:3:0', name: 'Oruinwan' },
    { id: 'window:4:0', name: 'Oruinwan call' },
    { id: 'window:5:0', name: '' },
  ]);
  assert.deepEqual(opts.map((o) => o.label), ['Entire screen', 'Figma']);
});

test('several screens are numbered, long window names are cut, at most 8 windows', () => {
  const windows = Array.from({ length: 10 }, (_, i) => ({ id: `window:${i}:0`, name: i === 0 ? 'x'.repeat(60) : `App ${i}` }));
  const opts = shareOptions([{ id: 'screen:1:0', name: 'A' }, { id: 'screen:2:0', name: 'B' }, ...windows]);
  assert.equal(opts[0].label, 'Screen 1');
  assert.equal(opts[1].label, 'Screen 2');
  assert.equal(opts[2].label.length, 48);
  assert.equal(opts.length, 2 + 8);
});

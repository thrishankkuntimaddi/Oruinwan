'use strict';

/** DMSession rules for 1:1 and group DMs (validation only, no database). */

const mongoose = require('mongoose');
const DMSession = require('../../../../models/DMSession');

const id = () => new mongoose.Types.ObjectId();
const WS = id();

const errorsOf = (doc) => doc.validateSync()?.errors || {};

test('a 1:1 DM needs exactly 2 different people', () => {
    const a = id();
    expect(errorsOf(new DMSession({ workspace: WS, participants: [a, id()] }))).toEqual({});
    expect(errorsOf(new DMSession({ workspace: WS, participants: [a, a] })).participants).toBeTruthy();
    expect(errorsOf(new DMSession({ workspace: WS, participants: [a, id(), id()] })).participants).toBeTruthy();
});

test('a group DM holds 1 to 10 different people', () => {
    const people = (n) => Array.from({ length: n }, id);
    expect(errorsOf(new DMSession({ workspace: WS, isGroup: true, participants: people(3) }))).toEqual({});
    expect(errorsOf(new DMSession({ workspace: WS, isGroup: true, participants: people(10) }))).toEqual({});
    // People can leave until one is left.
    expect(errorsOf(new DMSession({ workspace: WS, isGroup: true, participants: people(1) }))).toEqual({});
    expect(errorsOf(new DMSession({ workspace: WS, isGroup: true, participants: people(11) })).participants).toBeTruthy();
    const a = id();
    expect(errorsOf(new DMSession({ workspace: WS, isGroup: true, participants: [a, a, id()] })).participants).toBeTruthy();
    expect(DMSession.MAX_GROUP_DM_MEMBERS).toBe(10);
});

test('group names are trimmed and capped', () => {
    const doc = new DMSession({ workspace: WS, isGroup: true, participants: [id(), id(), id()], name: '  Launch crew  ' });
    expect(doc.name).toBe('Launch crew');
    const long = new DMSession({ workspace: WS, isGroup: true, participants: [id(), id(), id()], name: 'x'.repeat(81) });
    expect(errorsOf(long).name).toBeTruthy();
});

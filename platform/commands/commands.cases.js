// Test cases for the shared slash commands and date helper. The web app's and the phone app's
// test suites both run them (client/src/__tests__/slashCommands.test.js, mobile/src/lib/slash.test.js),
// so both apps are held to the same behaviour.

import {
    COMMANDS, prepareCommand, runPrepared, filterCommands, parseCommandLine, commandsFor, helpLines, takePeople, splitQuoted, SHRUG, typingHint,
} from './slashCommands.js';
import { parseWhen, parseTrailingWhen, whenText } from './when.js';

// Monday 26 October 2026, 10:00 local time.
export const NOW = new Date(2026, 9, 26, 10, 0, 0);
const at = (d, h = 9, m = 0) => new Date(2026, 9, d, h, m, 0).getTime();

export const PEOPLE = [
    { id: 'me', username: 'nani', name: 'Nani' },
    { id: 'u1', username: 'sandeep', name: 'Sandeep' },
    { id: 'u2', username: 'mani', name: 'Mani' },
    { id: 'u3', username: 'teja.k', name: 'Teja' },
];

/** A ctx where every action exists and records its calls. */
export function fakeCtx(overrides = {}) {
    const calls = [];
    const rec = (name, result) => async (...args) => {
        calls.push([name, ...args]);
        return typeof result === 'function' ? result(...args) : result;
    };
    const ctx = {
        where: 'channel', canPost: true, isChannelAdmin: true, now: NOW,
        me: PEOPLE[0], people: PEOPLE,
        send: rec('send', { id: 'sent1' }),
        notice: rec('notice', { id: 'line1' }),
        unsend: rec('unsend'),
        lastMessageId: async () => 'last1',
        createTask: rec('createTask', { issueKey: 'OW-7' }),
        remind: rec('remind'),
        createPoll: rec('createPoll'),
        createChecklist: rec('createChecklist'),
        startCall: rec('startCall'),
        callPerson: rec('callPerson'),
        askAi: rec('askAi'),
        summarize: rec('summarize'),
        scheduleMessage: rec('scheduleMessage'),
        invite: rec('invite'),
        leave: rec('leave'),
        setMuted: rec('setMuted'),
        setStatus: rec('setStatus'),
        setPresence: rec('setPresence'),
        setTopic: rec('setTopic'),
        openSearch: rec('openSearch'),
        insert: rec('insert'),
        showHelp: rec('showHelp'),
        toast: () => {},
        ...overrides,
    };
    return { ctx, calls };
}

/** Registers the cases with the test runner's describe/it/expect. */
export function defineCommandTests({ describe, it, expect }) {
    describe('date helper', () => {
        const w = (text, opts) => parseWhen(text, { now: NOW, ...opts });
        it('reads relative times', () => {
            expect(w('in 1 minute check').at.getTime()).toBe(NOW.getTime() + 60_000);
            expect(w('in 1 minute check').rest).toBe('check');
            expect(w('in 2 hours').at.getTime()).toBe(NOW.getTime() + 2 * 3_600_000);
            expect(w('in 30m').at.getTime()).toBe(NOW.getTime() + 30 * 60_000);
            expect(w('in an hour').at.getTime()).toBe(NOW.getTime() + 3_600_000);
            expect(w('in 3 days').at.getTime()).toBe(NOW.getTime() + 3 * 86_400_000);
            expect(w('in a while')).toBeNull();
        });
        it('reads days', () => {
            expect(w('tomorrow').at.getTime()).toBe(at(27));
            expect(w('tomorrow').hasTime).toBe(false);
            expect(w('today').at.getTime()).toBe(at(26));
            expect(w('friday').at.getTime()).toBe(at(30));
            expect(w('fri').at.getTime()).toBe(at(30));
            expect(w('next friday').at.getTime()).toBe(at(30));
            expect(w('monday').at.getTime()).toBe(at(26 + 7)); // today is Monday: next week's
            expect(w('next week').at.getTime()).toBe(at(26 + 7));
            expect(w('2026-11-02').at.getTime()).toBe(new Date(2026, 10, 2, 9).getTime());
            expect(w('nov 2').at.getTime()).toBe(new Date(2026, 10, 2, 9).getTime());
            expect(w('2 nov').at.getTime()).toBe(new Date(2026, 10, 2, 9).getTime());
            expect(w('2026-02-30')).toBeNull();
            expect(w('tonight').at.getTime()).toBe(at(26, 20));
        });
        it('reads times, alone or with a day', () => {
            expect(w('5pm').at.getTime()).toBe(at(26, 17));
            expect(w('5:30 pm').at.getTime()).toBe(at(26, 17, 30));
            expect(w('9am').at.getTime()).toBe(at(27, 9)); // passed today: tomorrow
            expect(w('17:00').at.getTime()).toBe(at(26, 17));
            expect(w('at 5').at.getTime()).toBe(at(26, 17));
            expect(w('noon').at.getTime()).toBe(at(26, 12));
            expect(w('tomorrow 9am').at.getTime()).toBe(at(27, 9));
            expect(w('tomorrow at 5:15pm send it').rest).toBe('send it');
            expect(w('friday 3pm').at.getTime()).toBe(at(30, 15));
            expect(w('3pm friday').at.getTime()).toBe(at(30, 15));
            expect(w('3pm on friday').at.getTime()).toBe(at(30, 15));
            expect(w('12am tomorrow').at.getTime()).toBe(at(27, 0));
            expect(w('13pm')).toBeNull();
            expect(w('5 apples')).toBeNull();
            expect(w('hello')).toBeNull();
        });
        it('finds a time at the end of a sentence', () => {
            const t = parseTrailingWhen('Fix login tomorrow', { now: NOW });
            expect(t.before).toBe('Fix login');
            expect(t.at.getTime()).toBe(at(27));
            expect(parseTrailingWhen('Ship it due friday 5pm', { now: NOW }).before).toBe('Ship it');
            expect(parseTrailingWhen('Ship it by 2026-11-02', { now: NOW }).before).toBe('Ship it');
            expect(parseTrailingWhen('Update the friday report', { now: NOW })).toBeNull();
        });
        it('writes times plainly', () => {
            expect(whenText(new Date(at(26, 17)), { now: NOW })).toBe('today 5:00 PM');
            expect(whenText(new Date(at(27, 9)), { now: NOW })).toBe('tomorrow 9:00 AM');
            expect(whenText(new Date(at(27, 9)), { now: NOW, hasTime: false })).toBe('tomorrow');
            expect(whenText(new Date(at(30, 15)), { now: NOW })).toBe('Fri 3:00 PM');
            expect(whenText(new Date(2026, 10, 2, 9), { now: NOW, hasTime: false })).toBe('Mon, Nov 2');
        });
    });

    describe('command list', () => {
        it('every command has a name, help text, places and an action', () => {
            for (const c of COMMANDS) {
                expect(c.name).toMatch(/^[a-z]+$/);
                expect(c.description.length).toBeGreaterThan(5);
                expect(typeof c.args).toBe('string');
                expect(c.where.length).toBeGreaterThan(0);
                expect(typeof c.parse).toBe('function');
                expect(typeof c.exec).toBe('function');
                expect(typeof c.run).toBe('function');
            }
            expect(COMMANDS.map((c) => c.name)).toEqual(expect.arrayContaining([
                'task', 'remind', 'poll', 'checklist', 'huddle', 'call', 'ai', 'summarize', 'later', 'invite', 'leave',
                'mute', 'unmute', 'status', 'away', 'back', 'topic', 'shrug', 'me', 'search', 'help',
            ]));
        });
        it('filters as you type, names first', () => {
            const { ctx } = fakeCtx();
            expect(filterCommands('/', ctx).length).toBe(commandsFor(ctx).length);
            expect(filterCommands('/re', ctx)[0].name).toBe('remind');
            expect(filterCommands('/mu', ctx).map((c) => c.name)).toEqual(['mute']);
            expect(filterCommands('/zzz', ctx)).toEqual([]);
            expect(filterCommands('/send', ctx).map((c) => c.name)).toContain('later');
        });
        it('only offers what works in the place', () => {
            const thread = fakeCtx({ where: 'thread' }).ctx;
            expect(commandsFor(thread).map((c) => c.name)).not.toContain('poll');
            expect(commandsFor(thread).map((c) => c.name)).toContain('task');
            const dm = fakeCtx({ where: 'dm' }).ctx;
            expect(commandsFor(dm).map((c) => c.name)).not.toContain('topic');
            expect(commandsFor(dm).map((c) => c.name)).not.toContain('leave');
            const member = fakeCtx({ isChannelAdmin: false }).ctx;
            expect(commandsFor(member).map((c) => c.name)).not.toContain('topic');
            const readOnly = fakeCtx({ canPost: false }).ctx;
            expect(prepareCommand('/poll "a" "b" "c"', readOnly)).toMatchObject({ status: 'unavailable', message: 'Only admins can post here.' });
            const noTasks = fakeCtx({ createTask: undefined }).ctx;
            expect(prepareCommand('/task x', noTasks).status).toBe('unavailable');
        });
        it('lists everything for /help', () => {
            const lines = helpLines(fakeCtx({ where: 'dm' }).ctx);
            expect(lines.length).toBe(COMMANDS.length);
            expect(lines.find((l) => l.name === 'topic').available).toBe(false);
            expect(lines.find((l) => l.name === 'task').usage).toBe('/task <title> [@person] [due tomorrow|friday|2026-11-02]');
        });
        it('shows the arguments while typing', () => {
            expect(typingHint('/poll "Lunch?"', fakeCtx().ctx).usage).toBe('/poll "Question" "Option 1" "Option 2"');
            expect(typingHint('hello', fakeCtx().ctx)).toBeNull();
        });
    });

    describe('reading what was typed', () => {
        const prep = (text, o) => prepareCommand(text, fakeCtx(o).ctx);
        it('tells commands, unknown commands and plain text apart', () => {
            expect(parseCommandLine('/task  Fix it ')).toEqual({ name: 'task', argsText: 'Fix it' });
            expect(prep('hello').status).toBe('none');
            expect(prep('/usr/local/bin is a path').status).toBe('none');
            expect(prep('/xyz hi')).toEqual({ status: 'unknown', name: 'xyz' });
            expect(prep('/TASK Fix it').status).toBe('ready');
        });
        it('/task', () => {
            expect(prep('/task Fix login @sandeep tomorrow').args).toMatchObject({ title: 'Fix login', assignees: [PEOPLE[1]] });
            expect(prep('/task Fix login @sandeep tomorrow').args.due.getTime()).toBe(at(27, 17));
            expect(prep('/task Write notes due friday').args).toMatchObject({ title: 'Write notes' });
            expect(prep('/task Write notes due 2026-11-02').args.due.getTime()).toBe(new Date(2026, 10, 2, 17).getTime());
            expect(prep('/task Plan the friday demo').args).toMatchObject({ title: 'Plan the friday demo', due: null });
            expect(prep('/task Review @mani @teja.k').args.assignees.map((p) => p.id)).toEqual(['u2', 'u3']);
            expect(prep('/task @sandeep').status).toBe('invalid');
            expect(prep('/task').message).toMatch(/^Give the task a title\. Usage: \/task/);
            expect(prep('/task Fix @nobody').message).toMatch(/No one called @nobody/);
        });
        it('/remind', () => {
            expect(prep('/remind me in 1 minute check').args).toMatchObject({ target: null, what: 'check' });
            expect(prep('/remind me in 1 minute check').args.at.getTime()).toBe(NOW.getTime() + 60_000);
            expect(prep('/remind @mani tomorrow 9am send the report').args).toMatchObject({ target: PEOPLE[2], what: 'send the report' });
            expect(prep('/remind me to call Ana at 5pm').args).toMatchObject({ what: 'call Ana' });
            expect(prep('/remind tomorrow standup').args).toMatchObject({ target: null, what: 'standup' });
            expect(prep('/remind @nani in 1 hour x').args.target).toBeNull(); // myself
            expect(prep('/remind me sometime').message).toMatch(/^When\?/);
            expect(prep('/remind me in 1 hour').message).toMatch(/^What should/);
            expect(prep('/remind @ghost in 1 hour x').status).toBe('invalid');
        });
        it('/poll', () => {
            expect(prep('/poll "Lunch?" "Pizza" "Sushi"').args).toEqual({ question: 'Lunch?', options: ['Pizza', 'Sushi'] });
            expect(prep('/poll “Lunch?” “Pizza” “Sushi”').args.options).toEqual(['Pizza', 'Sushi']);
            expect(prep('/poll Lunch? | Pizza | Sushi').args.question).toBe('Lunch?');
            expect(prep('/poll "Lunch?" "Pizza"').message).toMatch(/at least two options/);
            expect(prep('/poll "Q" "a" "A"').message).toMatch(/different/);
            expect(prep('/poll').status).toBe('invalid');
            expect(splitQuoted('"a" "b"')).toEqual(['a', 'b']);
        });
        it('/checklist', () => {
            expect(prep('/checklist milk; eggs; bread').args).toEqual({ title: 'Checklist', items: ['milk', 'eggs', 'bread'] });
            expect(prep('/checklist Launch: docs; blog; tweet').args).toEqual({ title: 'Launch', items: ['docs', 'blog', 'tweet'] });
            expect(prep('/checklist').status).toBe('invalid');
        });
        it('/huddle, /call, /video', () => {
            expect(prep('/huddle').status).toBe('ready');
            expect(prep('/call @mani').args).toEqual({ person: PEOPLE[2] });
            expect(prep('/call').args).toEqual({ person: null });
            expect(prep('/call mani').status).toBe('invalid');
            expect(prep('/call @mani @sandeep').message).toMatch(/One person/);
            expect(prep('/video').status).toBe('ready');
        });
        it('/ai and /summarize', () => {
            expect(prep('/ai what did we decide?').args).toEqual({ question: 'what did we decide?' });
            expect(prep('/ai').status).toBe('invalid');
            expect(prep('/summarize', { where: 'thread' }).status).toBe('ready');
        });
        it('/later', () => {
            const r = prep('/later tomorrow 9am Standup notes are in the doc');
            expect(r.args.text).toBe('Standup notes are in the doc');
            expect(r.args.at.getTime()).toBe(at(27, 9));
            expect(prep('/later in 2 hours').message).toMatch(/Type the message/);
            expect(prep('/later soon hi').status).toBe('invalid');
            expect(prep('/later in 1 hour hi', { where: 'thread' }).status).toBe('unavailable');
        });
        it('/invite, /leave, /mute, /unmute, /topic', () => {
            expect(prep('/invite @mani @teja.k').args.people.map((p) => p.id)).toEqual(['u2', 'u3']);
            expect(prep('/invite').status).toBe('invalid');
            expect(prep('/invite @nani').status).toBe('invalid'); // only me
            expect(prep('/leave', { where: 'group' }).status).toBe('ready');
            expect(prep('/leave', { where: 'dm' }).status).toBe('unavailable');
            expect(prep('/mute', { where: 'dm' }).status).toBe('ready');
            expect(prep('/topic Q4 launch').args).toEqual({ topic: 'Q4 launch' });
            expect(prep('/topic').status).toBe('invalid');
            expect(prep('/topic x', { isChannelAdmin: false }).message).toMatch(/Only channel admins/);
        });
        it('/status, /away, /back', () => {
            expect(prep('/status 🌴 On holiday').args).toEqual({ status: { emoji: '🌴', text: 'On holiday' } });
            expect(prep('/status :palm_tree: Out').args.status.emoji).toBe(':palm_tree:');
            expect(prep('/status In a meeting').args).toEqual({ status: { emoji: '', text: 'In a meeting' } });
            expect(prep('/status').args).toEqual({ status: null });
            expect(prep('/away').status).toBe('ready');
            expect(prep('/back').status).toBe('ready');
        });
        it('/shrug, /me, /code, /search, /help', () => {
            expect(prep('/shrug').args).toEqual({ text: '' });
            expect(prep('/me is on it').args).toEqual({ text: 'is on it' });
            expect(prep('/me').status).toBe('invalid');
            expect(prep('/code js').args).toEqual({ lang: 'js' });
            expect(prep('/search release notes').args).toEqual({ words: 'release notes' });
            expect(prep('/help').status).toBe('ready');
        });
        it('finds @people', () => {
            expect(takePeople('hi @mani and @ghost.', PEOPLE)).toEqual({ people: [PEOPLE[2]], unknown: ['ghost'], text: 'hi and' });
        });
    });

    describe('running', () => {
        const run = async (text, o) => {
            const { ctx, calls } = fakeCtx(o);
            await runPrepared(prepareCommand(text, ctx), ctx);
            return calls;
        };
        it('/task posts its line, then creates the task linked to it', async () => {
            const calls = await run('/task Fix login @sandeep tomorrow');
            expect(calls[0][0]).toBe('notice');
            expect(calls[0][1]).toBe('✅ Task created: **Fix login** · for @sandeep · due tomorrow');
            expect(calls[1][0]).toBe('createTask');
            expect(calls[1][1]).toMatchObject({ title: 'Fix login', assigneeIds: ['u1'], linkedMessageId: 'line1', dueDay: '2026-10-27' });
        });
        it('/task takes its line back when the task fails', async () => {
            const { ctx, calls } = fakeCtx({ createTask: async () => { throw new Error('Plan limit'); } });
            await expect(runPrepared(prepareCommand('/task x', ctx), ctx)).rejects.toThrow('Plan limit');
            expect(calls.map((c) => c[0])).toEqual(['notice', 'unsend']);
        });
        it('/remind me uses the newest message, quietly', async () => {
            const calls = await run('/remind me in 1 minute check');
            expect(calls).toEqual([['remind', { messageId: 'last1', at: new Date(NOW.getTime() + 60_000), note: 'check', forUserId: null }]]);
        });
        it('/remind me in an empty conversation posts a line to hang it on', async () => {
            const calls = await run('/remind me in 1 minute check', { lastMessageId: async () => null });
            expect(calls.map((c) => c[0])).toEqual(['notice', 'remind']);
        });
        it('/remind @person posts a line and reminds them on it', async () => {
            const calls = await run('/remind @mani tomorrow 9am send the report');
            expect(calls[0]).toEqual(['notice', '⏰ Reminder for @mani tomorrow 9:00 AM: send the report']);
            expect(calls[1][1]).toMatchObject({ messageId: 'line1', forUserId: 'u2', note: 'send the report' });
        });
        it('the rest call their action', async () => {
            expect(await run('/poll "Q" "a" "b"')).toEqual([['createPoll', { question: 'Q', options: ['a', 'b'] }]]);
            expect(await run('/checklist a; b')).toEqual([['createChecklist', { title: 'Checklist', items: ['a', 'b'] }]]);
            expect(await run('/huddle')).toEqual([['startCall', { video: false }]]);
            expect(await run('/video')).toEqual([['startCall', { video: true }]]);
            expect(await run('/call @mani')).toEqual([['callPerson', PEOPLE[2]]]);
            expect(await run('/ai why?')).toEqual([['askAi', 'why?']]);
            expect(await run('/summarize')).toEqual([['summarize']]);
            expect((await run('/later in 1 hour hi'))[0]).toEqual(['scheduleMessage', 'hi', new Date(NOW.getTime() + 3_600_000)]);
            expect(await run('/invite @mani')).toEqual([['invite', [PEOPLE[2]]]]);
            expect(await run('/leave')).toEqual([['leave']]);
            expect(await run('/mute')).toEqual([['setMuted', true]]);
            expect(await run('/unmute')).toEqual([['setMuted', false]]);
            expect(await run('/topic Launch week')).toEqual([['setTopic', 'Launch week']]);
            expect(await run('/status 🌴 Out')).toEqual([['setStatus', { emoji: '🌴', text: 'Out' }]]);
            expect(await run('/away')).toEqual([['setPresence', 'away']]);
            expect(await run('/back')).toEqual([['setPresence', 'active']]);
            expect(await run('/shrug ok')).toEqual([['send', `ok ${SHRUG}`]]);
            expect(await run('/me waves_hi')).toEqual([['send', '_waves\\_hi_']]);
            expect(await run('/code py')).toEqual([['insert', '```py\n\n```']]);
            expect(await run('/search budget')).toEqual([['openSearch', 'budget']]);
            expect(await run('/help')).toEqual([['showHelp']]);
        });
        it('each command can be run by name', async () => {
            const { ctx, calls } = fakeCtx();
            await COMMANDS.find((c) => c.name === 'mute').run(ctx, '');
            expect(calls).toEqual([['setMuted', true]]);
            await expect(COMMANDS.find((c) => c.name === 'poll').run(ctx, '"Q"')).rejects.toThrow(/Usage/);
        });
    });
}

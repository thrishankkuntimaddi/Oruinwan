'use strict';

/** /remind @person: a reminder set for someone else who can read the message. */

jest.mock('../messageReminder.model', () => ({ create: jest.fn(async (doc) => ({ _id: 'r1', ...doc })) }));
jest.mock('../message.model', () => ({}));
jest.mock('../messageAccess', () => ({ loadAccessibleMessage: jest.fn() }));

const MessageReminder = require('../messageReminder.model');
const { loadAccessibleMessage } = require('../messageAccess');
const { scheduleReminder } = require('../messageReminder.service');

const ME = 'a'.repeat(24);
const MANI = 'b'.repeat(24);
const MSG = 'c'.repeat(24);
const soon = () => new Date(Date.now() + 60_000).toISOString();

describe('reminders for someone else', () => {
    beforeEach(() => { loadAccessibleMessage.mockReset(); MessageReminder.create.mockClear(); });

    it('is my own reminder by default', async () => {
        loadAccessibleMessage.mockResolvedValue({});
        await scheduleReminder(ME, MSG, soon(), 'check');
        expect(MessageReminder.create.mock.calls[0][0]).toMatchObject({ userId: ME, note: 'check' });
        expect(MessageReminder.create.mock.calls[0][0].setBy).toBeUndefined();
    });

    it('goes to the other person, marked as set by me', async () => {
        loadAccessibleMessage.mockResolvedValue({});
        await scheduleReminder(ME, MSG, soon(), 'send the report', { forUserId: MANI });
        expect(loadAccessibleMessage).toHaveBeenCalledWith(expect.anything(), MSG, MANI, expect.anything());
        expect(MessageReminder.create.mock.calls[0][0]).toMatchObject({ userId: MANI, setBy: ME });
    });

    it('refuses when they cannot read the conversation', async () => {
        loadAccessibleMessage.mockImplementation(async (_m, _id, uid) => { if (uid === MANI) throw new Error('no'); return {}; });
        await expect(scheduleReminder(ME, MSG, soon(), 'x', { forUserId: MANI })).rejects.toMatchObject({ status: 403 });
        expect(MessageReminder.create).not.toHaveBeenCalled();
    });
});

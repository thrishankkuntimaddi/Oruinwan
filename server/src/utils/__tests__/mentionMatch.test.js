const { mentionedUsernames, mentionedUserIds } = require('../mentionMatch');

describe('mentionMatch', () => {
    const users = new Map([
        ['1', { _id: '1', username: 'Pakanati Shiva Kumar Goud' }],
        ['2', { _id: '2', username: 'Pakanati' }],
        ['3', { _id: '3', username: 'Muzamil K' }],
    ]);
    it('matches whole names with spaces, longest first', () => {
        expect(mentionedUserIds('@Pakanati Shiva Kumar Goud hi', users)).toEqual(['1']);
        expect(mentionedUserIds('@pakanati and @muzamil k', users).sort()).toEqual(['2', '3']);
    });
    it('needs a boundary and skips emails', () => {
        expect([...mentionedUsernames('@Muzamil Khan me@pakanati', ['Muzamil K', 'Pakanati'])]).toEqual([]);
    });
});

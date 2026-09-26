import { describe, it, expect, beforeEach } from 'vitest';
import { getAvatarUrl, rememberAvatar, rememberAvatars, __resetAvatarCacheForTests } from '../utils/avatarUtils';

describe('getAvatarUrl', () => {
    beforeEach(() => __resetAvatarCacheForTests());

    it('gives the same generated avatar whether a screen has the id, the name, or both', () => {
        const byBoth = getAvatarUrl({ _id: 'u1', username: 'Bob' });
        expect(getAvatarUrl({ username: 'bob' })).toBe(byBoth);
        expect(getAvatarUrl('Bob')).toBe(byBoth);
        expect(getAvatarUrl({ username: 'Bob', _id: 'other-id' })).toBe(byBoth);
    });

    it('uses the stored picture everywhere once any screen has seen it', () => {
        const photo = 'https://cdn.example/bob.png';
        expect(getAvatarUrl({ _id: 'u1', username: 'bob', profilePicture: photo })).toBe(photo);
        // Later payloads without the picture (socket events, name-only props, bare ids).
        expect(getAvatarUrl({ _id: 'u1' })).toBe(photo);
        expect(getAvatarUrl({ username: 'Bob' })).toBe(photo);
        expect(getAvatarUrl('u1')).toBe(photo);
    });

    it('learns pictures from member lists', () => {
        rememberAvatars([{ user: { _id: 'u2', username: 'carol', profilePicture: 'p2' } }, { _id: 'u3', username: 'dan', profilePicture: 'p3' }]);
        expect(getAvatarUrl({ username: 'carol' })).toBe('p2');
        expect(getAvatarUrl({ _id: 'u3' })).toBe('p3');
    });

    it('ignores users without a picture', () => {
        rememberAvatar({ _id: 'u4', username: 'erin' });
        expect(getAvatarUrl({ username: 'erin' })).toMatch(/dicebear/);
    });
});

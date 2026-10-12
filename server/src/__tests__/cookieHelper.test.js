'use strict';

const { isNativeClient, getRefreshTokenFromRequest } = require('../../utils/cookieHelper');

const req = (platform, body, cookies) => ({ headers: platform ? { 'x-client-platform': platform } : {}, body, cookies });

describe('refresh token transport', () => {
    test('apps identify themselves with x-client-platform', () => {
        expect(isNativeClient(req('android'))).toBe(true);
        expect(isNativeClient(req(' iOS '))).toBe(true);
        expect(isNativeClient(req('desktop'))).toBe(true);
        expect(isNativeClient(req('web'))).toBe(false);
        expect(isNativeClient(req())).toBe(false);
    });

    test('apps send the token in the body; web clients only through the cookie', () => {
        expect(getRefreshTokenFromRequest(req('desktop', { refreshToken: 'body' }, { jwt: 'cookie' }))).toBe('body');
        expect(getRefreshTokenFromRequest(req('desktop', {}, { jwt: 'cookie' }))).toBe('cookie');
        expect(getRefreshTokenFromRequest(req(null, { refreshToken: 'body' }, { jwt: 'cookie' }))).toBe('cookie');
        expect(getRefreshTokenFromRequest(req(null, { refreshToken: 'body' }, {}))).toBe(null);
    });
});

// @vitest-environment jsdom
import axios from 'axios';
import api, { refreshAccessToken, shouldAttemptRefresh, setOnTokenRefreshed } from '../services/api';

const originalDefaultAdapter = axios.defaults.adapter;
const originalApiAdapter = api.defaults.adapter;

function respond(config, status, data) {
    const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    const err = new axios.AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
    return Promise.reject(err);
}

describe('api.js token refresh', () => {
    let refreshCalls;

    beforeEach(() => {
        refreshCalls = 0;
        localStorage.clear();
        setOnTokenRefreshed(null);
        axios.defaults.adapter = (config) => {
            if (config.url.endsWith('/api/auth/refresh')) {
                refreshCalls += 1;
                return new Promise(resolve => setTimeout(() => resolve(respond(config, 200, { accessToken: 'new-token' })), 10));
            }
            return respond(config, 404, {});
        };
    });

    afterEach(() => {
        axios.defaults.adapter = originalDefaultAdapter;
        api.defaults.adapter = originalApiAdapter;
    });

    it('dedupes concurrent refreshAccessToken() calls into one request', async () => {
        const results = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);
        expect(results).toEqual(['new-token', 'new-token', 'new-token']);
        expect(refreshCalls).toBe(1);
        expect(localStorage.getItem('accessToken')).toBe('new-token');
        // A later call starts a fresh refresh.
        await refreshAccessToken();
        expect(refreshCalls).toBe(2);
    });

    it('never sends a body refresh token', async () => {
        localStorage.setItem('refreshToken', 'legacy');
        let sentBody;
        axios.defaults.adapter = (config) => {
            sentBody = config.data;
            return respond(config, 200, { accessToken: 't' });
        };
        await refreshAccessToken();
        expect(sentBody === undefined || !String(sentBody).includes('legacy')).toBe(true);
    });

    it('interceptor: concurrent 401s trigger a single refresh and retry', async () => {
        localStorage.setItem('accessToken', 'expired');
        api.defaults.adapter = (config) => {
            if (config.headers.Authorization === 'Bearer new-token') return respond(config, 200, { ok: true });
            return respond(config, 401, { message: 'No token' });
        };
        const [a, b] = await Promise.all([api.get('/api/tasks'), api.get('/api/notes')]);
        expect(a.data.ok).toBe(true);
        expect(b.data.ok).toBe(true);
        expect(refreshCalls).toBe(1);
    });

    it('interceptor: business-logic 401 on /api/auth/* does not refresh or force-logout', async () => {
        const onLogout = vi.fn();
        window.addEventListener('auth:force-logout', onLogout);
        api.defaults.adapter = (config) => respond(config, 401, { message: 'Invalid password' });
        await expect(api.post('/api/auth/reactivate', {})).rejects.toBeTruthy();
        expect(refreshCalls).toBe(0);
        expect(onLogout).not.toHaveBeenCalled();
        window.removeEventListener('auth:force-logout', onLogout);
    });
});

describe('shouldAttemptRefresh', () => {
    const r = (data) => ({ status: 401, data });
    it('refreshes for non-auth routes on any 401', () => {
        expect(shouldAttemptRefresh({ url: '/api/tasks' }, r({ message: 'whatever' }))).toBe(true);
    });
    it('only refreshes /api/auth/* on the middleware token signal', () => {
        expect(shouldAttemptRefresh({ url: '/api/auth/me' }, r({ message: 'Invalid access token' }))).toBe(true);
        expect(shouldAttemptRefresh({ url: '/api/auth/me' }, r({ code: 'TOKEN_EXPIRED' }))).toBe(true);
        expect(shouldAttemptRefresh({ url: '/api/auth/verify-otp' }, r({ message: 'Invalid password' }))).toBe(false);
    });
    it('never refreshes for refresh/login/logout', () => {
        expect(shouldAttemptRefresh({ url: '/api/auth/refresh' }, r({ message: 'No token' }))).toBe(false);
        expect(shouldAttemptRefresh({ url: '/api/auth/logout' }, r({ message: 'No token' }))).toBe(false);
        expect(shouldAttemptRefresh({ url: 'http://localhost:8080/api/auth/login' }, r({ message: 'No token' }))).toBe(false);
    });
    it('ignores non-401', () => {
        expect(shouldAttemptRefresh({ url: '/api/tasks' }, { status: 403, data: {} })).toBe(false);
    });
});

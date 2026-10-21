// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { migrateLegacyLocalStorage } from '../utils/legacyStorage';

describe('migrateLegacyLocalStorage', () => {
    beforeEach(() => localStorage.clear());

    test('moves chttrix keys to oruinwan keys', () => {
        localStorage.setItem('chttrix_recent_searches', '["a"]');
        localStorage.setItem('chttrix.autoTranslateLang', 'es');
        localStorage.setItem('chttrixai_chat_history_u1', '[]');
        localStorage.setItem('unrelated', 'x');
        migrateLegacyLocalStorage();
        expect(localStorage.getItem('oruinwan_recent_searches')).toBe('["a"]');
        expect(localStorage.getItem('oruinwan.autoTranslateLang')).toBe('es');
        expect(localStorage.getItem('oruinwanai_chat_history_u1')).toBe('[]');
        expect(localStorage.getItem('chttrix_recent_searches')).toBeNull();
        expect(localStorage.getItem('unrelated')).toBe('x');
    });

    test('keeps a value already saved under the new name', () => {
        localStorage.setItem('chttrix_cookie_prefs', 'old');
        localStorage.setItem('oruinwan_cookie_prefs', 'new');
        migrateLegacyLocalStorage();
        expect(localStorage.getItem('oruinwan_cookie_prefs')).toBe('new');
        expect(localStorage.getItem('chttrix_cookie_prefs')).toBeNull();
    });
});

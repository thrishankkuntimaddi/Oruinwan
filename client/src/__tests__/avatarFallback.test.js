// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { handleImageError, initialsDataUrl, installAvatarFallback, looksLikeAvatar } from '../utils/avatarFallback';

const style = (radius) => () => ({ borderRadius: radius });

describe('avatar fallback', () => {
    test('round images and marked avatars count as avatars; others do not', () => {
        const img = document.createElement('img');
        expect(looksLikeAvatar(img, style('50%'))).toBe(true);
        expect(looksLikeAvatar(img, style('8px'))).toBe(false);
        img.className = 'w-8 h-8 rounded-full';
        expect(looksLikeAvatar(img, style('0px'))).toBe(true);
        const marked = document.createElement('img');
        marked.dataset.avatar = '';
        expect(looksLikeAvatar(marked, style('0px'))).toBe(true);
        expect(looksLikeAvatar(document.createElement('div'), style('50%'))).toBe(false);
    });

    test('a broken avatar shows the initial once; attachments are left alone', () => {
        const avatar = document.createElement('img');
        avatar.alt = 'nikhilteja';
        avatar.src = 'https://lh3.googleusercontent.com/broken';
        // Google photos get one retry without the referrer first.
        expect(handleImageError(avatar, style('50%'))).toBe('retried');
        expect(avatar.referrerPolicy).toBe('no-referrer');
        expect(avatar.src).toBe('https://lh3.googleusercontent.com/broken');
        expect(handleImageError(avatar, style('50%'))).toBe(true);
        expect(avatar.src).toBe(initialsDataUrl('nikhilteja'));
        expect(decodeURIComponent(avatar.src)).toContain('>N</text>');
        // A second error (should never happen with a data URL) doesn't loop.
        expect(handleImageError(avatar, style('50%'))).toBe(false);

        const photo = document.createElement('img');
        photo.src = 'https://example.com/photo.jpg';
        expect(handleImageError(photo, style('4px'))).toBe(false);
        expect(photo.src).toBe('https://example.com/photo.jpg');
    });

    test('escapes the letter and falls back to "?"', () => {
        expect(decodeURIComponent(initialsDataUrl(''))).toContain('>?</text>');
        expect(decodeURIComponent(initialsDataUrl('<script>'))).toContain('>?</text>');
    });

    test('installs a capture listener that can be removed', () => {
        const remove = installAvatarFallback(document);
        const img = document.createElement('img');
        img.className = 'rounded-full';
        img.alt = 'Ben';
        document.body.appendChild(img);
        img.dispatchEvent(new Event('error'));
        expect(img.src).toBe(initialsDataUrl('Ben'));
        remove();
        img.remove();
    });
});

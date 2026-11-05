import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../media/media.js', async (orig) => ({ ...(await orig()), useMediaUrl: (f) => ({ url: f?.url ? `https://signed${f.url}` : null }) }));
const { QuoteBlock, quoteMediaLabel } = await import('./messages.jsx');

describe('reply quotes of media', () => {
  it('say what the media is', () => {
    expect(quoteMediaLabel({ variant: 'sticker', mimeType: 'image/webp', name: 'a.webp' })).toBe('Sticker');
    expect(quoteMediaLabel({ mimeType: 'image/jpeg', name: 'a.jpg' })).toBe('Photo');
    expect(quoteMediaLabel({ mimeType: 'video/mp4', name: 'a.mp4' })).toBe('Video');
    expect(quoteMediaLabel({ mimeType: 'application/pdf', name: 'a.pdf' })).toBeNull();
  });

  it('shows "Photo" and a preview instead of the file name', () => {
    render(<QuoteBlock quoted={{ id: 'q', authorId: 'u2', authorName: 'Reddy', text: '26380.webp', state: 'ok', attachment: { type: 'image', mimeType: 'image/webp', name: '26380.webp', url: '/f' } }} me="u1" />);
    expect(screen.getByText('Photo')).toBeTruthy();
    expect(screen.queryByText('26380.webp')).toBeNull();
    expect(screen.getByTestId('quote-thumb').querySelector('img').getAttribute('src')).toBe('https://signed/f');
  });
});

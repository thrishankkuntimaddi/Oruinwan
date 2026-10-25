import { render, screen, fireEvent, act } from '@testing-library/react';

const mockAsk = vi.fn();
vi.mock('../data/session.js', async (orig) => {
  const real = await orig();
  return { ...real, api: () => ({ aiAsk: mockAsk }), useSession: (sel) => sel({ workspaceId: 'w1' }) };
});

const { QuickAi, useQuickAi, quickHistory } = await import('./QuickAi.jsx');

describe('the quick AI window', () => {
  it('keeps the last few turns as history', () => {
    const h = quickHistory([{ q: 'hi', a: 'hello' }, { q: 'and?', a: '' }], 'now');
    expect(h).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'and?' },
      { role: 'user', content: 'now' },
    ]);
  });

  it('asks and shows the answer right there', async () => {
    mockAsk.mockImplementation(async (_ws, history, { onToken }) => {
      onToken('Two tasks are');
      return { text: 'Two tasks are due today.' };
    });
    act(() => useQuickAi.getState().show());
    render(<QuickAi />);
    expect(screen.getByTestId('quick-ai')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ask Oruinwan AI'), { target: { value: 'What is due?' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    });
    expect(mockAsk).toHaveBeenCalledWith('w1', [{ role: 'user', content: 'What is due?' }], expect.any(Object));
    expect(await screen.findByText('Two tasks are due today.')).toBeTruthy();
    act(() => useQuickAi.getState().hide());
  });
});

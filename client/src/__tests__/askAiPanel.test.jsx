import { chatTranscript } from '../features/messaging/chatWindowComp/AskAiPanel';

describe('Ask AI about this chat', () => {
  it('reads only decrypted, real messages, oldest first, with who wrote them', () => {
    const events = [
      { type: 'system', text: 'Ben joined' },
      { sender: { username: 'ana' }, decryptedContent: 'Ship it Friday?' },
      { payload: { sender: { username: 'ben' }, decryptedContent: 'Yes, Friday.' } },
      { sender: { username: 'ana' }, decryptedContent: '   ' },
      { sender: { username: 'cy' }, payload: { isDeleted: true }, decryptedContent: 'gone' },
    ];
    expect(chatTranscript(events)).toEqual([
      { sender: 'ana', text: 'Ship it Friday?' },
      { sender: 'ben', text: 'Yes, Friday.' },
    ]);
  });

  it('keeps the newest messages when there are many', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ sender: { username: 'a' }, decryptedContent: `m${i}` }));
    expect(chatTranscript(events, 2).map((m) => m.text)).toEqual(['m3', 'm4']);
  });
});

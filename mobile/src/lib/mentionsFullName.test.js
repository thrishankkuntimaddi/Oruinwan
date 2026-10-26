import { describe, expect, it } from 'vitest';
import { defineMentionTests } from '../../../platform/people/mentions.cases.js';
import { mentionTextFor } from './mentions.js';
import { peopleInText } from './aiPeople.js';

// The same cases as the web app (client/src/__tests__/mentionsFullName.test.jsx).
defineMentionTests({ describe, it, expect });

describe('phone mentions with spaces', () => {
  it('sends the whole name to the server', () => {
    expect(mentionTextFor('hi @Pakanati Shiva Kumar Goud and @here', new Set(['pakanati shiva kumar goud']), { allowBroadcast: true }))
      .toBe('@pakanati shiva kumar goud @here');
  });
  it('finds the person for the group offer', () => {
    const people = [{ id: 'a', username: 'Pakanati Shiva Kumar Goud', name: 'P' }];
    expect(peopleInText('@Pakanati Shiva Kumar Goud hi', { people }).map((p) => p.id)).toEqual(['a']);
  });
});

describe('phone message text', () => {
  it('draws a full-name mention as one chip', async () => {
    const { render } = await import('@testing-library/react');
    const { Markdown } = await import('../ui/Markdown.jsx');
    const { setMentionNames } = await import('../../../platform/people/mentions.js');
    const React = await import('react');
    setMentionNames(['Pakanati Shiva Kumar Goud']);
    const { container } = render(React.createElement(Markdown, { text: 'hi @Pakanati Shiva Kumar Goud ok' }));
    expect([...container.querySelectorAll('span')].map((s) => s.textContent)).toContain('@Pakanati Shiva Kumar Goud');
  });
});

describe('typing a name with spaces', () => {
  it('keeps suggesting while the text starts a username', async () => {
    const { mentionAt } = await import('./mentions.js');
    const people = [{ id: 'v', username: 'varshitha gajjala k' }];
    expect(mentionAt('hi @varshitha gaj', 17, people)).toMatchObject({ trigger: '@', query: 'varshitha gaj', start: 3 });
    expect(mentionAt('hi @varshitha said hi', 21, people)).toBeNull();
  });
});

describe('unread on this phone', () => {
  it('opening a chat clears its count in the cached chat list', async () => {
    const { setQueryData, getQueryData } = await import('../data/query.js');
    const { clearUnreadLocally } = await import('../data/unread.js');
    setQueryData('dms:w1', [{ id: 'd1', unread: 3, mentions: 1 }, { id: 'd2', unread: 2 }]);
    clearUnreadLocally('dm', 'd1');
    expect(getQueryData('dms:w1')).toEqual([{ id: 'd1', unread: 0, mentions: 0 }, { id: 'd2', unread: 2 }]);
  });
});

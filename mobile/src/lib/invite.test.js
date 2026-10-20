import { parseInvite } from './invite.js';

const TOKEN = '0f34279cf58f7691a3a9c880b21682663bbe989d590a11cafeebc1c3c61c5e86';

describe('parseInvite', () => {
  it('reads the links the server sends, on any host', () => {
    expect(parseInvite(`https://app.example.com/join-workspace?token=${TOKEN}`)).toEqual({ kind: 'workspace', token: TOKEN });
    expect(parseInvite(`http://localhost:3000/join-workspace?token=${TOKEN}`)).toEqual({ kind: 'workspace', token: TOKEN });
  });

  it('reads /join/<token>, /invite/<token> and the app scheme', () => {
    expect(parseInvite(`https://oruinwan.example/join/${TOKEN}`)).toEqual({ kind: 'workspace', token: TOKEN });
    expect(parseInvite(`https://oruinwan.example/invite/${TOKEN}/`)).toEqual({ kind: 'workspace', token: TOKEN });
    expect(parseInvite(`oruinwan://join/${TOKEN}`)).toEqual({ kind: 'workspace', token: TOKEN });
    expect(parseInvite(`oruinwan://join-workspace?token=${TOKEN}`)).toEqual({ kind: 'workspace', token: TOKEN });
  });

  it('accepts a pasted link without https:// and a bare code', () => {
    expect(parseInvite(`  app.example.com/join-workspace?token=${TOKEN}\n`)).toEqual({ kind: 'workspace', token: TOKEN });
    expect(parseInvite(TOKEN)).toEqual({ kind: 'workspace', token: TOKEN });
  });

  it('sends company invitations to the browser', () => {
    expect(parseInvite(`https://app.example.com/accept-invite?token=abc&email=a%40b.c`)).toEqual({
      kind: 'company',
      url: 'https://app.example.com/accept-invite?token=abc&email=a%40b.c',
    });
  });

  it('ignores anything else', () => {
    expect(parseInvite('')).toBeNull();
    expect(parseInvite('hello there')).toBeNull();
    expect(parseInvite('https://app.example.com/workspace/123/home')).toBeNull();
    expect(parseInvite('https://app.example.com/join-workspace')).toBeNull();
    expect(parseInvite('https://app.example.com/join-workspace?token=short')).toBeNull();
  });
});

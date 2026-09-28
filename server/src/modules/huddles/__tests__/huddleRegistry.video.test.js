const HuddleRegistry = require('../huddleRegistry');

describe('huddle video flag', () => {
  const Registry = HuddleRegistry.HuddleRegistry || HuddleRegistry;
  const make = () => (typeof Registry === 'function' ? new Registry() : Registry);

  test('a start with video upgrades a huddle created by an earlier join', () => {
    const reg = make();
    const scope = { channelId: 'c1', workspaceId: 'w1' };
    const first = reg.ensure('h-video-1', scope, { video: false });
    expect(first.huddle.video).toBe(false);
    const again = reg.ensure('h-video-1', scope, { video: true });
    expect(again.huddle.video).toBe(true);
    // A later voice-only ensure never downgrades.
    expect(reg.ensure('h-video-1', scope, { video: false }).huddle.video).toBe(true);
  });
});

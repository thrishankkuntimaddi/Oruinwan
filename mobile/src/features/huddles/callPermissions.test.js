import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Android plugin, as a fake: the permission's state and what the system dialog answers.
const native = { state: 'prompt', answer: 'granted', settings: vi.fn() };
vi.mock('../../native/callSession.js', () => ({
  permissionState: vi.fn(async () => native.state),
  requestPermission: vi.fn(async () => native.answer),
  openAppSettings: vi.fn(async () => native.settings()),
}));

const perms = await import('./callPermissions.js');
const { usePermissionAsk } = perms;
const shown = () => usePermissionAsk.getState().ask;

beforeEach(() => {
  native.state = 'prompt';
  native.answer = 'granted';
  native.settings.mockClear();
  usePermissionAsk.setState({ ask: null });
});

describe('asking for the microphone and camera', () => {
  it("goes straight on when it's already allowed", async () => {
    native.state = 'granted';
    await expect(perms.ensureAllowed('microphone')).resolves.toBe(true);
    expect(shown()).toBeNull();
  });

  it('explains first, then asks the system', async () => {
    const result = perms.ensureAllowed('camera');
    await vi.waitFor(() => expect(shown()).toEqual({ kind: 'camera', step: 'explain' }));
    await perms.allowFromPrompt();
    await expect(result).resolves.toBe(true);
    expect(shown()).toBeNull();
  });

  it('offers settings once it was turned down for good', async () => {
    native.answer = 'denied';
    const result = perms.ensureAllowed('microphone');
    await vi.waitFor(() => expect(shown()?.step).toBe('explain'));
    await perms.allowFromPrompt();
    expect(shown()).toEqual({ kind: 'microphone', step: 'settings' });
    await perms.allowFromPrompt();
    expect(native.settings).toHaveBeenCalled();
    await expect(result).resolves.toBe(false);
  });

  it('"Not now" answers no', async () => {
    native.state = 'denied';
    const result = perms.ensureAllowed('microphone');
    await vi.waitFor(() => expect(shown()?.step).toBe('settings'));
    perms.dismissPermissionPrompt();
    await expect(result).resolves.toBe(false);
  });
});

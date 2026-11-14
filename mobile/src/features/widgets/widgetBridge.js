// The native side of the home-screen widgets (Android: WidgetsPlugin.java). Apps installed before
// widgets existed don't have the plugin: everything here is then a no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useSession } from '../../data/session.js';
import { signedOutSnapshot } from './widgetSnapshot.js';

const Widgets = registerPlugin('Widgets');

export const widgetsAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Widgets');

export async function pushWidgetSnapshot(snapshot) {
  if (!widgetsAvailable()) return false;
  try {
    await Widgets.update({ snapshot: JSON.stringify(snapshot) });
    return true;
  } catch {
    return false;
  }
}

/** Signing out empties the widgets (nothing of the account stays on the home screen). */
let watching = false;
export function watchSignOutForWidgets() {
  if (watching || !widgetsAvailable()) return;
  watching = true;
  useSession.subscribe((s, prev) => {
    if (prev?.status === 'signed-in' && s.status !== 'signed-in') pushWidgetSnapshot(signedOutSnapshot());
  });
}

/** One NetInfo subscription for the whole app. */
import NetInfo from '@react-native-community/netinfo';

let online = true;
let started = false;
const listeners = new Set();

// isInternetReachable is null while unknown — only treat an explicit false as offline.
const toOnline = (state) => state.isConnected !== false && state.isInternetReachable !== false;

function start() {
  if (started) return;
  started = true;
  NetInfo.fetch().then((s) => update(toOnline(s))).catch(() => {});
  NetInfo.addEventListener((s) => update(toOnline(s)));
}

function update(next) {
  if (next === online) return;
  online = next;
  listeners.forEach((fn) => fn(online));
}

export function isOnline() {
  start();
  return online;
}

export function onConnectivityChange(fn) {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

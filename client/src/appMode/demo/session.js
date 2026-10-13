// Starting and leaving the demo (desktop and tablet apps). The demo is a "server" at a reserved
// address that never leaves the device: src/appMode/network.js answers it from backend.js.
import { DEMO_SERVER, setServer } from '../env';
import { ME, WORKSPACE_ID } from './seed';

const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** A well-formed (unsigned) JWT: parts of the client read the user id and expiry from the token. */
export function demoAccessToken() {
  return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: ME, roles: ['user'], companyRole: 'member', demo: true, iat: 1791800000, exp: 4102444800 })}.demo`;
}
export const DEMO_REFRESH_TOKEN = 'demo-refresh-token';

function clearLocalData() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
}

/** Signs in to the sample workspace and opens it. */
export function startDemo() {
  clearLocalData();
  setServer(DEMO_SERVER);
  try {
    localStorage.setItem('accessToken', demoAccessToken());
    localStorage.setItem('oruinwan.refreshToken', DEMO_REFRESH_TOKEN);
  } catch {
    /* storage blocked: the demo can't start */
  }
  window.location.replace(`/workspace/${WORKSPACE_ID}/home`);
}

/** Back to the "Connect to your server" screen; nothing from the demo is kept. */
export function leaveDemo() {
  clearLocalData();
  window.location.replace('/');
}

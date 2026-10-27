// The website's phone layout (/m/) in a computer browser window made wide again goes back to the
// computer layout (client/src/appMode/phoneLayout.js sends narrow windows here). Phones and the
// Android/iPhone apps never switch.
import { useEffect } from 'react';
import { isNative } from '../native/index.js';

export const WEB_MIN_WIDTH = 1000;
const PHONE_UA = /Android.+Mobile|iPhone|iPod|Windows Phone|Opera Mini|IEMobile/i;

export function shouldUseComputerLayout({ width, userAgent = '', native = isNative, pathname = '/m/' }) {
  if (native || width < WEB_MIN_WIDTH) return false;
  if (PHONE_UA.test(String(userAgent))) return false;
  return /^\/m(\/|$)/.test(String(pathname));
}

export function useComputerLayoutSwitch() {
  useEffect(() => {
    if (isNative || typeof window === 'undefined') return undefined;
    let timer = null;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (shouldUseComputerLayout({ width: window.innerWidth, userAgent: navigator.userAgent, pathname: window.location.pathname })) {
          window.location.assign('/workspaces');
        }
      }, 600);
    };
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', check);
    };
  }, []);
}

// Imported first by main.jsx. In app builds the server address is read here, before any
// module evaluates `import.meta.env.VITE_BACKEND_URL` / `VITE_API_URL` (vite.config.js maps
// them to these globals).
import { IS_APP, getServer } from './env';

if (IS_APP) {
  globalThis.__ORUINWAN_SERVER__ = getServer();
  globalThis.__ORUINWAN_API__ = `${getServer()}/api`;
}

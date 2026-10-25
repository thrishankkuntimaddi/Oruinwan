'use strict';

/**
 * Security headers (helmet) for the API and the web app this server serves from dist/.
 *
 * helmet's defaults only allow a page to talk to its own address. The web app is a single-page
 * app that may call the API on another address (FRONTEND_URL and BACKEND_URL differ, e.g.
 * oruinwan.example.com and api.oruinwan.example.com), shows images and files as blob: URLs
 * once decrypted, and loads Google's sign-in script and the Inter font. This policy allows
 * exactly those kinds of sources and nothing that runs inline.
 */
const helmet = require('helmet');

const GOOGLE = 'https://accounts.google.com';

function contentSecurityPolicy() {
  return {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // 'wasm-unsafe-eval': WebAssembly only (the QR scanner in the phone interface, /m/); no eval.
      scriptSrc: ["'self'", "'wasm-unsafe-eval'", GOOGLE],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', GOOGLE],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
      // The API (possibly on its own address), live updates (wss:), uploads to object storage.
      connectSrc: ["'self'", 'https:', 'wss:'],
      // PDF previews, video embeds, Google's sign-in window.
      frameSrc: ["'self'", 'blob:', 'data:', 'https:'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  };
}

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: contentSecurityPolicy(),
    // Google's sign-in pop-up reports back to the page that opened it.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // The web app and API may sit on sibling addresses of one site (app. and api.).
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
}

module.exports = { securityHeaders, contentSecurityPolicy };

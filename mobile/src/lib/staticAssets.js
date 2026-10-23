// The server names some pictures by their path in the web app: the Oruinwan AI and agent
// icons (/icons/...) and integration bots (/integrations/...). Those files live on the web
// app's domain, not the API's, so the phone app bundles the same files from client/public
// and uses its own copy.
const files = import.meta.glob(
  [
    '../../../client/public/icons/oruinwan-128.png',
    '../../../client/public/icons/ai/*.svg',
    '../../../client/public/integrations/*.svg',
  ],
  { eager: true, query: '?url', import: 'default' },
);

const byPath = {};
for (const [file, url] of Object.entries(files)) {
  byPath[file.slice(file.indexOf('/public/') + '/public'.length)] = url;
}

/** The bundled copy of a web-app path like "/icons/ai/openai.svg", or null. */
export function bundledAsset(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return null;
  return byPath[path.split(/[?#]/)[0]] || null;
}

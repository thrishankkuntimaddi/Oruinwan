'use strict';

const path = require('path');

/**
 * Require a package that lives in the server workspace.
 *
 * The ai/ folder sits next to server/, and on some deploy targets only
 * server/node_modules is installed. Normal resolution walks up from ai/ and
 * misses it, so fall back to the server's node_modules explicitly.
 */
function resolveDependency(name) {
  try {
    return require(name);
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    return require(path.join(__dirname, '..', '..', 'server', 'node_modules', name));
  }
}

module.exports = resolveDependency;

'use strict';

/** Retired: uploads use the S3 driver (src/modules/uploads/upload.service.js); nothing to materialize. */
function materializeGcsCredentials() { return { source: 'none' }; }

module.exports = { materializeGcsCredentials };

'use strict';

/** Public surface of the AI subsystem. */
module.exports = {
  config: require('./config'),
  gateway: require('./api/ai.gateway'),
  ...require('./orchestrator'),
  ...require('./agents'),
  ...require('./memory'),
  ...require('./providers'),
  tools: require('./tools/registry'),
  events: require('./events/activityEvent'),
};

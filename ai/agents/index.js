'use strict';

module.exports = {
  BaseAgent: require('./base.agent'),
  ChatAgent: require('./chat.agent'),
  SummarizeAgent: require('./summarize.agent'),
  TaskAgent: require('./task.agent'),
  ...require('./assist.agents'),
};

// Data processor - depends on local utils

const { validateInput, formatOutput } = require('./utils');

function processData(input) {
  if (!validateInput(input)) {
    throw new Error('Invalid input');
  }
  return { processed: true, data: input };
}

module.exports = { processData };

// Utility functions - no local dependencies

function formatOutput(data) {
  return JSON.stringify(data, null, 2);
}

function validateInput(input) {
  return input && typeof input === 'string';
}

module.exports = { formatOutput, validateInput };

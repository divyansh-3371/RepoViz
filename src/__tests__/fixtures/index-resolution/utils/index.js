// Index file for utils directory
// This is what gets loaded when importing './utils'

function format(str) {
  return str.toUpperCase();
}

function validate(str) {
  return typeof str === 'string';
}

module.exports = { format, validate };

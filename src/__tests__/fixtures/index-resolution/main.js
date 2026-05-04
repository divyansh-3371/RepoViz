// Main file - imports utils directory without specifying index.js
// Should resolve to utils/index.js

const utils = require('./utils');

function main() {
  console.log(utils.format('Hello'));
}

module.exports = { main };

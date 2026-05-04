// Main application entry point
// Imports from local utility file

const { formatOutput } = require('./utils');
const { processData } = require('./processor');

function main() {
  const result = processData('test');
  console.log(formatOutput(result));
}

main();

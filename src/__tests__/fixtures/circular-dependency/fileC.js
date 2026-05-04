// FileC imports from FileA - creating the cycle
const { funcA } = require('./fileA');

function funcC() {
  return funcA();
}

module.exports = { funcC };

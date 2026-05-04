// FileB imports from FileC
const { funcC } = require('./fileC');

function funcB() {
  return funcC();
}

module.exports = { funcB };

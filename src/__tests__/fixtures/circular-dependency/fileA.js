// Circular dependency: A → B → C → A

// FileA imports from FileB
const { funcB } = require('./fileB');

function funcA() {
  return funcB();
}

module.exports = { funcA };

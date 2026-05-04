// Utility functions used across the application
// No dependencies - base layer

function formatOutput(message, data) {
  return {
    timestamp: new Date().toISOString(),
    message: message,
    data: data
  };
}

function validateInput(data) {
  if (!data || typeof data !== 'object') {
    console.warn('Invalid input: data is not an object');
    return false;
  }
  if (Object.keys(data).length === 0) {
    console.warn('Invalid input: data is empty');
    return false;
  }
  return true;
}

function generateId() {
  return Math.floor(Math.random() * 10000);
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  formatOutput,
  validateInput,
  generateId,
  getCurrentTimestamp
};

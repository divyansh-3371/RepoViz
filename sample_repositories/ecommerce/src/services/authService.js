// Authentication service
// Handles user authentication and authorization

const { getUser } = require('../database');
const { validateInput } = require('../utils');

async function authenticate(email, password) {
  if (!validateInput({ email, password })) {
    throw new Error('Invalid credentials');
  }
  
  // Simulated authentication
  const user = getUser(1); // In reality, would search by email
  if (user && password.length > 0) {
    return {
      authenticated: true,
      userId: user.id,
      email: user.email
    };
  }
  
  return {
    authenticated: false,
    error: 'Invalid credentials'
  };
}

function authorize(userId, requiredRole) {
  const user = getUser(userId);
  if (!user) {
    return false;
  }
  
  // Simulated role-based authorization
  return user.role === requiredRole || user.role === 'admin';
}

module.exports = {
  authenticate,
  authorize
};

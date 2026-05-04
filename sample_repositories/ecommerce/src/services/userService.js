// User service
// Manages user-related business logic

const { saveUser, getUser } = require('../database');
const { authenticate, authorize } = require('./authService');
const { validateInput } = require('../utils');

async function createUser(userData) {
  // Validate input before saving
  if (!validateInput(userData)) {
    throw new Error('Invalid user data');
  }
  
  // Add default role
  userData.role = userData.role || 'user';
  
  // Save to database
  const newUser = saveUser(userData);
  return newUser;
}

async function getProfile(userId) {
  const user = getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

async function authenticateUser(email, password) {
  return await authenticate(email, password);
}

async function checkUserAccess(userId, requiredRole) {
  return authorize(userId, requiredRole);
}

module.exports = {
  createUser,
  getProfile,
  getUser,
  authenticateUser,
  checkUserAccess
};

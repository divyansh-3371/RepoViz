// Database abstraction layer
// Manages data persistence (simulated)

const { validateInput, getCurrentTimestamp } = require('./utils');

// In-memory database simulation
const store = {
  users: [],
  products: []
};

function saveUser(userdata) {
  if (!validateInput(userdata)) {
    throw new Error('Invalid user data');
  }
  
  const user = {
    id: store.users.length + 1,
    ...userdata,
    createdAt: getCurrentTimestamp()
  };
  
  store.users.push(user);
  return user;
}

function getUser(id) {
  return store.users.find(u => u.id === id) || null;
}

function saveProduct(productData) {
  if (!validateInput(productData)) {
    throw new Error('Invalid product data');
  }
  
  const product = {
    id: store.products.length + 1,
    ...productData,
    createdAt: getCurrentTimestamp()
  };
  
  store.products.push(product);
  return product;
}

function getProduct(id) {
  return store.products.find(p => p.id === id) || null;
}

module.exports = {
  saveUser,
  getUser,
  saveProduct,
  getProduct
};

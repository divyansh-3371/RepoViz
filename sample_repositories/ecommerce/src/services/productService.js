// Product service
// Manages product-related business logic

const { saveProduct, getProduct } = require('../database');
const { validateInput } = require('../utils');

async function createProduct(productData) {
  // Validate product data before saving
  if (!validateInput(productData)) {
    throw new Error('Invalid product data');
  }
  
  // Ensure price is positive
  if (productData.price < 0) {
    throw new Error('Product price cannot be negative');
  }
  
  // Save to database
  const newProduct = saveProduct(productData);
  return newProduct;
}

async function getProductDetails(productId) {
  const product = getProduct(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
}

async function checkProductAvailability(productId) {
  const product = getProduct(productId);
  return product !== null;
}

module.exports = {
  createProduct,
  getProduct,
  getProductDetails,
  checkProductAvailability
};

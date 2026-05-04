// Entry point of the application
// This is the main application orchestrator

const { getUser, createUser } = require('./services/userService');
const { getProduct, createProduct } = require('./services/productService');
const { formatOutput, validateInput } = require('./utils');

async function main() {
  console.log('Starting application...');
  
  // Validate and create a user
  const userData = { name: 'John Doe', email: 'john@example.com' };
  if (validateInput(userData)) {
    const user = await createUser(userData);
    console.log(formatOutput('User created', user));
  }
  
  // Create a product
  const productData = { title: 'Laptop', price: 999.99 };
  if (validateInput(productData)) {
    const product = await createProduct(productData);
    console.log(formatOutput('Product created', product));
  }
  
  // Fetch existing user
  const fetchedUser = await getUser(1);
  console.log(formatOutput('User fetched', fetchedUser));
}

main().catch(err => console.error('Application error:', err));

const mongoose = require('mongoose');
const Product = require('./models/Product');

async function testProduct() {
  try {
    await mongoose.connect('mongodb://localhost:27017/packgine');
    console.log('Connected to MongoDB');
    
    // Find a product and log its data structure
    const product = await Product.findOne().populate('supplier');
    if (product) {
      console.log('Product found:');
      console.log('Name:', product.name);
      console.log('Material:', product.specifications?.material);
      console.log('Category Filters:', product.categoryFilters);
      console.log('Common Filters:', product.commonFilters);
      console.log('Supplier Address:', product.supplier?.address);
      console.log('Features:', product.features);
    } else {
      console.log('No products found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

testProduct();

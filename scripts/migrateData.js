const mongoose = require('mongoose');
const OldSupplier = require('../models/Supplier'); // Old schema
const Product = require('../models/Product'); // New Product schema
const NewSupplier = require('../models/NewSupplier'); // New Supplier schema

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecopack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected for migration');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Helper function to generate a unique username from company name
const generateUsername = (companyName, existingUsernames) => {
  let baseUsername = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .substring(0, 20); // Limit length
  
  let username = baseUsername;
  let counter = 1;
  
  while (existingUsernames.has(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  existingUsernames.add(username);
  return username;
};

// Helper function to generate a temporary password
const generateTempPassword = () => {
  return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
};

// Helper function to extract supplier info from old supplier record
const extractSupplierInfo = (oldSupplier, recordIndex) => {
  const supplierName = oldSupplier.filters?.Supplier?.[0] || `Supplier ${recordIndex + 1}`;
  const location = oldSupplier.filters?.Location?.[0] || 'Unknown';
  
  return {
    companyName: supplierName,
    companyDescription: `${supplierName} - ${oldSupplier.category} manufacturer`,
    email: `${supplierName.toLowerCase().replace(/[^a-z0-9]/g, '')}@temp.com`,
    website: '',
    contactInfo: {
      primaryContact: {
        name: 'Contact Person',
        email: `${supplierName.toLowerCase().replace(/[^a-z0-9]/g, '')}@temp.com`,
        phone: ''
      }
    },
    address: {
      country: location,
      city: '',
      state: ''
    },
    businessInfo: {
      businessType: 'manufacturer'
    },
    categories: oldSupplier.category ? [oldSupplier.category] : [],
    accountStatus: 'approved', // Existing suppliers are auto-approved
    verificationStatus: {
      emailVerified: true,
      businessVerified: true
    }
  };
};

// Helper function to extract product info from old supplier record
const extractProductInfo = (oldSupplier, newSupplierId, recordIndex) => {
  // Generate a product name from category and filters
  const productName = `${oldSupplier.category} Product ${recordIndex + 1}`;
  const material = oldSupplier.filters?.Material?.[0] || 'Not specified';
  const shape = oldSupplier.filters?.Shape?.[0] || '';
  const color = oldSupplier.filters?.Color?.[0] || '';
  
  // Extract size information
  let capacity = { value: 0, unit: 'ml' };
  if (oldSupplier.filters?.Size) {
    const sizeFilters = oldSupplier.filters.Size;
    const minMatch = sizeFilters.find(s => s.startsWith('Min:'));
    const maxMatch = sizeFilters.find(s => s.startsWith('Max:'));
    const unitMatch = sizeFilters.find(s => s.startsWith('Unit:'));
    
    if (minMatch && maxMatch) {
      const min = parseInt(minMatch.split(':')[1]?.trim()) || 0;
      const max = parseInt(maxMatch.split(':')[1]?.trim()) || 0;
      capacity.value = Math.round((min + max) / 2); // Take average
    }
    if (unitMatch) {
      capacity.unit = unitMatch.split(':')[1]?.trim() || 'ml';
    }
  }
  
  // Extract minimum order quantity
  let moq = 1000;
  if (oldSupplier.filters?.['Minimum Order']) {
    const moqFilters = oldSupplier.filters['Minimum Order'];
    const minMatch = moqFilters.find(s => s.startsWith('Min:'));
    if (minMatch) {
      moq = parseInt(minMatch.split(':')[1]?.trim()) || 1000;
    }
  }
  
  return {
    name: productName,
    description: `${shape} ${material} ${oldSupplier.category}${color ? ` in ${color}` : ''}`,
    broaderCategory: oldSupplier.broaderCategory || 'Packaging',
    category: oldSupplier.category || 'General',
    subcategory: oldSupplier.subcategory || '',
    
    images: oldSupplier.images || [],
    primaryImage: oldSupplier.images && oldSupplier.images[0] ? oldSupplier.images[0] : null,
    
    specifications: {
      material: material,
      capacity: capacity,
      minimumOrderQuantity: moq,
      color: color,
      finish: oldSupplier.filters?.Deco?.[0] || 'Standard'
    },
    
    pricing: {
      basePrice: 0, // No pricing info in old schema
      currency: 'USD'
    },
    
    ecoScore: oldSupplier.ecoScore || 0,
    ecoScoreDetails: oldSupplier.ecoScoreDetails || {},
    
    sustainability: {
      recyclability: oldSupplier.ecoScoreDetails?.recyclability || 0,
      carbonFootprint: oldSupplier.ecoScoreDetails?.carbonFootprint || 0,
      sustainableMaterials: oldSupplier.ecoScoreDetails?.sustainableMaterials || 0,
      localSourcing: oldSupplier.ecoScoreDetails?.localSourcing || 0
    },
    
    supplier: newSupplierId,
    filters: oldSupplier.filters || {},
    
    status: oldSupplier.status === 'approved' ? 'approved' : 'pending',
    
    createdAt: oldSupplier.createdAt || new Date(),
    updatedAt: oldSupplier.updatedAt || new Date(),
    submittedAt: oldSupplier.submittedAt || oldSupplier.createdAt || new Date()
  };
};

// Main migration function
const migrateData = async () => {
  try {
    console.log('🚀 Starting data migration...');
    
    // Get all old supplier records
    const oldSuppliers = await OldSupplier.find({});
    console.log(`📊 Found ${oldSuppliers.length} old supplier records to migrate`);
    
    if (oldSuppliers.length === 0) {
      console.log('ℹ️  No data to migrate. Exiting...');
      return;
    }
    
    // Check if migration has already been run
    const existingProducts = await Product.countDocuments();
    const existingSuppliers = await NewSupplier.countDocuments();
    
    if (existingProducts > 0 || existingSuppliers > 0) {
      console.log('⚠️  Warning: Found existing data in new collections.');
      console.log(`   - Products: ${existingProducts}`);
      console.log(`   - Suppliers: ${existingSuppliers}`);
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Do you want to continue? This will add to existing data. (y/N): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        return;
      }
    }
    
    const existingUsernames = new Set();
    const existingEmails = new Set();
    
    // Get existing usernames and emails to avoid conflicts
    const existingNewSuppliers = await NewSupplier.find({}, 'username email');
    existingNewSuppliers.forEach(supplier => {
      existingUsernames.add(supplier.username);
      existingEmails.add(supplier.email);
    });
    
    let migratedSuppliers = 0;
    let migratedProducts = 0;
    let errors = [];
    
    console.log('📦 Processing records...');
    
    for (let i = 0; i < oldSuppliers.length; i++) {
      const oldSupplier = oldSuppliers[i];
      
      try {
        console.log(`\n[${i + 1}/${oldSuppliers.length}] Processing: ${oldSupplier.category} - ${oldSupplier.filters?.Supplier?.[0] || 'Unknown Supplier'}`);
        
        // Extract supplier information
        const supplierInfo = extractSupplierInfo(oldSupplier, i);
        
        // Generate unique username and email
        supplierInfo.username = generateUsername(supplierInfo.companyName, existingUsernames);
        
        // Ensure unique email
        let baseEmail = supplierInfo.email;
        let counter = 1;
        while (existingEmails.has(supplierInfo.email)) {
          const emailParts = baseEmail.split('@');
          supplierInfo.email = `${emailParts[0]}${counter}@${emailParts[1]}`;
          counter++;
        }
        existingEmails.add(supplierInfo.email);
        
        // Generate temporary password
        supplierInfo.password = generateTempPassword();
        
        // Create new supplier
        const newSupplier = new NewSupplier(supplierInfo);
        await newSupplier.save();
        migratedSuppliers++;
        
        console.log(`   ✅ Created supplier: ${newSupplier.companyName} (${newSupplier.username})`);
        
        // Extract product information
        const productInfo = extractProductInfo(oldSupplier, newSupplier._id, i);
        
        // Create new product
        const newProduct = new Product(productInfo);
        await newProduct.save();
        migratedProducts++;
        
        console.log(`   ✅ Created product: ${newProduct.name}`);
        
        // Update supplier stats
        await NewSupplier.findByIdAndUpdate(newSupplier._id, {
          $inc: { 'stats.totalProducts': 1 }
        });
        
      } catch (error) {
        console.log(`   ❌ Error processing ${oldSupplier.category}: ${error.message}`);
        errors.push({
          supplierName: oldSupplier.category,
          error: error.message
        });
      }
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Suppliers migrated: ${migratedSuppliers}`);
    console.log(`   - Products migrated: ${migratedProducts}`);
    console.log(`   - Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.supplierName}: ${error.error}`);
      });
    }
    
    console.log('\n📝 Migration Notes:');
    console.log('   - All migrated suppliers have temporary passwords');
    console.log('   - Suppliers need to verify their accounts and reset passwords');
    console.log('   - Old Supplier collection is preserved for backup');
    console.log('   - Review migrated data before proceeding with backend updates');
    
    // Generate credentials file for reference
    const supplierCredentials = await NewSupplier.find({}, 'username email companyName');
    const credentialsData = supplierCredentials.map(supplier => ({
      companyName: supplier.companyName,
      username: supplier.username,
      email: supplier.email,
      note: 'Temporary password generated - user needs to reset'
    }));
    
    const fs = require('fs');
    fs.writeFileSync(
      './migration-credentials.json',
      JSON.stringify(credentialsData, null, 2)
    );
    console.log('\n💾 Supplier credentials saved to: migration-credentials.json');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};
// Rollback function (if needed)
const rollbackMigration = async () => {
  try {
    console.log('🔄 Rolling back migration...');
    
    const productCount = await Product.countDocuments();
    const supplierCount = await NewSupplier.countDocuments();
    
    console.log(`Will delete ${productCount} products and ${supplierCount} suppliers`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('Are you sure you want to delete all migrated data? (type "CONFIRM" to proceed): ', resolve);
    });
    rl.close();
    
    if (answer !== 'CONFIRM') {
      console.log('❌ Rollback cancelled');
      return;
    }
    
    await Product.deleteMany({});
    await NewSupplier.deleteMany({});
    
    console.log('✅ Rollback completed');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  await connectDB();
  
  const command = process.argv[2];
  
  try {
    if (command === 'rollback') {
      await rollbackMigration();
    } else {
      await migrateData();
    }
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database connection closed');
  }
};

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateData,
  rollbackMigration
};

const mongoose = require('mongoose');
const OldSupplier = require('../models/Supplier');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecopack', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function inspectData() {
  try {
    console.log('🔍 Inspecting existing data structure...');
    
    // Get a sample record to understand the structure
    const sampleRecord = await OldSupplier.findOne({});
    
    if (sampleRecord) {
      console.log('\n📋 Sample record structure:');
      console.log(JSON.stringify(sampleRecord.toObject(), null, 2));
    } else {
      console.log('❌ No records found in the old Supplier collection');
    }
    
    // Get field statistics
    const allRecords = await OldSupplier.find({});
    console.log(`\n📊 Total records: ${allRecords.length}`);
    
    if (allRecords.length > 0) {
      console.log('\n🏷️  Field presence analysis:');
      
      const fieldStats = {};
      
      allRecords.forEach(record => {
        const obj = record.toObject();
        Object.keys(obj).forEach(key => {
          if (!fieldStats[key]) fieldStats[key] = 0;
          if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
            fieldStats[key]++;
          }
        });
        
        // Check nested contactInfo fields
        if (obj.contactInfo) {
          Object.keys(obj.contactInfo).forEach(key => {
            const nestedKey = `contactInfo.${key}`;
            if (!fieldStats[nestedKey]) fieldStats[nestedKey] = 0;
            if (obj.contactInfo[key] !== null && obj.contactInfo[key] !== undefined && obj.contactInfo[key] !== '') {
              fieldStats[nestedKey]++;
            }
          });
        }
      });
      
      Object.entries(fieldStats).forEach(([field, count]) => {
        const percentage = ((count / allRecords.length) * 100).toFixed(1);
        console.log(`   ${field}: ${count}/${allRecords.length} (${percentage}%)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error inspecting data:', error);
  } finally {
    mongoose.disconnect();
  }
}

inspectData();

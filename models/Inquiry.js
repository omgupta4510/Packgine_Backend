const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  // Basic Inquiry Information
  inquiryNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // User/Buyer Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Supplier Information
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewSupplier',
    required: true
  },
  
  // Product Information
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // Inquiry Details
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  
  // Quantity and Requirements
  requestedQuantity: {
    type: Number,
    min: 1
  },
  
  targetPrice: {
    type: Number,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Custom Requirements
  customRequirements: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Delivery Requirements
  deliveryLocation: {
    city: String,
    state: String,
    country: String
  },
  
  expectedDeliveryDate: {
    type: Date
  },
  
  // Inquiry Status
  status: {
    type: String,
    enum: [
      'pending',
      'reviewed',
      'quoted',
      'negotiating',
      'accepted',
      'rejected',
      'expired',
      'converted_to_order'
    ],
    default: 'pending'
  },
  
  // Priority Level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Response from Supplier
  supplierResponse: {
    message: {
      type: String,
      trim: true
    },
    quotedPrice: {
      type: Number,
      min: 0
    },
    quotedQuantity: {
      type: Number,
      min: 1
    },
    leadTime: {
      type: Number, // in days
      min: 0
    },
    validUntil: {
      type: Date
    },
    respondedAt: {
      type: Date
    }
  },
  
  // Communication History
  communications: [{
    from: {
      type: String,
      enum: ['user', 'supplier'],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    attachments: [{
      filename: String,
      url: String
    }]
  }],
  
  // Contact Information
  contactInfo: {
    preferredMethod: {
      type: String,
      enum: ['email', 'phone', 'platform'],
      default: 'email'
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  
  // Tracking Dates
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate inquiry number before saving
inquirySchema.pre('save', async function(next) {
  if (this.isNew && !this.inquiryNumber) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.inquiryNumber = `INQ-${timestamp}-${random}`.toUpperCase();
  }
  
  // Update lastUpdated on any change
  this.lastUpdated = new Date();
  
  next();
});

// Virtual for checking if inquiry is expired
inquirySchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date();
});

// Virtual for days remaining
inquirySchema.virtual('daysRemaining').get(function() {
  const diff = this.expiresAt - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Indexes for better performance
inquirySchema.index({ userId: 1, createdAt: -1 });
inquirySchema.index({ supplierId: 1, createdAt: -1 });
inquirySchema.index({ productId: 1 });
inquirySchema.index({ inquiryNumber: 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Inquiry', inquirySchema);

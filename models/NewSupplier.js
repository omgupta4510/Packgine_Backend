const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const supplierSchema = new mongoose.Schema({
  // Authentication Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // Company Basic Information
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  companyDescription: {
    type: String,
    required: true
  },
  companyLogo: {
    type: String // Cloudinary URL
  },
  website: {
    type: String,
    trim: true
  },
  
  // Contact Information
  contactInfo: {
    primaryContact: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    salesContact: {
      name: String,
      title: String,
      email: String,
      phone: String
    },
    supportContact: {
      name: String,
      title: String,
      email: String,
      phone: String
    }
  },
  
  // Business Address
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: {
      type: String,
      required: true
    }
  },
  
  // Manufacturing and Operations
  manufacturing: {
    facilities: [{
      name: String,
      location: String,
      capacity: String,
      certifications: [String]
    }],
    capabilities: [String], // injection molding, blow molding, etc.
    specializations: [String], // sustainable packaging, luxury, etc.
    productionCapacity: String,
    leadTimes: {
      standard: Number, // days
      custom: Number,
      rush: Number
    }
  },
  
  // Business Information
  businessInfo: {
    founded: Date,
    employeeCount: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+']
    },
    annualRevenue: {
      type: String,
      enum: ['<$1M', '$1M-$10M', '$10M-$50M', '$50M-$100M', '$100M+']
    },
    businessType: {
      type: String,
      enum: ['manufacturer', 'distributor', 'broker', 'trader'],
      default: 'manufacturer'
    },
    registrationNumber: String,
    taxId: String
  },
  
  // Certifications and Compliance
  certifications: [{
    name: String, // ISO 9001, FSC, etc.
    certificationBody: String,
    validUntil: Date,
    certificateNumber: String,
    documentUrl: String
  }],
  compliance: {
    iso9001: Boolean,
    iso14001: Boolean,
    fsc: Boolean,
    sgs: Boolean,
    fda: Boolean,
    reach: Boolean,
    rohs: Boolean,
    brc: Boolean
  },
  
  // Sustainability Profile
  sustainabilityProfile: {
    sustainabilityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    initiatives: [String],
    certifications: [String],
    goals: [String],
    carbonNeutral: Boolean,
    wasteReduction: Number, // percentage
    renewableEnergy: Number, // percentage
    recycledMaterials: Number // percentage
  },
  
  // Payment and Financial Information
  paymentInfo: {
    paymentTerms: [String], // NET30, COD, etc.
    acceptedPaymentMethods: [String], // Wire transfer, LC, etc.
    currency: [String], // USD, EUR, etc.
    minimumOrderValue: Number,
    creditLimit: Number
  },
  
  // Shipping and Logistics
  shipping: {
    methods: [String], // Sea freight, Air freight, etc.
    regions: [String], // Regions they ship to
    freeShippingThreshold: Number,
    packaging: String, // How they package products
    trackingAvailable: Boolean
  },
  
  // Account Status and Verification
  accountStatus: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'suspended', 'banned'],
    default: 'pending'
  },
  verificationStatus: {
    emailVerified: {
      type: Boolean,
      default: false
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    businessVerified: {
      type: Boolean,
      default: false
    },
    documentsVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // Product Categories and Specializations
  categories: [String], // Categories they specialize in
  specializations: [String], // Specific product types
  
  // Reviews and Ratings (from buyers)
  reviews: [{
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    reviewerName: String,
    reviewDate: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    },
    aspects: {
      quality: Number,
      communication: Number,
      delivery: Number,
      service: Number
    }
  }],
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  
  // Statistics and Performance
  stats: {
    totalProducts: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number, // hours
      default: 24
    },
    onTimeDelivery: {
      type: Number, // percentage
      default: 0
    }
  },
  
  // Subscription and Membership
  membership: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    startDate: Date,
    endDate: Date,
    autoRenewal: {
      type: Boolean,
      default: true
    }
  },
  
  // Preferences and Settings
  preferences: {
    notifications: {
      email: {
        orders: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        updates: { type: Boolean, default: true }
      },
      sms: {
        orders: { type: Boolean, default: false },
        messages: { type: Boolean, default: false }
      }
    },
    privacy: {
      showContact: { type: Boolean, default: true },
      showAddress: { type: Boolean, default: false },
      showRevenue: { type: Boolean, default: false }
    }
  },
  
  // Security
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
supplierSchema.index({ email: 1 }, { unique: true });
supplierSchema.index({ username: 1 }, { unique: true });
supplierSchema.index({ companyName: 1 });
supplierSchema.index({ accountStatus: 1 });
supplierSchema.index({ 'address.country': 1 });
supplierSchema.index({ categories: 1 });
supplierSchema.index({ averageRating: -1 });
supplierSchema.index({ createdAt: -1 });

// Virtual for account lock status
supplierSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to compare password
supplierSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to calculate average rating
supplierSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
    return;
  }
  
  const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
  this.averageRating = sum / this.reviews.length;
  this.totalReviews = this.reviews.length;
};

// Method to increment login attempts
supplierSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Hash password before saving
supplierSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update timestamps
supplierSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('NewSupplier', supplierSchema);

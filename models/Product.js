const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // Basic Product Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  broaderCategory: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String
  },
  
  // Product Images
  images: [{
    type: String, // Cloudinary URLs
    required: false
  }],
  primaryImage: {
    type: String // Main product image
  },
  
  // Technical Specifications - Now Dynamic
  specifications: {
    // Core required fields
    minimumOrderQuantity: {
      type: Number,
      required: true
    },
    availableQuantity: Number,
    
    // Dynamic specifications - flexible key-value pairs
    dynamicSpecs: [{
      name: {
        type: String,
        required: true
      },
      value: {
        type: mongoose.Schema.Types.Mixed, // Can be string, number, object, array
        required: true
      },
      unit: String, // Optional unit (ml, cm, kg, etc.)
      category: {
        type: String,
        enum: ['physical', 'material', 'technical', 'custom'],
        default: 'custom'
      },
      displayOrder: {
        type: Number,
        default: 0
      },
      isRequired: {
        type: Boolean,
        default: false
      }
    }],
    
    // Legacy fields for backward compatibility
    material: String,
    capacity: {
      value: Number,
      unit: String
    },
    dimensions: {
      height: Number,
      width: Number,
      depth: Number,
      unit: { type: String, default: 'mm' }
    },
    weight: {
      value: Number,
      unit: { type: String, default: 'g' }
    },
    color: String,
    finish: String,
    closure: String
  },
  
  // Pricing Information
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    priceBreaks: [{
      minQuantity: Number,
      price: Number
    }],
    customizationCosts: {
      printing: Number,
      labeling: Number,
      packaging: Number
    }
  },
  
  // Sustainability & Eco Information
  ecoScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  ecoScoreDetails: {
    recyclability: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    carbonFootprint: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    sustainableMaterials: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    localSourcing: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  sustainability: {
    recycledContent: Number, // percentage
    biodegradable: Boolean,
    compostable: Boolean,
    refillable: Boolean,
    sustainableSourcing: Boolean,
    carbonNeutral: Boolean
  },
  
  // Certifications and Compliance
  certifications: [{
    name: String, // FSC, ISO, etc.
    certificationBody: String,
    validUntil: Date,
    certificateNumber: String
  }],
  compliance: {
    fdaApproved: Boolean,
    euCompliant: Boolean,
    reach: Boolean,
    rohs: Boolean
  },
  
  // Customization Options
  customization: {
    printingAvailable: Boolean,
    labelingAvailable: Boolean,
    colorOptions: [String],
    printingMethods: [String], // screen printing, digital, etc.
    customSizes: Boolean
  },
  
  // Lead Times and Availability
  leadTime: {
    standard: Number, // days
    custom: Number, // days for customized orders
    rush: Number // expedited delivery
  },
  availability: {
    inStock: Boolean,
    estimatedRestockDate: Date,
    discontinuing: Boolean
  },
  
  // Reviews and Ratings
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
  
  // Supplier Reference
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewSupplier',
    required: true
  },
  
  // Legacy filters (from old schema)
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // New filter fields
  categoryFilters: {
    type: mongoose.Schema.Types.Mixed, // Object to support all filter types
    default: {}
  },
  commonFilters: {
    type: mongoose.Schema.Types.Mixed, // Object to support all filter types
    default: {}
  },
  
  // Features array
  features: {
    type: [String],
    default: []
  },
  
  // Product Status and Management
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'archived'],
    default: 'pending'
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  
  // SEO and Marketing
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: String
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  inquiries: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ category: 1, broaderCategory: 1 });
productSchema.index({ status: 1 });
productSchema.index({ supplier: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ ecoScore: -1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ featured: 1 });
productSchema.index({ trending: 1 });
productSchema.index({ 'specifications.material': 1 });
productSchema.index({ 'pricing.basePrice': 1 });

// Virtual for formatted price
productSchema.virtual('formattedPrice').get(function() {
  return `${this.pricing.currency} ${this.pricing.basePrice}`;
});

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
    return;
  }
  
  const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
  this.averageRating = sum / this.reviews.length;
  this.totalReviews = this.reviews.length;
};

// Pre-save middleware to update timestamps
productSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Product', productSchema);

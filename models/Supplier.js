const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  broaderCategory: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  images: [{
    type: String, // Cloudinary URLs
    required: false
  }],
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
    },
    certifications: [{
      type: String
    }]
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Additional fields that might be useful
  contactInfo: {
    email: String,
    phone: String,
    company: String,
    contactPerson: String
  },
  // For tracking and management
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This automatically manages createdAt and updatedAt
});

// Index for better query performance
supplierSchema.index({ category: 1, broaderCategory: 1 });
supplierSchema.index({ status: 1 });
supplierSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);

const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');

// POST /api/suppliers - Create new supplier registration
router.post('/', async (req, res) => {
  try {
    const { 
      broaderCategory, 
      category, 
      filters, 
      images, 
      contactInfo, 
      ecoScore, 
      ecoScoreDetails,
      submittedAt 
    } = req.body;

    // Validation
    if (!broaderCategory || !category) {
      return res.status(400).json({
        success: false,
        message: 'Broader category and category are required'
      });
    }

    // Create new supplier
    const newSupplier = new Supplier({
      broaderCategory,
      category,
      filters: filters || {},
      images: images || [],
      contactInfo: contactInfo || {},
      ecoScore: ecoScore || 0,
      ecoScoreDetails: ecoScoreDetails || {
        recyclability: 0,
        carbonFootprint: 0,
        sustainableMaterials: 0,
        localSourcing: 0,
        certifications: []
      },
      submittedAt: submittedAt ? new Date(submittedAt) : new Date()
    });

    const savedSupplier = await newSupplier.save();

    res.status(201).json({
      success: true,
      message: 'Supplier registration submitted successfully',
      data: savedSupplier
    });

  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit supplier registration',
      error: error.message
    });
  }
});

// GET /api/suppliers - Get all suppliers (for admin)
router.get('/', async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Calculate pagination
    const skip = (page - 1) * limit;

    const suppliers = await Supplier.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Supplier.countDocuments(filter);

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: suppliers.length,
        totalRecords: total
      }
    });

  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers',
      error: error.message
    });
  }
});

// GET /api/suppliers/:id - Get specific supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });

  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier',
      error: error.message
    });
  }
});

// PUT /api/suppliers/:id/status - Update supplier status (approve/reject)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, approved, or rejected'
      });
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: `Supplier status updated to ${status}`,
      data: supplier
    });

  } catch (error) {
    console.error('Error updating supplier status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier status',
      error: error.message
    });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
      error: error.message
    });
  }
});

module.exports = router;

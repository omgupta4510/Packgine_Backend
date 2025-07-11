const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const NewSupplier = require('../models/NewSupplier');
const Inquiry = require('../models/Inquiry');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware to verify JWT token
const authenticateSupplier = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const supplier = await NewSupplier.findById(decoded.supplierId).select('-password');

    if (!supplier) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.supplier = supplier;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Get dashboard overview
router.get('/overview', authenticateSupplier, async (req, res) => {
  try {
    const supplierId = req.supplier._id;

    // Get product statistics
    const totalProducts = await Product.countDocuments({ supplier: supplierId });
    const approvedProducts = await Product.countDocuments({ 
      supplier: supplierId, 
      status: 'approved' 
    });
    const pendingProducts = await Product.countDocuments({ 
      supplier: supplierId, 
      status: 'pending' 
    });
    const rejectedProducts = await Product.countDocuments({ 
      supplier: supplierId, 
      status: 'rejected' 
    });

    // Get total views and inquiries
    const productStats = await Product.aggregate([
      { $match: { supplier: supplierId } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalInquiries: { $sum: '$inquiries' }
        }
      }
    ]);

    const stats = productStats[0] || { totalViews: 0, totalInquiries: 0 };

    // Get recent products
    const recentProducts = await Product.find({ supplier: supplierId })
      .select('name status createdAt primaryImage category')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get top performing products (by views)
    const topProducts = await Product.find({ supplier: supplierId })
      .select('name views inquiries primaryImage')
      .sort({ views: -1 })
      .limit(5);

    // Get inquiry statistics
    const totalInquiries = await Inquiry.countDocuments({ 
      supplierId: supplierId,
      productId: { $exists: true },
      userId: { $exists: true }
    });
    
    const pendingInquiries = await Inquiry.countDocuments({ 
      supplierId: supplierId, 
      status: 'pending',
      productId: { $exists: true },
      userId: { $exists: true }
    });

    res.json({
      stats: {
        totalProducts,
        approvedProducts,
        pendingProducts,
        rejectedProducts,
        totalViews: stats.totalViews,
        totalInquiries: stats.totalInquiries,
        newInquiries: totalInquiries,
        pendingInquiries
      },
      recentProducts,
      topProducts
    });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get supplier's products with pagination and filtering
router.get('/products', authenticateSupplier, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { supplier: req.supplier._id };

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Search
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') }
      ];
    }

    const products = await Product.find(filter)
      .select('name description category status primaryImage ecoScore pricing.basePrice views inquiries createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create new product
router.post('/products', authenticateSupplier, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      supplier: req.supplier._id,
      status: 'pending' // New products need approval
    };

    // Validate required fields
    if (!productData.name || !productData.category || !productData.description) {
      return res.status(400).json({
        error: 'Name, category, and description are required'
      });
    }

    const product = new Product(productData);
    await product.save();

    // Update supplier's product count
    await NewSupplier.findByIdAndUpdate(req.supplier._id, {
      $inc: { 'stats.totalProducts': 1 }
    });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Get single product for editing
router.get('/products/:id', authenticateSupplier, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supplier: req.supplier._id
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);

  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Update product
router.put('/products/:id', authenticateSupplier, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supplier: req.supplier._id
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Don't allow changing supplier or certain system fields
    const { supplier, status, views, inquiries, ...updateData } = req.body;

    // If product was rejected and now being updated, change status to pending
    if (product.status === 'rejected') {
      updateData.status = 'pending';
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/products/:id', authenticateSupplier, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      supplier: req.supplier._id
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);

    // Update supplier's product count
    await NewSupplier.findByIdAndUpdate(req.supplier._id, {
      $inc: { 'stats.totalProducts': -1 }
    });

    // Clean up related inquiries - mark them as expired or remove product reference
    await Inquiry.updateMany(
      { productId: req.params.id },
      { 
        $unset: { productId: 1 },
        $set: { 
          status: 'expired',
          lastUpdated: new Date()
        }
      }
    );

    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Get product analytics
router.get('/analytics/products', authenticateSupplier, async (req, res) => {
  try {
    const supplierId = req.supplier._id;

    // Get products by status
    const statusStats = await Product.aggregate([
      { $match: { supplier: supplierId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get products by category
    const categoryStats = await Product.aggregate([
      { $match: { supplier: supplierId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalInquiries: { $sum: '$inquiries' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get monthly product creation stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Product.aggregate([
      { 
        $match: { 
          supplier: supplierId,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      statusStats,
      categoryStats,
      monthlyStats
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get supplier's inquiries
router.get('/inquiries', authenticateSupplier, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    // Build filter
    const filter = { 
      supplierId: req.supplier._id,
      // Only show inquiries where product and user still exist
      productId: { $exists: true },
      userId: { $exists: true }
    };

    if (status) {
      filter.status = status;
    }

    const inquiries = await Inquiry.find(filter)
      .populate('productId', 'name primaryImage category pricing.basePrice')
      .populate('userId', 'firstName lastName email companyName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out inquiries where product or user is null (deleted)
    const validInquiries = inquiries.filter(inquiry => 
      inquiry.productId && inquiry.userId
    );

    const total = await Inquiry.countDocuments(filter);

    res.json({
      inquiries: validInquiries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalInquiries: total
      }
    });

  } catch (error) {
    console.error('Get supplier inquiries error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

// Get single inquiry details
router.get('/inquiries/:id', authenticateSupplier, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      supplierId: req.supplier._id
    })
      .populate('productId', 'name primaryImage category pricing specifications')
      .populate('userId', 'firstName lastName email companyName phone address');

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Check if product and user still exist
    if (!inquiry.productId || !inquiry.userId) {
      return res.status(404).json({ error: 'Inquiry data no longer available' });
    }

    res.json(inquiry);

  } catch (error) {
    console.error('Get inquiry error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiry' });
  }
});

// Update inquiry status
router.put('/inquiries/:id/status', authenticateSupplier, async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'reviewed', 'quoted', 'negotiating', 'accepted', 'rejected', 'expired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const inquiry = await Inquiry.findOneAndUpdate(
      {
        _id: req.params.id,
        supplierId: req.supplier._id
      },
      { 
        status,
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      message: 'Inquiry status updated successfully',
      inquiry: {
        id: inquiry._id,
        status: inquiry.status,
        lastUpdated: inquiry.lastUpdated
      }
    });

  } catch (error) {
    console.error('Update inquiry status error:', error);
    res.status(500).json({ error: 'Failed to update inquiry status' });
  }
});

// Respond to inquiry
router.put('/inquiries/:id/respond', authenticateSupplier, async (req, res) => {
  try {
    const {
      message,
      quotedPrice,
      quotedQuantity,
      leadTime,
      validUntil
    } = req.body;

    const inquiry = await Inquiry.findOneAndUpdate(
      {
        _id: req.params.id,
        supplierId: req.supplier._id
      },
      {
        status: 'quoted',
        supplierResponse: {
          message,
          quotedPrice,
          quotedQuantity,
          leadTime,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          respondedAt: new Date()
        },
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      message: 'Response sent successfully',
      inquiry: {
        id: inquiry._id,
        status: inquiry.status,
        supplierResponse: inquiry.supplierResponse
      }
    });

  } catch (error) {
    console.error('Respond to inquiry error:', error);
    res.status(500).json({ error: 'Failed to send response' });
  }
});

// Mark inquiry as complete
router.put('/inquiries/:id/complete', authenticateSupplier, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOneAndUpdate(
      {
        _id: req.params.id,
        supplierId: req.supplier._id
      },
      {
        status: 'accepted',
        lastUpdated: new Date()
      },
      { new: true }
    );

    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      message: 'Inquiry marked as complete',
      inquiry: {
        id: inquiry._id,
        status: inquiry.status
      }
    });

  } catch (error) {
    console.error('Complete inquiry error:', error);
    res.status(500).json({ error: 'Failed to complete inquiry' });
  }
});

module.exports = router;

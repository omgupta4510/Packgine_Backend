const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const Product = require('../models/Product');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to protect routes (for users)
const protectUser = async (req, res, next) => {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from token
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

// @desc    Create a new inquiry
// @route   POST /api/inquiries
// @access  Private (User)
router.post('/', protectUser, async (req, res) => {
  try {
    const {
      productId,
      subject,
      message,
      requestedQuantity,
      targetPrice,
      customRequirements,
      deliveryLocation,
      expectedDeliveryDate
    } = req.body;

    // Validate required fields
    if (!productId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, subject, and message are required'
      });
    }

    // Check if product exists and get supplier info
    const product = await Product.findById(productId).populate('supplier');
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is approved/active
    if (product.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request quote for inactive product'
      });
    }

    // Create inquiry
    const inquiry = new Inquiry({
      userId: req.user._id,
      supplierId: product.supplier._id,
      productId: productId,
      subject,
      message,
      requestedQuantity: requestedQuantity || product.specifications.minimumOrderQuantity,
      targetPrice,
      customRequirements,
      deliveryLocation,
      expectedDeliveryDate,
      contactInfo: {
        email: req.user.email,
        phone: req.user.phone,
        preferredMethod: 'email'
      }
    });

    // console.log('Creating inquiry:', {
    //   userId: req.user._id,
    //   supplierId: product.supplier._id,
    //   productId: productId,
    //   subject,
    //   message
    // });

    const savedInquiry = await inquiry.save();
    // console.log('Inquiry saved with number:', savedInquiry.inquiryNumber);

    // Add inquiry to user's inquiries array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { inquiries: savedInquiry._id }
    });

    // Increment product inquiry count
    await Product.findByIdAndUpdate(productId, {
      $inc: { inquiries: 1 }
    });

    res.status(201).json({
      success: true,
      message: 'Quote request sent successfully',
      inquiry: {
        id: savedInquiry._id,
        inquiryNumber: savedInquiry.inquiryNumber,
        status: savedInquiry.status,
        createdAt: savedInquiry.createdAt
      }
    });

  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get user's inquiries
// @route   GET /api/inquiries
// @access  Private (User)
router.get('/', protectUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const inquiries = await Inquiry.find({ 
      userId: req.user._id,
      // Only show inquiries where the product still exists
      productId: { $exists: true }
    })
      .populate('productId', 'name primaryImage category pricing.basePrice')
      .populate('supplierId', 'companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out inquiries where product is null (deleted products)
    const validInquiries = inquiries.filter(inquiry => inquiry.productId);

    const total = await Inquiry.countDocuments({ 
      userId: req.user._id,
      productId: { $exists: true }
    });

    res.json({
      success: true,
      inquiries: validInquiries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalInquiries: total
      }
    });

  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Get single inquiry details
// @route   GET /api/inquiries/:id
// @access  Private (User)
router.get('/:id', protectUser, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('productId', 'name primaryImage category pricing specifications')
      .populate('supplierId', 'companyName companyLogo contactInfo');

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      });
    }

    // Check if product still exists
    if (!inquiry.productId) {
      return res.status(404).json({
        success: false,
        message: 'Product no longer available'
      });
    }

    res.json({
      success: true,
      inquiry
    });

  } catch (error) {
    console.error('Get inquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

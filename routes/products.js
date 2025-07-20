const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const NewSupplier = require('../models/NewSupplier');

// Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    // Category filters
    if (req.query.broaderCategory) {
      filter.broaderCategory = req.query.broaderCategory;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.subcategory) {
      filter.subcategory = req.query.subcategory;
    }
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    } else {
      filter.status = 'approved'; // Default to approved products only
    }
    
    // Material filter
    if (req.query.material) {
      filter['specifications.material'] = new RegExp(req.query.material, 'i');
    }
    
    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filter['pricing.basePrice'] = {};
      if (req.query.minPrice) filter['pricing.basePrice'].$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter['pricing.basePrice'].$lte = parseFloat(req.query.maxPrice);
    }
    
    // Eco score filter
    if (req.query.minEcoScore) {
      filter.ecoScore = { $gte: parseInt(req.query.minEcoScore) };
    }
    
    // Search text
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') },
        { 'specifications.material': new RegExp(req.query.search, 'i') }
      ];
    }
    
    // Sort options
    let sort = { createdAt: -1 }; // Default sort by newest
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price_low':
          sort = { 'pricing.basePrice': 1 };
          break;
        case 'price_high':
          sort = { 'pricing.basePrice': -1 };
          break;
        case 'eco_score':
          sort = { ecoScore: -1 };
          break;
        case 'rating':
          sort = { averageRating: -1 };
          break;
        case 'name':
          sort = { name: 1 };
          break;
        default:
          sort = { createdAt: -1 };
      }
    }
    
    const products = await Product.find(filter)
      .populate('supplier', 'companyName companyLogo address.country averageRating')
      .sort(sort)
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
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplier', 'companyName companyDescription companyLogo address contactInfo certifications averageRating totalReviews');
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Increment view count
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get products by supplier
router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { 
      supplier: req.params.supplierId,
      status: req.query.includeAll === 'true' ? { $in: ['approved', 'pending'] } : 'approved'
    };
    
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Product.countDocuments(filter);
    
    res.json({
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalProducts: total
      }
    });
  } catch (error) {
    console.error('Error fetching supplier products:', error);
    res.status(500).json({ error: 'Failed to fetch supplier products' });
  }
});

// Get featured products
router.get('/featured/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const products = await Product.find({ 
      status: 'approved', 
      featured: true 
    })
      .populate('supplier', 'companyName companyLogo address.country')
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

// Get trending products
router.get('/trending/list', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    
    const products = await Product.find({ 
      status: 'approved', 
      trending: true 
    })
      .populate('supplier', 'companyName companyLogo address.country')
      .sort({ views: -1 })
      .limit(limit);
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

// Get product categories and filters
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: {
            broaderCategory: '$broaderCategory',
            category: '$category'
          },
          count: { $sum: 1 },
          subcategories: { $addToSet: '$subcategory' }
        }
      },
      {
        $group: {
          _id: '$_id.broaderCategory',
          categories: {
            $push: {
              name: '$_id.category',
              count: '$count',
              subcategories: {
                $filter: {
                  input: '$subcategories',
                  cond: { $ne: ['$$this', ''] }
                }
              }
            }
          }
        }
      }
    ]);
    
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Add product quote request (new implementation)
router.post('/:id/quote-request', async (req, res) => {
  try {
    // Forward to inquiries route
    const inquiryService = require('./inquiries');
    req.body.productId = req.params.id;
    
    // Call the inquiry creation logic
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const Inquiry = require('../models/Inquiry');
    
    // Extract and verify token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    const {
      productId,
      subject,
      message,
      requestedQuantity
    } = req.body;

    // Check if product exists and get supplier info
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log('Product found:', {
      id: product._id,
      name: product.name,
      supplier: product.supplier
    });

    // Create inquiry
    const inquiry = new Inquiry({
      userId: user._id,
      supplierId: product.supplier,
      productId: req.params.id,
      subject: subject || `Quote Request for ${product.name}`,
      message: message || `I am interested in getting a quote for ${product.name}`,
      requestedQuantity: requestedQuantity || product.specifications.minimumOrderQuantity,
      contactInfo: {
        email: user.email,
        phone: user.phone,
        preferredMethod: 'email'
      }
    });

    console.log('Creating inquiry with data:', {
      userId: user._id,
      supplierId: product.supplier,
      productId: req.params.id
    });

    const savedInquiry = await inquiry.save();
    console.log('Inquiry saved successfully:', savedInquiry.inquiryNumber);

    // Add inquiry to user's inquiries array
    await User.findByIdAndUpdate(user._id, {
      $push: { inquiries: savedInquiry._id }
    });

    // Increment product inquiry count
    await Product.findByIdAndUpdate(req.params.id, {
      $inc: { inquiries: 1 }
    });

    res.json({
      success: true,
      message: 'Quote request sent successfully',
      inquiry: {
        id: savedInquiry._id,
        inquiryNumber: savedInquiry.inquiryNumber,
        status: savedInquiry.status
      }
    });

  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({ success: false, message: 'Failed to send quote request' });
  }
});

// Add product inquiry
router.post('/:id/inquiry', async (req, res) => {
  try {
    const { message, contactInfo } = req.body;
    
    if (!message || !contactInfo?.email) {
      return res.status(400).json({ error: 'Message and email are required' });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Increment inquiry count
    await Product.findByIdAndUpdate(req.params.id, { $inc: { inquiries: 1 } });
    
    // Here you would typically send an email to the supplier
    // For now, we'll just return success
    
    res.json({ message: 'Inquiry sent successfully' });
  } catch (error) {
    console.error('Error sending inquiry:', error);
    res.status(500).json({ error: 'Failed to send inquiry' });
  }
});

// Add product review
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, comment, reviewerName } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const review = {
      rating,
      comment: comment || '',
      reviewerName: reviewerName || 'Anonymous',
      reviewDate: new Date(),
      verified: false
    };
    
    product.reviews.push(review);
    product.calculateAverageRating();
    await product.save();
    
    res.json({ message: 'Review added successfully', review });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Bulk create products (AI extracted products)
router.post('/bulk-create', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid products data' });
    }

    // Get supplier ID from token
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
    const decoded = jwt.verify(token, JWT_SECRET);
    const supplierId = decoded.supplierId;

    const createdProducts = [];
    const errors = [];

    for (const productData of products) {
      try {
        // Remove the temporary fields and prepare for database
        const { id, similarProducts, missingFields, ...productForDB } = productData;
        
        // Create the product in database
        const product = new Product({
          ...productForDB,
          supplier: supplierId,
          status: 'pending', // All AI-extracted products need approval
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await product.save();
        createdProducts.push(product);

      } catch (error) {
        console.error('Error creating product:', error);
        errors.push(`Failed to create product "${productData.name}": ${error.message}`);
      }
    }

    res.json({
      success: true,
      created: createdProducts.length,
      errors: errors.length > 0 ? errors : undefined,
      products: createdProducts
    });

  } catch (error) {
    console.error('Error in bulk-create:', error);
    res.status(500).json({ error: 'Failed to create products' });
  }
});

module.exports = router;

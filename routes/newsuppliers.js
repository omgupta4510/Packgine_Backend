const express = require('express');
const router = express.Router();
const NewSupplier = require('../models/NewSupplier');
const Product = require('../models/Product');

// Get all suppliers with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = { accountStatus: 'approved' }; // Only show approved suppliers
    
    // Country filter
    if (req.query.country) {
      filter['address.country'] = req.query.country;
    }
    
    // Category filter
    if (req.query.category) {
      filter.categories = req.query.category;
    }
    
    // Search text
    if (req.query.search) {
      filter.$or = [
        { companyName: new RegExp(req.query.search, 'i') },
        { companyDescription: new RegExp(req.query.search, 'i') },
        { categories: new RegExp(req.query.search, 'i') }
      ];
    }
    
    // Sort options
    let sort = { createdAt: -1 }; // Default sort by newest
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'rating':
          sort = { averageRating: -1 };
          break;
        case 'name':
          sort = { companyName: 1 };
          break;
        case 'products':
          sort = { 'stats.totalProducts': -1 };
          break;
        default:
          sort = { createdAt: -1 };
      }
    }
    
    const suppliers = await NewSupplier.find(filter)
      .select('companyName companyDescription companyLogo address categories averageRating totalReviews stats.totalProducts createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await NewSupplier.countDocuments(filter);
    
    res.json({
      suppliers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSuppliers: total,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// Get single supplier by ID
router.get('/:id', async (req, res) => {
  try {
    const supplier = await NewSupplier.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Get supplier's products
    const products = await Product.find({ 
      supplier: req.params.id, 
      status: 'approved' 
    })
      .select('name primaryImage category ecoScore pricing.basePrice averageRating')
      .limit(10)
      .sort({ createdAt: -1 });
    
    const supplierData = supplier.toObject();
    supplierData.products = products;
    
    res.json(supplierData);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// Get supplier by username
router.get('/username/:username', async (req, res) => {
  try {
    const supplier = await NewSupplier.findOne({ username: req.params.username })
      .select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Get supplier's products
    const products = await Product.find({ 
      supplier: supplier._id, 
      status: 'approved' 
    })
      .select('name primaryImage category ecoScore pricing.basePrice averageRating')
      .limit(10)
      .sort({ createdAt: -1 });
    
    const supplierData = supplier.toObject();
    supplierData.products = products;
    
    res.json(supplierData);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
});

// Get suppliers by category
router.get('/category/:category', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const suppliers = await NewSupplier.find({
      categories: req.params.category,
      accountStatus: 'approved'
    })
      .select('companyName companyDescription companyLogo address categories averageRating stats.totalProducts')
      .sort({ averageRating: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await NewSupplier.countDocuments({
      categories: req.params.category,
      accountStatus: 'approved'
    });
    
    res.json({
      suppliers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSuppliers: total
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers by category:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers by category' });
  }
});

// Get suppliers by country
router.get('/country/:country', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const suppliers = await NewSupplier.find({
      'address.country': req.params.country,
      accountStatus: 'approved'
    })
      .select('companyName companyDescription companyLogo address categories averageRating stats.totalProducts')
      .sort({ averageRating: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await NewSupplier.countDocuments({
      'address.country': req.params.country,
      accountStatus: 'approved'
    });
    
    res.json({
      suppliers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSuppliers: total
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers by country:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers by country' });
  }
});

// Get supplier statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalSuppliers = await NewSupplier.countDocuments({ accountStatus: 'approved' });
    const totalProducts = await Product.countDocuments({ status: 'approved' });
    
    // Get top countries
    const topCountries = await NewSupplier.aggregate([
      { $match: { accountStatus: 'approved' } },
      { $group: { _id: '$address.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get top categories
    const topCategories = await NewSupplier.aggregate([
      { $match: { accountStatus: 'approved' } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      totalSuppliers,
      totalProducts,
      topCountries: topCountries.map(item => ({
        country: item._id || 'Unknown',
        count: item.count
      })),
      topCategories: topCategories.map(item => ({
        category: item._id,
        count: item.count
      }))
    });
  } catch (error) {
    console.error('Error fetching supplier statistics:', error);
    res.status(500).json({ error: 'Failed to fetch supplier statistics' });
  }
});

// Add supplier review
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, comment, reviewerName, aspects } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }
    
    const supplier = await NewSupplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    const review = {
      rating,
      comment: comment || '',
      reviewerName: reviewerName || 'Anonymous',
      reviewDate: new Date(),
      verified: false,
      aspects: aspects || {}
    };
    
    supplier.reviews.push(review);
    supplier.calculateAverageRating();
    await supplier.save();
    
    res.json({ message: 'Review added successfully', review });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Get all available countries
router.get('/locations/countries', async (req, res) => {
  try {
    const countries = await NewSupplier.distinct('address.country', { 
      accountStatus: 'approved' 
    });
    
    res.json(countries.filter(country => country && country !== ''));
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get all available categories
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await NewSupplier.distinct('categories', { 
      accountStatus: 'approved' 
    });
    
    res.json(categories.filter(category => category && category !== ''));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const NewSupplier = require('../models/NewSupplier');

// JWT secret (in production, this should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Supplier registration
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      username,
      companyName,
      companyDescription,
      contactInfo,
      address,
      categories
    } = req.body;

    // Validation
    if (!email || !password || !username || !companyName) {
      return res.status(400).json({
        error: 'Email, password, username, and company name are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if supplier already exists
    const existingSupplier = await NewSupplier.findOne({
      $or: [{ email }, { username }]
    });

    if (existingSupplier) {
      return res.status(400).json({
        error: 'Supplier with this email or username already exists'
      });
    }

    // Create new supplier
    const supplier = new NewSupplier({
      email,
      password, // Will be hashed by the pre-save middleware
      username,
      companyName,
      companyDescription: companyDescription || `${companyName} - Quality packaging solutions`,
      contactInfo: contactInfo || {},
      address: address || {},
      categories: categories || [],
      accountStatus: 'pending', // Requires approval
      verificationStatus: {
        emailVerified: false,
        phoneVerified: false,
        businessVerified: false,
        documentsVerified: false
      }
    });

    await supplier.save();

    // Generate JWT token
    const token = jwt.sign(
      { supplierId: supplier._id, email: supplier.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const supplierResponse = supplier.toObject();
    delete supplierResponse.password;

    res.status(201).json({
      message: 'Supplier registered successfully',
      token,
      supplier: supplierResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register supplier' });
  }
});

// Supplier login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find supplier by email
    const supplier = await NewSupplier.findOne({ email });

    if (!supplier) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (supplier.isLocked) {
      return res.status(423).json({
        error: 'Account temporarily locked due to too many login attempts'
      });
    }

    // Verify password
    const isPasswordValid = await supplier.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await supplier.incLoginAttempts();
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    if (supplier.loginAttempts > 0) {
      await NewSupplier.findByIdAndUpdate(supplier._id, {
        $unset: { loginAttempts: 1, lockUntil: 1 }
      });
    }

    // Update last login
    supplier.lastLogin = new Date();
    await supplier.save();

    // Generate JWT token
    const token = jwt.sign(
      { supplierId: supplier._id, email: supplier.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const supplierResponse = supplier.toObject();
    delete supplierResponse.password;

    res.json({
      message: 'Login successful',
      token,
      supplier: supplierResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

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

// Get supplier profile (protected route)
router.get('/profile', authenticateSupplier, async (req, res) => {
  try {
    res.json(req.supplier);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update supplier profile (protected route)
router.put('/profile', authenticateSupplier, async (req, res) => {
  try {
    const allowedUpdates = [
      'companyName',
      'companyDescription',
      'website',
      'contactInfo',
      'address',
      'categories',
      'manufacturing',
      'sustainabilityProfile',
      'preferences'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const supplier = await NewSupplier.findByIdAndUpdate(
      req.supplier._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      supplier
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password (protected route)
router.post('/change-password', authenticateSupplier, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long'
      });
    }

    const supplier = await NewSupplier.findById(req.supplier._id);

    // Verify current password
    const isCurrentPasswordValid = await supplier.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Current password is incorrect'
      });
    }

    // Update password
    supplier.password = newPassword; // Will be hashed by pre-save middleware
    await supplier.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Logout (client-side should discard token)
router.post('/logout', authenticateSupplier, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Verify token endpoint
router.get('/verify-token', authenticateSupplier, (req, res) => {
  res.json({ 
    valid: true, 
    supplier: req.supplier 
  });
});

module.exports = router;

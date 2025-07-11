const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;

// Import routes
const supplierRoutes = require('./routes/suppliers');
const productRoutes = require('./routes/products');
const newSupplierRoutes = require('./routes/newsuppliers');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const inquiryRoutes = require('./routes/inquiries');
const { router: userRoutes } = require('./routes/users');

// Simple root route
dbConnect();
app.get('/', (req, res) => {
  res.send('EcoPack B2B Backend is running');
});
app.get('/check', (req, res) => {
  res.send('Checking connection');
});

// Admin dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API routes
app.use('/api/suppliers', supplierRoutes); // Legacy route (keep for backward compatibility)
app.use('/api/products', productRoutes); // New product routes
app.use('/api/newsuppliers', newSupplierRoutes); // New supplier routes
app.use('/api/supplier/auth', authRoutes); // Supplier authentication
app.use('/api/dashboard', dashboardRoutes); // Supplier dashboard
app.use('/api/user', userRoutes); // User authentication and management
app.use('/api/inquiries', inquiryRoutes); // Inquiry management

function dbConnect() {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin dashboard available at http://localhost:${PORT}/admin`);
});

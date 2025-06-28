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
app.use('/api/suppliers', supplierRoutes);

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

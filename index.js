const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Simple root route
dbConnect();
app.get('/', (req, res) => {
  res.send('EcoPack B2B Backend is running');
});

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
});

# AI Product Entry System

An AI-powered product entry system for Berlin Packaging's sales team portal that enables efficient product creation through file uploads and AI-powered data extraction.

## Features

### 🤖 AI-Powered Product Extraction
- Upload Excel (.xlsx, .xls), PDF, or PowerPoint (.pptx, .ppt) files
- Automatic product information extraction using OpenAI/Groq APIs
- Intelligent categorization and specification parsing
- Product similarity detection to avoid duplicates

### 📊 Multi-Step Workflow
1. **Upload**: Drag & drop or select files for processing
2. **Processing**: AI extracts product information from uploaded files
3. **Review**: Edit, approve, or reject extracted products
4. **Summary**: View creation results and manage products

### 🔧 Smart Data Processing
- **Excel Files**: Extracts product data from spreadsheet rows and columns
- **PDF Files**: Parses text content and extracts product specifications
- **PowerPoint Files**: Analyzes slide content for product information
- **Field Validation**: Identifies missing required fields
- **Duplicate Detection**: Warns about similar existing products

### 💼 Supplier Management
- JWT-based authentication for suppliers
- Role-based access control
- Product approval workflow
- Bulk product creation and management

## Technical Architecture

### Frontend (React + TypeScript)
```
src/
├── components/
│   └── products/
│       ├── ProductSummary.tsx     # Product review component
│       └── ProductFilter/         # Product filtering components
├── pages/
│   └── AIProductEntryPage.tsx     # Main AI entry workflow
└── utils/
    └── api.ts                     # API utilities
```

### Backend (Node.js + Express)
```
Backend/
├── routes/
│   ├── aiProductExtract.js        # AI extraction endpoints
│   ├── products.js                # Product management
│   └── auth.js                    # Authentication
├── services/
│   └── aiService.js               # AI service integration
├── models/
│   ├── Product.js                 # Product schema
│   └── Supplier.js                # Supplier schema
└── middleware/
    └── auth.js                    # Authentication middleware
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- OpenAI API key or Groq API key

### Environment Configuration
Create a `.env` file in the Backend directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/packgine

# AI Services (at least one required)
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Authentication
JWT_SECRET=your_jwt_secret_key_here

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Backend Setup
```bash
cd Backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```

## API Endpoints

### AI Product Extraction
- `POST /api/ai/extract-products` - Extract products from uploaded files
- `POST /api/ai/submit-products` - Submit approved products to database

### Product Management
- `GET /api/products` - Get products with filtering
- `POST /api/products` - Create new product
- `POST /api/products/bulk-create` - Create multiple products

### Authentication
- `POST /api/auth/supplier/login` - Supplier login
- `POST /api/auth/supplier/register` - Supplier registration

## Usage Guide

### For Suppliers

1. **Login**: Access the supplier portal with your credentials
2. **Navigate**: Go to "Add Products" → "AI Product Entry"
3. **Upload**: Select or drag & drop your product files
4. **Review**: AI will extract product information for your review
5. **Edit**: Modify any extracted information as needed
6. **Approve**: Approve products you want to create
7. **Submit**: Submit approved products for admin approval

### File Format Guidelines

#### Excel Files
- Use clear column headers (Name, Description, Category, etc.)
- Include product specifications in separate columns
- One product per row
- Supported formats: .xlsx, .xls

#### PDF Files
- Use structured text format
- Include product names, descriptions, and specifications
- Clear section separators help AI extraction

#### PowerPoint Files
- One product per slide or clear product sections
- Include product images and specifications
- Supported formats: .pptx, .ppt

## AI Service Integration

### OpenAI Integration
- Uses GPT-3.5-turbo for product extraction
- Structured prompts for consistent data extraction
- Fallback handling for rate limits

### Groq Integration
- Uses Llama3-8b-8192 model
- Fast inference for real-time processing
- Alternative provider for redundancy

### Product Schema
```javascript
{
  name: String,
  description: String,
  category: String,
  broaderCategory: String,
  subcategory: String,
  specifications: {
    material: String,
    capacity: { value: Number, unit: String },
    dimensions: { height: Number, width: Number, depth: Number, unit: String },
    color: String,
    minimumOrderQuantity: Number
  },
  pricing: {
    basePrice: Number,
    currency: String
  },
  features: [String],
  certifications: [String],
  sustainability: {
    recyclable: Boolean,
    biodegradable: Boolean,
    sustainableSourcing: Boolean
  }
}
```

## Error Handling

### File Processing Errors
- Invalid file types are rejected
- File size limits enforced (10MB max)
- Graceful handling of corrupted files

### AI Service Errors
- Automatic fallback between providers
- Rate limit handling with exponential backoff
- Error logging for debugging

### Database Errors
- Validation error reporting
- Duplicate prevention
- Transaction rollback on failures

## Security Features

### Authentication
- JWT tokens for session management
- Role-based access control
- Secure password hashing with bcrypt

### File Upload Security
- File type validation
- Size limits
- Temporary file cleanup
- Path traversal protection

### Data Validation
- Input sanitization
- Schema validation
- SQL injection prevention

## Performance Optimization

### File Processing
- Streaming file uploads
- Asynchronous processing
- Memory-efficient parsing

### AI Service Usage
- Request batching
- Response caching
- Provider load balancing

### Database Optimization
- Indexed queries
- Pagination support
- Efficient aggregation

## Monitoring & Logging

### Application Logs
- Request/response logging
- Error tracking
- Performance metrics

### AI Service Monitoring
- Usage statistics
- Error rates
- Response times

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Test Files
- Sample Excel files in `test-data/`
- Mock AI responses for testing
- Database seeding scripts

## Deployment

### Docker Support
```bash
docker-compose up
```

### Environment Variables
- Production configuration
- SSL certificates
- Database connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is proprietary software for Berlin Packaging.

## Support

For technical support or questions:
- Email: support@berlinpackaging.com
- Documentation: [Internal Wiki]
- Issues: [Internal Issue Tracker]

## Changelog

### v1.0.0
- Initial release
- AI-powered product extraction
- Multi-file upload support
- Product review workflow
- Supplier authentication

### Future Enhancements
- Image processing for product photos
- Batch processing for large files
- Advanced similarity detection
- Integration with inventory systems
- Mobile app support

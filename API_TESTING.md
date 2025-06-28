# Supplier API Testing

## Test the API endpoints with these curl commands:

### 1. Test Basic Connection
```bash
curl http://localhost:5000/check
```

### 2. Create a Supplier Registration
```bash
curl -X POST http://localhost:5000/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{
    "broaderCategory": "Base Packaging",
    "category": "Bottle", 
    "filters": {
      "Sustainability": ["Recycled Content", "Bio Based Material"],
      "Material": ["HDPE", "PP"],
      "Size": ["Min: 100", "Max: 500", "Unit: ml"],
      "Location": ["USA", "Germany"]
    },
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }'
```

### 3. Get All Suppliers
```bash
curl http://localhost:5000/api/suppliers
```

### 4. Get Suppliers with Filter
```bash
curl "http://localhost:5000/api/suppliers?status=pending&category=Bottle"
```

### 5. Update Supplier Status (replace {id} with actual supplier ID)
```bash
curl -X PUT http://localhost:5000/api/suppliers/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

## Frontend Integration

The frontend now includes:
- ✅ Submit Registration button
- ✅ API call to POST /api/suppliers
- ✅ Loading states during submission
- ✅ Success/error handling
- ✅ Environment variable for backend URL

## Data Structure Stored:

```json
{
  "_id": "ObjectId",
  "broaderCategory": "Base Packaging",
  "category": "Bottle",
  "filters": {
    "Sustainability": ["Recycled Content"],
    "Material": ["HDPE", "PP"],
    "Size": ["Min: 100", "Max: 500", "Unit: ml"],
    "Location": ["USA", "Germany"]
  },
  "images": [
    "https://res.cloudinary.com/...",
    "https://res.cloudinary.com/..."
  ],
  "status": "pending",
  "submittedAt": "2025-06-28T...",
  "createdAt": "2025-06-28T...",
  "updatedAt": "2025-06-28T..."
}
```

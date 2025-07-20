const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');
const Product = require('../models/Product');
const { authenticateSupplier } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/pdf', // pdf
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint' // ppt
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel, PDF, and PowerPoint files are allowed.'));
    }
  }
});

// AI/LLM integration
const { processWithAI } = require('../services/aiService');

// Single file extraction endpoint
router.post('/extract-products', authenticateSupplier, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size} bytes`);

    let extractedText = '';
    let products = [];

    try {
      // Extract text from file based on type
      const mimetype = file.mimetype;
      
      if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
        extractedText = await extractFromExcel(file.buffer);
      } else if (mimetype.includes('pdf')) {
        extractedText = await extractFromPDF(file.buffer);
      } else if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) {
        extractedText = await extractFromPowerPoint(file.buffer);
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      console.log(`Extracted text length: ${extractedText.length} characters`);

      // Process with AI if text was extracted
      if (extractedText.trim()) {
        try {
          console.log('Using AI provider: openai');
          console.log(`Sending prompt to https://api.openai.com/v1 with model gpt-4`);
          const aiResponse = await processWithAI(extractedText, file.originalname);
          
          if (aiResponse && aiResponse.products && aiResponse.products.length > 0) {
            products = aiResponse.products.map(product => ({
              id: uuidv4(),
              name: product.name,
              description: product.description,
              category: product.category,
              broaderCategory: product.broaderCategory,
              subcategory: product.subcategory,
              specifications: {
                material: product.specifications?.material || '',
                minimumOrderQuantity: product.specifications?.minimumOrderQuantity || 1000,
                availableQuantity: product.specifications?.availableQuantity || 5000,
                color: product.specifications?.color || '',
                capacity: product.specifications?.capacity || { value: 0, unit: 'ml' },
                dimensions: product.specifications?.dimensions || { height: 0, width: 0, depth: 0, unit: 'mm' },
                weight: product.specifications?.weight || { value: 0, unit: 'g' },
                // Create dynamic specs from the specifications (avoid duplicating existing fields)
                dynamicSpecs: [
                  // Only add to dynamicSpecs if it's not already in the main specification fields
                  ...(product.specifications?.color ? [{
                    name: 'Color',
                    value: product.specifications.color,
                    category: 'physical',
                    displayOrder: 5,
                    isRequired: false
                  }] : []),
                  ...(product.specifications?.finish ? [{
                    name: 'Finish',
                    value: product.specifications.finish,
                    category: 'physical',
                    displayOrder: 6,
                    isRequired: false
                  }] : []),
                  ...(product.specifications?.closure ? [{
                    name: 'Closure',
                    value: product.specifications.closure,
                    category: 'technical',
                    displayOrder: 7,
                    isRequired: false
                  }] : [])
                ].filter(spec => spec.value && spec.value !== 'Not specified')
              },
              pricing: {
                basePrice: product.pricing?.basePrice || 0,
                currency: product.pricing?.currency || 'USD',
                priceBreaks: product.pricing?.priceBreaks || []
              },
              // Add eco score and details
              ecoScore: product.ecoScore || 0,
              ecoScoreDetails: {
                recyclability: product.ecoScoreDetails?.recyclability || 0,
                carbonFootprint: product.ecoScoreDetails?.carbonFootprint || 0,
                sustainableMaterials: product.ecoScoreDetails?.sustainableMaterials || 0,
                localSourcing: product.ecoScoreDetails?.localSourcing || 0
              },
              // Enhanced sustainability fields
              sustainability: {
                recycledContent: product.sustainability?.recycledContent || 0,
                biodegradable: product.sustainability?.biodegradable || false,
                compostable: product.sustainability?.compostable || false,
                refillable: product.sustainability?.refillable || false,
                sustainableSourcing: product.sustainability?.sustainableSourcing || false,
                carbonNeutral: product.sustainability?.carbonNeutral || false
              },
              // Add category and common filters
              categoryFilters: product.categoryFilters || [],
              commonFilters: product.commonFilters || [],
              // Add customization options
              customization: {
                printingAvailable: product.customization?.printingAvailable || false,
                labelingAvailable: product.customization?.labelingAvailable || false,
                colorOptions: product.customization?.colorOptions || [],
                printingMethods: product.customization?.printingMethods || [],
                customSizes: product.customization?.customSizes || false
              },
              features: product.features || [],
              certifications: (product.certifications || []).map(cert => ({
                name: typeof cert === 'string' ? cert : cert.name,
                certificationBody: typeof cert === 'object' ? cert.certificationBody : 'Unknown',
                validUntil: typeof cert === 'object' ? cert.validUntil : null,
                certificateNumber: typeof cert === 'object' ? cert.certificateNumber : null
              })),
              images: product.images || [],
              status: 'extracted',
              similarProducts: [],
              missingFields: []
            }));
          } else {
            console.log('No products extracted from AI response');
            // Create a single item indicating no products were found
            products = [{
              id: uuidv4(),
              name: `No products found in ${file.originalname}`,
              description: `AI analysis of ${file.originalname} did not find any product information. ${aiResponse?.summary?.processingNotes || 'The file may contain instructional text or placeholders rather than actual product data.'}`,
              category: 'Uncategorized',
              broaderCategory: 'Other',
              subcategory: 'Review Required',
              specifications: {
                material: 'Unknown',
                minimumOrderQuantity: 1000,
                color: 'N/A',
                capacity: { value: 0, unit: 'ml' },
                dimensions: { height: 0, width: 0, depth: 0, unit: 'mm' }
              },
              pricing: {
                basePrice: 0,
                currency: 'USD'
              },
              features: ['Requires manual review'],
              certifications: [],
              sustainability: {
                recyclable: false,
                biodegradable: false,
                sustainableSourcing: false
              },
              images: [],
              status: 'requires_review',
              similarProducts: [],
              missingFields: ['All fields need review']
            }];
          }
        } catch (aiError) {
          console.error('AI processing failed, using fallback:', aiError);
          // Create a fallback entry indicating AI processing failed
          products = [{
            id: uuidv4(),
            name: `AI Processing Failed: ${file.originalname}`,
            description: `Failed to process ${file.originalname} with AI. Error: ${aiError.message}. This item requires manual review and data entry.`,
            category: 'Uncategorized',
            broaderCategory: 'Other',
            subcategory: 'AI Processing Failed',
            specifications: {
              material: 'Unknown - Requires Manual Review',
              minimumOrderQuantity: 1000,
              color: 'Unknown',
              capacity: { value: 0, unit: 'ml' },
              dimensions: { height: 0, width: 0, depth: 0, unit: 'mm' }
            },
            pricing: {
              basePrice: 0,
              currency: 'USD'
            },
            features: ['Requires manual data entry', 'AI processing failed'],
            certifications: [],
            sustainability: {
              recyclable: false,
              biodegradable: false,
              sustainableSourcing: false
            },
            images: [],
            status: 'ai_failed',
            similarProducts: [],
            missingFields: ['All fields require manual review']
          }];
        }
      } else {
        // No text extracted, create basic product
        products = [{
          id: uuidv4(),
          name: `Product from ${file.originalname}`,
          description: `File uploaded: ${file.originalname}. No text could be extracted.`,
          category: 'Bottles',
          broaderCategory: 'Packaging',
          specifications: {
            material: 'Unknown',
            minimumOrderQuantity: 1000,
            color: 'Clear',
            capacity: { value: 0, unit: 'ml' },
            dimensions: { height: 0, width: 0, depth: 0, unit: 'mm' }
          },
          pricing: {
            basePrice: 0,
            currency: 'USD'
          },
          features: [],
          certifications: [],
          sustainability: {
            recyclable: false,
            biodegradable: false,
            sustainableSourcing: false
          },
          images: [],
          status: 'extracted',
          similarProducts: [],
          missingFields: ['material', 'specifications', 'pricing']
        }];
      }

      console.log(`Created ${products.length} products from file processing`);

      res.json({
        success: true,
        products: products,
        message: `Successfully extracted ${products.length} product(s) from ${file.originalname}`,
        extractedTextLength: extractedText.length
      });

    } catch (processError) {
      console.error('Error processing file:', processError);
      
      res.status(500).json({ 
        error: 'Failed to process file',
        details: processError.message 
      });
    }

  } catch (error) {
    console.error('Error in extract-products endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
});

// Multiple files extraction endpoint
router.post('/extract-products-bulk', authenticateSupplier, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const extractedProducts = [];
    const processingErrors = [];

    for (const file of req.files) {
      try {
        let extractedText = '';
        
        // Extract text based on file type
        if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel')) {
          extractedText = await extractFromExcel(file.buffer);
        } else if (file.mimetype.includes('pdf')) {
          extractedText = await extractFromPDF(file.buffer);
        } else if (file.mimetype.includes('presentation') || file.mimetype.includes('powerpoint')) {
          extractedText = await extractFromPowerPoint(file.buffer);
        }

        if (!extractedText.trim()) {
          processingErrors.push(`No text could be extracted from ${file.originalname}`);
          continue;
        }

        // Process with AI to structure the data
        const aiResponse = await processWithAI(extractedText, file.originalname);
        
        // Parse AI response and create product objects
        const products = await parseAIResponse(aiResponse, req.supplier._id);
        
        // Check for similar products
        for (const product of products) {
          const similarProducts = await findSimilarProducts(product);
          product.similarProducts = similarProducts;
        }

        extractedProducts.push(...products);
        
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        processingErrors.push(`Error processing ${file.originalname}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      products: extractedProducts,
      errors: processingErrors.length > 0 ? processingErrors : undefined
    });

  } catch (error) {
    console.error('Error in extract-products:', error);
    res.status(500).json({ error: 'Failed to extract products from files' });
  }
});

// Extract text from Excel files
async function extractFromExcel(buffer) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    let extractedText = '';
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Convert to readable text
      jsonData.forEach(row => {
        if (row.length > 0) {
          extractedText += row.join(' | ') + '\n';
        }
      });
    });
    
    return extractedText;
  } catch (error) {
    throw new Error(`Excel extraction failed: ${error.message}`);
  }
}

// Extract text from PDF files
async function extractFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

// Extract text from PowerPoint files
async function extractFromPowerPoint(buffer) {
  try {
    console.log('Extracting text from PowerPoint file...');
    
    // PowerPoint files (.pptx) are essentially zip files
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    let extractedText = '';
    
    // Look for slide content in the zip structure
    zipEntries.forEach(entry => {
      const entryName = entry.entryName;
      
      // Extract text from slide XML files
      if (entryName.includes('ppt/slides/slide') && entryName.endsWith('.xml')) {
        const slideContent = entry.getData().toString('utf8');
        
        // Extract text from XML using regex patterns
        const textMatches = slideContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
        if (textMatches) {
          textMatches.forEach(match => {
            const text = match.replace(/<[^>]*>/g, '').trim();
            if (text && text.length > 0) {
              extractedText += text + '\n';
            }
          });
        }
        
        // Also extract from paragraph runs
        const runMatches = slideContent.match(/<a:r[^>]*>.*?<\/a:r>/g);
        if (runMatches) {
          runMatches.forEach(match => {
            const textInRun = match.match(/<a:t[^>]*>(.*?)<\/a:t>/);
            if (textInRun && textInRun[1]) {
              const text = textInRun[1].trim();
              if (text && text.length > 0) {
                extractedText += text + '\n';
              }
            }
          });
        }
        
        extractedText += '\n--- SLIDE BREAK ---\n\n';
      }
      
      // Extract text from notes if present
      if (entryName.includes('ppt/notesSlides/notesSlide') && entryName.endsWith('.xml')) {
        const notesContent = entry.getData().toString('utf8');
        const notesMatches = notesContent.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
        if (notesMatches) {
          extractedText += '\n--- NOTES ---\n';
          notesMatches.forEach(match => {
            const text = match.replace(/<[^>]*>/g, '').trim();
            if (text && text.length > 0) {
              extractedText += text + '\n';
            }
          });
        }
      }
    });
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    
    console.log(`Extracted ${extractedText.length} characters from PowerPoint`);
    
    if (extractedText.length > 0) {
      return extractedText;
    } else {
      // If no text was extracted, provide a basic structure
      return `PowerPoint file processed: ${buffer.length} bytes
      
This PowerPoint file appears to contain presentation content.
The file may include:
- Product specifications
- Pricing information  
- Technical details
- Images and diagrams

Please note: Some PowerPoint files may contain primarily visual content or complex formatting that makes text extraction challenging. Consider providing the information in a more text-friendly format like PDF or Word document for better AI processing.`;
    }
    
  } catch (error) {
    console.error('PowerPoint extraction error:', error);
    
    // Fallback with basic file information
    return `PowerPoint file upload detected: ${buffer.length} bytes
    
This file appears to be a PowerPoint presentation that may contain:
- Product information
- Specifications
- Pricing details
- Technical documentation

Error during text extraction: ${error.message}

For better results, please consider:
1. Converting the PowerPoint to PDF format
2. Copying the content to a Word document
3. Providing the information in a structured Excel format

The AI will still attempt to process any available content, but manual review may be required.`;
  }
}

// Parse AI response and create structured product data
async function parseAIResponse(aiResponse, supplierId) {
  try {
    // Parse the AI response (assuming it returns JSON structure)
    const parsedResponse = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
    
    const products = [];
    
    if (parsedResponse.products && Array.isArray(parsedResponse.products)) {
      for (const productData of parsedResponse.products) {
        const product = {
          id: uuidv4(),
          name: productData.name || 'Unnamed Product',
          description: productData.description || '',
          category: productData.category || 'General',
          broaderCategory: productData.broaderCategory || 'Packaging',
          subcategory: productData.subcategory || '',
          specifications: {
            minimumOrderQuantity: productData.specifications?.minimumOrderQuantity || 1000,
            material: productData.specifications?.material || '',
            capacity: productData.specifications?.capacity || { value: 0, unit: 'ml' },
            dimensions: productData.specifications?.dimensions || { height: 0, width: 0, depth: 0, unit: 'mm' },
            color: productData.specifications?.color || '',
            ...productData.specifications
          },
          pricing: {
            basePrice: productData.pricing?.basePrice || 0,
            currency: productData.pricing?.currency || 'USD'
          },
          images: productData.images || [],
          features: productData.features || [],
          certifications: productData.certifications || [],
          sustainability: productData.sustainability || {},
          status: 'extracted',
          supplier: supplierId,
          similarProducts: [],
          missingFields: []
        };
        
        // Check for missing required fields
        product.missingFields = checkMissingFields(product);
        
        products.push(product);
      }
    }
    
    return products;
  } catch (error) {
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

// Check for missing required fields
function checkMissingFields(product) {
  const requiredFields = [];
  
  if (!product.name || product.name.trim() === '' || product.name === 'Unnamed Product') {
    requiredFields.push('Product Name');
  }
  
  if (!product.description || product.description.trim() === '') {
    requiredFields.push('Description');
  }
  
  if (!product.specifications.minimumOrderQuantity || product.specifications.minimumOrderQuantity <= 0) {
    requiredFields.push('Minimum Order Quantity');
  }
  
  if (!product.pricing.basePrice || product.pricing.basePrice <= 0) {
    requiredFields.push('Base Price');
  }
  
  if (!product.specifications.material || product.specifications.material.trim() === '') {
    requiredFields.push('Material');
  }
  
  if (product.images.length === 0) {
    requiredFields.push('Product Images');
  }
  
  return requiredFields;
}

// Find similar products in the database
async function findSimilarProducts(productData) {
  try {
    const similarProducts = await Product.find({
      $or: [
        { name: { $regex: productData.name, $options: 'i' } },
        { 
          $and: [
            { category: productData.category },
            { 'specifications.material': productData.specifications.material }
          ]
        }
      ]
    }).limit(5).select('name _id');
    
    return similarProducts.map(product => ({
      id: product._id,
      name: product.name,
      similarity: calculateSimilarity(productData, product)
    }));
  } catch (error) {
    console.error('Error finding similar products:', error);
    return [];
  }
}

// Calculate similarity score between products
function calculateSimilarity(product1, product2) {
  let score = 0;
  let factors = 0;
  
  // Name similarity
  if (product1.name && product2.name) {
    const nameScore = stringSimilarity(product1.name.toLowerCase(), product2.name.toLowerCase());
    score += nameScore;
    factors++;
  }
  
  // Category similarity
  if (product1.category === product2.category) {
    score += 0.5;
  }
  factors++;
  
  // Material similarity
  if (product1.specifications?.material && product2.specifications?.material) {
    if (product1.specifications.material.toLowerCase() === product2.specifications.material.toLowerCase()) {
      score += 0.3;
    }
  }
  factors++;
  
  return factors > 0 ? score / factors : 0;
}

// Simple string similarity function
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Bulk create products
router.post('/bulk-create', authenticateSupplier, async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Invalid products data' });
    }

    const createdProducts = [];
    const errors = [];

    for (const productData of products) {
      try {
        // Remove the temporary id and prepare for database
        const { id, similarProducts, missingFields, ...productForDB } = productData;
        
        // Create the product in database
        const product = new Product({
          ...productForDB,
          supplier: req.supplier._id,
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

// Submit Approved Products Endpoint
router.post('/submit-products', authenticateSupplier, async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array is required' });
    }
    
    // Filter only approved products
    const approvedProducts = products.filter(product => product.status === 'approved');
    
    if (approvedProducts.length === 0) {
      return res.status(400).json({ error: 'No approved products to submit' });
    }
    
    console.log('Approved products received:', approvedProducts.length);
    console.log('Sample product data:', JSON.stringify(approvedProducts[0], null, 2));
    
    // Prepare products for database insertion
    const productsToInsert = approvedProducts.map(product => ({
      name: product.name,
      description: product.description,
      category: product.category,
      broaderCategory: product.broaderCategory,
      subcategory: product.subcategory,
      supplier: req.supplier._id,
      specifications: {
        material: product.specifications?.material || 'Not specified',
        minimumOrderQuantity: product.specifications?.minimumOrderQuantity || 1000,
        availableQuantity: product.specifications?.availableQuantity || 5000,
        capacity: product.specifications?.capacity || { value: 0, unit: 'ml' },
        dimensions: product.specifications?.dimensions || { height: 0, width: 0, depth: 0, unit: 'mm' },
        weight: product.specifications?.weight || { value: 0, unit: 'g' },
        color: product.specifications?.color || '',
        // Create dynamic specs only for additional specifications not covered by main fields
        dynamicSpecs: [
          // Only add additional specs that are not already covered by the main specification fields
          ...(product.specifications?.color ? [{
            name: 'Color',
            value: product.specifications.color,
            category: 'physical',
            displayOrder: 5,
            isRequired: false
          }] : []),
          ...(product.specifications?.finish ? [{
            name: 'Finish',
            value: product.specifications.finish,
            category: 'physical',
            displayOrder: 6,
            isRequired: false
          }] : []),
          ...(product.specifications?.closure ? [{
            name: 'Closure',
            value: product.specifications.closure,
            category: 'technical',
            displayOrder: 7,
            isRequired: false
          }] : [])
        ].filter(spec => spec.value && spec.value !== 'Not specified')
      },
      pricing: {
        basePrice: product.pricing?.basePrice || 0,
        currency: product.pricing?.currency || 'USD',
        priceBreaks: product.pricing?.priceBreaks || []
      },
      // Add eco score and details
      ecoScore: product.ecoScore || 0,
      ecoScoreDetails: {
        recyclability: product.ecoScoreDetails?.recyclability || 0,
        carbonFootprint: product.ecoScoreDetails?.carbonFootprint || 0,
        sustainableMaterials: product.ecoScoreDetails?.sustainableMaterials || 0,
        localSourcing: product.ecoScoreDetails?.localSourcing || 0
      },
      // Enhanced sustainability fields
      sustainability: {
        recycledContent: product.sustainability?.recycledContent || 0,
        biodegradable: product.sustainability?.biodegradable || false,
        compostable: product.sustainability?.compostable || false,
        refillable: product.sustainability?.refillable || false,
        sustainableSourcing: product.sustainability?.sustainableSourcing || false,
        carbonNeutral: product.sustainability?.carbonNeutral || false
      },
      // Add category and common filters
      categoryFilters: product.categoryFilters || [],
      commonFilters: product.commonFilters || [],
      // Add customization options
      customization: {
        printingAvailable: product.customization?.printingAvailable || false,
        labelingAvailable: product.customization?.labelingAvailable || false,
        colorOptions: product.customization?.colorOptions || [],
        printingMethods: product.customization?.printingMethods || [],
        customSizes: product.customization?.customSizes || false
      },
      features: product.features || [],
      certifications: (product.certifications || []).map(cert => ({
        name: typeof cert === 'string' ? cert : cert.name,
        certificationBody: typeof cert === 'string' ? 'Unknown' : cert.certificationBody,
        validUntil: typeof cert === 'string' ? null : cert.validUntil,
        certificateNumber: typeof cert === 'string' ? null : cert.certificateNumber
      })),
      images: product.images || [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    console.log('Products to insert:', JSON.stringify(productsToInsert[0], null, 2));
    
    // Insert products into database
    const insertedProducts = await Product.insertMany(productsToInsert);
    
    console.log(`Successfully inserted ${insertedProducts.length} products`);
    console.log('Sample inserted product:', JSON.stringify(insertedProducts[0]?.toObject(), null, 2));
    
    console.log(`Successfully submitted ${insertedProducts.length} products for supplier ${req.supplier._id}`);
    
    res.json({
      success: true,
      message: `Successfully submitted ${insertedProducts.length} products for approval`,
      products: insertedProducts.map(p => ({
        id: p._id,
        name: p.name,
        status: p.status
      }))
    });
    
  } catch (error) {
    console.error('Error submitting products:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to submit products',
      details: error.message 
    });
  }
});

module.exports = router;
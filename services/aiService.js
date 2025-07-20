const axios = require('axios');

// Text optimization utilities
class TextOptimizer {
  constructor() {
    this.maxTokens = {
      'openai': 120000,  // GPT-4o limit with safety margin
      'groq': 7000       // Groq limit with safety margin
    };
  }

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Clean and optimize extracted text
  optimizeText(extractedText, fileName) {
    console.log(`Original text length: ${extractedText.length} characters`);
    
    let optimizedText = extractedText
      // Remove excessive whitespace and empty lines
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      // Remove common noise patterns
      .replace(/\[.*?\]/g, '') // Remove bracketed content
      .replace(/\(\s*\)/g, '') // Remove empty parentheses
      .replace(/\{\s*\}/g, '') // Remove empty braces
      // Remove repeated separators
      .replace(/\|+/g, '|')
      .replace(/\-+/g, '-')
      .replace(/\=+/g, '=')
      // Remove HTML entities that might have been missed
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      // Remove excessive punctuation
      .replace(/\.{3,}/g, '...')
      .replace(/\-{3,}/g, '---')
      // Trim and normalize
      .trim();

    // Extract key sections that are likely to contain product information
    optimizedText = this.extractProductSections(optimizedText);

    console.log(`Optimized text length: ${optimizedText.length} characters`);
    console.log(`Estimated tokens: ${this.estimateTokens(optimizedText)}`);
    
    return optimizedText;
  }

  // Extract sections likely to contain product information
  extractProductSections(text) {
    const productKeywords = [
      'product', 'bottle', 'jar', 'cap', 'container', 'packaging',
      'ml', 'oz', 'liter', 'gallon', 'gram', 'kg', 'pound',
      'material', 'plastic', 'glass', 'aluminum', 'steel',
      'price', 'cost', '$', '€', '£', 'USD', 'EUR',
      'specification', 'dimension', 'size', 'height', 'width',
      'minimum order', 'MOQ', 'quantity', 'wholesale',
      'certification', 'FDA', 'ISO', 'compliant',
      'color', 'transparent', 'opaque', 'clear', 'amber'
    ];

    const lines = text.split('\n');
    const productLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Check if line contains product-related keywords
      const hasProductKeyword = productKeywords.some(keyword => 
        line.includes(keyword.toLowerCase())
      );
      
      if (hasProductKeyword) {
        // Include context (previous and next lines)
        const contextStart = Math.max(0, i - 1);
        const contextEnd = Math.min(lines.length - 1, i + 1);
        
        for (let j = contextStart; j <= contextEnd; j++) {
          if (!productLines.includes(lines[j])) {
            productLines.push(lines[j]);
          }
        }
      }
    }
    
    // If we found product-related content, use it; otherwise use original
    return productLines.length > 0 ? productLines.join('\n') : text;
  }

  // Chunk text if it exceeds token limits
  chunkText(text, provider, maxChunkSize = null) {
    const maxTokens = maxChunkSize || this.maxTokens[provider] || 7000;
    const estimatedTokens = this.estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      return [text];
    }
    
    console.log(`Text too long (${estimatedTokens} tokens), chunking...`);
    
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const line of lines) {
      const lineTokens = this.estimateTokens(line);
      
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
        currentTokens = lineTokens;
      } else {
        currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
        currentTokens += lineTokens;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`Created ${chunks.length} chunks`);
    return chunks;
  }

  // Prioritize chunks by relevance
  prioritizeChunks(chunks) {
    const productKeywords = [
      'product', 'bottle', 'jar', 'cap', 'container', 'packaging',
      'specification', 'price', 'cost', 'material', 'dimension'
    ];
    
    return chunks.map(chunk => {
      const lowerChunk = chunk.toLowerCase();
      const keywordCount = productKeywords.reduce((count, keyword) => {
        return count + (lowerChunk.split(keyword).length - 1);
      }, 0);
      
      return { chunk, relevance: keywordCount };
    })
    .sort((a, b) => b.relevance - a.relevance)
    .map(item => item.chunk);
  }

  // Smart text summarization for large documents
  summarizeForContext(text, maxLength = 2000) {
    if (text.length <= maxLength) {
      return text;
    }
    
    const lines = text.split('\n');
    const summary = [];
    let currentLength = 0;
    
    // Take first few lines for context
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (currentLength + lines[i].length < maxLength / 2) {
        summary.push(lines[i]);
        currentLength += lines[i].length;
      }
    }
    
    // Find product-related lines from the rest
    const productLines = [];
    for (let i = 5; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('product') || line.includes('bottle') || 
          line.includes('jar') || line.includes('price') ||
          line.includes('specification') || line.includes('material')) {
        productLines.push(lines[i]);
      }
    }
    
    // Add most relevant product lines
    for (const line of productLines) {
      if (currentLength + line.length < maxLength) {
        summary.push(line);
        currentLength += line.length;
      } else {
        break;
      }
    }
    
    return summary.join('\n');
  }
}

// AI Service for processing product data
class AIService {
  constructor() {
    this.textOptimizer = new TextOptimizer();
    
    // You can configure multiple AI providers here
    this.providers = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o'
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'llama-3.1-70b-versatile'
      }
    };
    
    // Use the first available provider
    this.currentProvider = this.providers.groq.apiKey ? 'groq' : 
                          this.providers.openai.apiKey ? 'openai' : null;
  }

  async processWithAI(extractedText, fileName) {
    if (!this.currentProvider) {
      throw new Error('No AI provider configured. Please set OPENAI_API_KEY or GROQ_API_KEY in environment variables.');
    }

    const provider = this.providers[this.currentProvider];
    
    // Optimize the extracted text
    const optimizedText = this.textOptimizer.optimizeText(extractedText, fileName);
    
    // Check if text needs chunking
    const chunks = this.textOptimizer.chunkText(optimizedText, this.currentProvider);
    
    if (chunks.length === 1) {
      // Single chunk - process normally
      return this.processSingleChunk(chunks[0], fileName, provider);
    } else {
      // Multiple chunks - process each and combine results
      return this.processMultipleChunks(chunks, fileName, provider);
    }
  }

  async processSingleChunk(text, fileName, provider) {
    const prompt = this.buildProductExtractionPrompt(text, fileName);
    
    try {
      console.log(`Using AI provider: ${this.currentProvider}`);
      console.log(`Sending prompt to ${provider.baseURL} with model ${provider.model}`);
      console.log(`Prompt length: ${prompt.length} characters`);
      
      const response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        {
          model: provider.model,
          messages: [
            {
              role: "system",
              content: "You are an AI assistant specialized in extracting product information from various file formats for Berlin Packaging's sales team. You understand packaging industry terminology and can structure product data according to database schemas."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      console.log('AI response received:', aiResponse);
      
      return this.parseAndValidateResponse(aiResponse);
      
    } catch (error) {
      console.error('AI API Error:', error.response?.data || error.message);
      throw new Error(`AI processing failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async processMultipleChunks(chunks, fileName, provider) {
    console.log(`Processing ${chunks.length} chunks for ${fileName}`);
    
    const allProducts = [];
    let processingNotes = [];
    
    // Prioritize chunks by relevance
    const prioritizedChunks = this.textOptimizer.prioritizeChunks(chunks);
    
    for (let i = 0; i < prioritizedChunks.length; i++) {
      const chunk = prioritizedChunks[i];
      console.log(`Processing chunk ${i + 1}/${prioritizedChunks.length}`);
      
      try {
        const chunkPrompt = this.buildChunkExtractionPrompt(chunk, fileName, i + 1, prioritizedChunks.length);
        
        const response = await axios.post(
          `${provider.baseURL}/chat/completions`,
          {
            model: provider.model,
            messages: [
              {
                role: "system",
                content: "You are an AI assistant specialized in extracting product information from document chunks for Berlin Packaging's sales team. Focus on finding actual product information and avoid duplicates."
              },
              {
                role: "user",
                content: chunkPrompt
              }
            ],
            temperature: 0.1,
            max_tokens: 4000
          },
          {
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const aiResponse = response.data.choices[0].message.content;
        const chunkResult = this.parseAndValidateResponse(aiResponse);
        
        if (chunkResult.products && chunkResult.products.length > 0) {
          allProducts.push(...chunkResult.products);
          console.log(`Found ${chunkResult.products.length} products in chunk ${i + 1}`);
        }
        
        if (chunkResult.summary?.processingNotes) {
          processingNotes.push(`Chunk ${i + 1}: ${chunkResult.summary.processingNotes}`);
        }
        
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error.message);
        processingNotes.push(`Chunk ${i + 1}: Processing failed - ${error.message}`);
      }
    }
    
    // Remove duplicates and combine results
    const uniqueProducts = this.removeDuplicateProducts(allProducts);
    
    return {
      products: uniqueProducts,
      summary: {
        totalProducts: uniqueProducts.length,
        categories: [...new Set(uniqueProducts.map(p => p.category))],
        processingNotes: `Processed ${chunks.length} chunks. ${processingNotes.join('; ')}`
      }
    };
  }

  removeDuplicateProducts(products) {
    const seen = new Map();
    const unique = [];
    
    for (const product of products) {
      const key = `${product.name?.toLowerCase()}-${product.category?.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        unique.push(product);
      }
    }
    
    console.log(`Removed ${products.length - unique.length} duplicate products`);
    return unique;
  }

  buildChunkExtractionPrompt(chunkText, fileName, chunkNumber, totalChunks) {
    return `You are processing chunk ${chunkNumber} of ${totalChunks} from file "${fileName}" for Berlin Packaging's product database.

CHUNK TEXT:
${chunkText}

INSTRUCTIONS:
1. Extract ONLY actual product information from this chunk
2. Ignore instructional text, headers, metadata, or navigation elements
3. Focus on physical products: bottles, jars, caps, containers, packaging materials
4. Calculate eco scores based on sustainability features
5. Map products to appropriate category-specific and common filters
6. If no products are found in this chunk, return empty products array
7. Avoid duplicating products that might appear in other chunks
8. Extract images url if available and add into images
REQUIRED OUTPUT FORMAT (JSON ONLY):
{
  "products": [
    {
      "name": "Product Name",
      "description": "Product description",
      "category": "Category",
      "broaderCategory": "Broader Category",
      "specifications": {
        "material": "Material",
        "capacity": {"value": 0, "unit": "ml"},
        "dimensions": {"height": 0, "width": 0, "depth": 0, "unit": "mm"},
        "weight": {"value": 0, "unit": "g"},
        "minimumOrderQuantity": 1000,
        "availableQuantity": 5000
      },
      "pricing": {
        "basePrice": 0,
        "currency": "USD",
        "priceBreaks": []
      },
      "ecoScore": 0,
      "ecoScoreDetails": {
        "recyclability": 0,
        "carbonFootprint": 0,
        "sustainableMaterials": 0,
        "localSourcing": 0
      },
      "sustainability": {
        "recycledContent": 0,
        "biodegradable": false,
        "compostable": false,
        "refillable": false,
        "sustainableSourcing": false,
        "carbonNeutral": false
      },
      "categoryFilters": [
        {
          "Category_Specific_Filter": ["Value1", "Value2"]
        }
      ],
      "commonFilters": [
        {
          "Sustainability": ["Recycle Ready", "Recycled Content"],
          "Material": ["HDPE", "PP"],
          "Size": ["Unit: ml", "Min: 20", "Max: 50"],
          "Minimum Order": ["Min: 500", "Max: 50000"],
          "Location": ["USA"],
          "Color": ["Clear", "Amber"],
          "End Use": ["Hand Cream", "Body Wash"]
        }
      ],
      "features": [],
      "certifications": [],
      "customization": {
        "printingAvailable": false,
        "labelingAvailable": false,
        "colorOptions": [],
        "printingMethods": [],
        "customSizes": false
      }
    }
  ],
  "summary": {
    "totalProducts": 0,
    "categories": [],
    "processingNotes": "What was found in this chunk"
  }
}

ECO SCORE CALCULATION:
- Recyclability: 100 for mono-material, 80 for recyclable plastics, 60 for glass, 40 for mixed materials
- Carbon Footprint: 100 for local sourcing, 80 for regional, 60 for international
- Sustainable Materials: 100 for 100% recycled content, 80 for 50%+, 60 for sustainable sourcing
- Local Sourcing: 100 for local, 80 for regional, 60 for national, 40 for international
- Overall ecoScore = average of all four components

CATEGORY FILTERS:
- Tube: {"Tube Shape": ["Round", "Oval"], "Tube Type": ["Monomaterial", "Laminated"]}
- Bottle: {"Bottle Shape": ["Round", "Square"], "Bottle Type": ["Standard", "Wide Mouth"]}
- Other Closure: {"Other Closure Type": ["Pump", "Spray", "Dropper"]}`;
  }

  buildProductExtractionPrompt(extractedText, fileName) {
    return `You are processing a file named "${fileName}" for Berlin Packaging's product database. 

Extract product information from the following optimized text and structure it according to the Berlin Packaging database schema.

EXTRACTED TEXT:
${extractedText}

CRITICAL INSTRUCTIONS:
1. If the text contains NO actual product information, return an empty products array
2. Only extract information about actual physical products (bottles, jars, caps, etc.)
3. Ignore instructional text, headers, metadata, or placeholder content
4. Focus on packaging industry terminology and specifications
5. Calculate eco scores based on sustainability features
6. Map products to appropriate category-specific and common filters
7. If information is missing, use reasonable defaults

REQUIRED OUTPUT FORMAT (JSON ONLY - NO OTHER TEXT):
{
  "products": [
    {
      "name": "Product Name",
      "description": "Detailed product description",
      "category": "Primary category (e.g., Bottle, Jar, Tube, Cap, Other Closure, etc.)",
      "broaderCategory": "Broader category (e.g., Base Packaging, Closure, etc.)",
      "specifications": {
        "material": "Material type (e.g., HDPE, Glass, Aluminum, PP, etc.)",
        "capacity": {
          "value": numeric_value,
          "unit": "ml/oz/l/etc"
        },
        "dimensions": {
          "height": numeric_value,
          "width": numeric_value,
          "depth": numeric_value,
          "unit": "mm/cm/in"
        },
        "weight": {
          "value": numeric_value,
          "unit": "g/kg/oz"
        },
        "minimumOrderQuantity": numeric_value,
        "availableQuantity": numeric_value
      },
      "pricing": {
        "basePrice": numeric_value,
        "currency": "USD",
        "priceBreaks": []
      },
      "ecoScore": numeric_value_0_to_100,
      "ecoScoreDetails": {
        "recyclability": numeric_value_0_to_100,
        "carbonFootprint": numeric_value_0_to_100,
        "sustainableMaterials": numeric_value_0_to_100,
        "localSourcing": numeric_value_0_to_100
      },
      "sustainability": {
        "recycledContent": numeric_percentage_0_to_100,
        "biodegradable": boolean,
        "compostable": boolean,
        "refillable": boolean,
        "sustainableSourcing": boolean,
        "carbonNeutral": boolean
      },
      "categoryFilters": [
        {
          "Category_Specific_Filter_Name": ["Value1", "Value2"]
        }
      ],
      "commonFilters": [
        {
          "Sustainability": ["Recycle Ready", "Recycled Content", etc.],
          "Material": ["HDPE", "PP", "Glass", etc.],
          "Size": ["Unit: ml", "Min: 20", "Max: 50"],
          "Minimum Order": ["Min: 500", "Max: 50000"],
          "Location": ["USA", "Europe", etc.],
          "Color": ["Blue", "Green", "Clear", etc.],
          "End Use": ["Hand Cream", "Body Wash", "Shampoo", etc.]
        }
      ],
      "features": [
        "Feature 1",
        "Feature 2"
      ],
      "certifications": [],
      "customization": {
        "printingAvailable": boolean,
        "labelingAvailable": boolean,
        "colorOptions": [],
        "printingMethods": [],
        "customSizes": boolean
      }
    }
  ],
  "summary": {
    "totalProducts": number,
    "categories": ["category1", "category2"],
    "processingNotes": "Description of what was found or processing notes"
  }
}

CATEGORY-SPECIFIC FILTERS GUIDE:
- Tube: {"Tube Shape": ["Round", "Oval", "Square"], "Tube Type": ["Monomaterial", "Laminated", "Barrier"]}
- Bottle: {"Bottle Shape": ["Round", "Square", "Oval"], "Bottle Type": ["Standard", "Wide Mouth", "Narrow Neck"]}
- Jar: {"Jar Shape": ["Round", "Square", "Oval"], "Jar Type": ["Standard", "Wide Mouth", "Straight Sided"]}
- Cap: {"Cap Type": ["Screw Cap", "Snap Cap", "Flip Top"], "Cap Size": ["18mm", "20mm", "24mm", "28mm"]}
- Other Closure: {"Other Closure Type": ["Pump", "Spray", "Dropper", "Dispenser"]}

COMMON FILTERS GUIDE:
- Sustainability: ["Recycle Ready", "Recycled Content", "Biodegradable", "Compostable", "Carbon Neutral"]
- Material: ["HDPE", "PP", "Glass", "Aluminum", "PET", "PETG", "Acrylic"]
- Size: Use format ["Unit: ml", "Min: 20", "Max: 50"] for capacity ranges
- Minimum Order: Use format ["Min: 500", "Max: 50000"] for order quantities
- Location: ["USA", "Europe", "Asia", "Canada", "Mexico"]
- Color: ["Clear", "Amber", "Blue", "Green", "White", "Black", "Natural"]
- End Use: ["Hand Cream", "Body Wash", "Shampoo", "Hair Oil", "Body Lotion", "Face Cream", "Perfume"]

ECO SCORE CALCULATION:
- Calculate overall ecoScore (0-100) based on:
  * Recyclability (0-100): 100 for mono-material, 80 for recyclable plastics, 60 for glass, 40 for mixed materials
  * Carbon Footprint (0-100): 100 for local sourcing, 80 for regional, 60 for international, lower for heavy materials
  * Sustainable Materials (0-100): 100 for 100% recycled content, 80 for 50%+, 60 for sustainable sourcing, 40 for virgin materials
  * Local Sourcing (0-100): 100 for local, 80 for regional, 60 for national, 40 for international
- Overall ecoScore = average of all four components

IMPORTANT: 
- If NO actual products are found, return: {"products": [], "summary": {"totalProducts": 0, "categories": [], "processingNotes": "No product information found"}}
- Only return valid JSON, no explanatory text before or after
- Ensure all numeric values are properly formatted numbers, not strings
- Calculate realistic eco scores based on material and sustainability features
- Map products to appropriate category and common filters based on their characteristics`;
  }

  parseAndValidateResponse(aiResponse) {
    try {
      console.log('AI response length:', aiResponse.length);
      
      // Handle cases where AI indicates no product information found
      if (aiResponse.toLowerCase().includes("sorry") || 
          aiResponse.toLowerCase().includes("unable to extract") ||
          aiResponse.toLowerCase().includes("no actual product information")) {
        
        console.log('AI indicated no product information found');
        return {
          products: [],
          summary: {
            totalProducts: 0,
            categories: [],
            processingNotes: "No product information found in the provided text."
          }
        };
      }
      
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in response, creating fallback');
        return {
          products: [],
          summary: {
            totalProducts: 0,
            categories: [],
            processingNotes: "AI response did not contain valid JSON format."
          }
        };
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Validate the structure
      if (!parsedResponse.products || !Array.isArray(parsedResponse.products)) {
        throw new Error('Invalid response structure: missing products array');
      }

      console.log(`Validating ${parsedResponse.products.length} products...`);
      
      // Validate and clean each product
      parsedResponse.products.forEach((product, index) => {
        if (!product.name || typeof product.name !== 'string') {
          throw new Error(`Product ${index + 1}: missing or invalid name`);
        }

        if (!product.category || typeof product.category !== 'string') {
          throw new Error(`Product ${index + 1}: missing or invalid category`);
        }

        // Ensure required nested objects exist with defaults
        if (!product.specifications) {
          product.specifications = {};
        }
        if (!product.pricing) {
          product.pricing = { basePrice: 0, currency: 'USD' };
        }
        if (!product.features) {
          product.features = [];
        }
        if (!product.certifications) {
          product.certifications = [];
        }
        if (!product.sustainability) {
          product.sustainability = {
            recycledContent: 0,
            biodegradable: false,
            compostable: false,
            refillable: false,
            sustainableSourcing: false,
            carbonNeutral: false
          };
        }
        if (!product.categoryFilters) {
          product.categoryFilters = [];
        }
        if (!product.commonFilters) {
          product.commonFilters = [];
        }
        if (!product.customization) {
          product.customization = {
            printingAvailable: false,
            labelingAvailable: false,
            colorOptions: [],
            printingMethods: [],
            customSizes: false
          };
        }

        // Set defaults for missing specifications
        if (!product.specifications.minimumOrderQuantity) {
          product.specifications.minimumOrderQuantity = 1000;
        }
        if (!product.specifications.availableQuantity) {
          product.specifications.availableQuantity = 5000;
        }
        if (!product.specifications.material) {
          product.specifications.material = 'Not specified';
        }
        if (!product.specifications.weight) {
          product.specifications.weight = { value: 0, unit: 'g' };
        }

        // Validate and set broader category
        if (!product.broaderCategory) {
          product.broaderCategory = this.mapToBroaderCategory(product.category);
        }

        // Ensure eco score exists
        if (!product.ecoScore) {
          product.ecoScore = this.calculateEcoScore(product);
        }

        // Ensure eco score details exist
        if (!product.ecoScoreDetails) {
          product.ecoScoreDetails = this.calculateEcoScoreDetails(product);
        }

        // Ensure filters are properly formatted
        if (!product.categoryFilters || product.categoryFilters.length === 0) {
          product.categoryFilters = this.generateCategoryFilters(product);
        }

        if (!product.commonFilters || product.commonFilters.length === 0) {
          product.commonFilters = this.generateCommonFilters(product);
        }
      });

      return parsedResponse;

    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  calculateEcoScore(product) {
    const details = this.calculateEcoScoreDetails(product);
    return Math.round((details.recyclability + details.carbonFootprint + details.sustainableMaterials + details.localSourcing) / 4);
  }

  calculateEcoScoreDetails(product) {
    const material = product.specifications?.material?.toLowerCase() || '';
    const sustainability = product.sustainability || {};
    
    // Recyclability score
    let recyclability = 40; // default
    if (material.includes('mono') || material.includes('pp') || material.includes('hdpe')) {
      recyclability = 100;
    } else if (material.includes('pet') || material.includes('plastic')) {
      recyclability = 80;
    } else if (material.includes('glass')) {
      recyclability = 60;
    }

    // Carbon footprint score (assume regional sourcing as default)
    let carbonFootprint = 60;
    if (sustainability.carbonNeutral) {
      carbonFootprint = 100;
    } else if (sustainability.sustainableSourcing) {
      carbonFootprint = 80;
    }

    // Sustainable materials score
    let sustainableMaterials = 40;
    const recycledContent = sustainability.recycledContent || 0;
    if (recycledContent >= 100) {
      sustainableMaterials = 100;
    } else if (recycledContent >= 50) {
      sustainableMaterials = 80;
    } else if (sustainability.sustainableSourcing) {
      sustainableMaterials = 60;
    }

    // Local sourcing score (assume regional as default)
    let localSourcing = 60;
    if (sustainability.sustainableSourcing) {
      localSourcing = 80;
    }

    return {
      recyclability,
      carbonFootprint,
      sustainableMaterials,
      localSourcing
    };
  }

  generateCategoryFilters(product) {
    const category = product.category?.toLowerCase() || '';
    const material = product.specifications?.material?.toLowerCase() || '';
    
    const filters = {};
    
    if (category.includes('tube')) {
      filters['Tube Shape'] = ['Round'];
      if (material.includes('mono') || material.includes('pp') || material.includes('hdpe')) {
        filters['Tube Type'] = ['Monomaterial'];
      } else {
        filters['Tube Type'] = ['Laminated'];
      }
    } else if (category.includes('bottle')) {
      filters['Bottle Shape'] = ['Round'];
      filters['Bottle Type'] = ['Standard'];
    } else if (category.includes('jar')) {
      filters['Jar Shape'] = ['Round'];
      filters['Jar Type'] = ['Standard'];
    } else if (category.includes('cap')) {
      filters['Cap Type'] = ['Screw Cap'];
      filters['Cap Size'] = ['24mm'];
    } else if (category.includes('closure')) {
      if (product.name?.toLowerCase().includes('pump')) {
        filters['Other Closure Type'] = ['Pump'];
      } else if (product.name?.toLowerCase().includes('spray')) {
        filters['Other Closure Type'] = ['Spray'];
      } else {
        filters['Other Closure Type'] = ['Dispenser'];
      }
    }
    
    return [filters];
  }

  generateCommonFilters(product) {
    const filters = {};
    
    // Sustainability filters
    const sustainability = product.sustainability || {};
    const sustainabilityFilters = [];
    
    if (sustainability.recycledContent > 0) {
      sustainabilityFilters.push('Recycled Content');
    }
    if (sustainability.biodegradable) {
      sustainabilityFilters.push('Biodegradable');
    }
    if (sustainability.compostable) {
      sustainabilityFilters.push('Compostable');
    }
    if (sustainability.carbonNeutral) {
      sustainabilityFilters.push('Carbon Neutral');
    }
    if (product.specifications?.material?.toLowerCase().includes('mono') || 
        product.specifications?.material?.toLowerCase().includes('pp') || 
        product.specifications?.material?.toLowerCase().includes('hdpe')) {
      sustainabilityFilters.push('Recycle Ready');
    }
    
    filters['Sustainability'] = sustainabilityFilters;
    
    // Material filters
    const material = product.specifications?.material || 'Not specified';
    filters['Material'] = [material];
    
    // Size filters
    const capacity = product.specifications?.capacity;
    if (capacity && capacity.value > 0) {
      filters['Size'] = [
        `Unit: ${capacity.unit || 'ml'}`,
        `Min: ${Math.max(1, capacity.value - 10)}`,
        `Max: ${capacity.value + 10}`
      ];
    }
    
    // Minimum order filters
    const moq = product.specifications?.minimumOrderQuantity || 1000;
    filters['Minimum Order'] = [
      `Min: ${Math.max(500, moq - 500)}`,
      `Max: ${moq + 10000}`
    ];
    
    // Location (default to USA)
    filters['Location'] = ['USA'];
    
    // Color (default to Clear)
    filters['Color'] = ['Clear'];
    
    // End use (based on product type)
    const category = product.category?.toLowerCase() || '';
    const endUse = [];
    if (category.includes('tube') || category.includes('bottle')) {
      endUse.push('Hand Cream', 'Body Wash');
    } else if (category.includes('pump') || category.includes('closure')) {
      endUse.push('Body Lotion', 'Shampoo');
    } else {
      endUse.push('General Use');
    }
    filters['End Use'] = endUse;
    
    return [filters];
  }

  mapToBroaderCategory(category) {
    const categoryMapping = {
      'Bottle': 'Base Packaging',
      'Jar': 'Base Packaging',
      'Tube': 'Base Packaging',
      'Cap': 'Closure',
      'Closure': 'Closure',
      'Other Closure': 'Closure',
      'Pump': 'Closure',
      'Spray': 'Closure',
      'Dropper': 'Closure',
      'Dispenser': 'Closure',
      'Makeup': 'Beauty',
      'Cosmetics': 'Beauty',
      'Nail Care': 'Beauty',
      'Skin Care': 'Personal Care',
      'Hair Care': 'Personal Care',
      'Face Cream': 'Personal Care',
      'Fragrance': 'Personal Care',
      'Laundry Detergent': 'Household',
      'Surface Cleaners': 'Household',
      'Dish Soap': 'Household'
    };

    return categoryMapping[category] || 'Base Packaging';
  }

  // Rest of the methods remain the same...
  async analyzeProductSimilarity(productData, existingProducts) {
    if (!existingProducts || existingProducts.length === 0) {
      return [];
    }

    const similarities = [];

    for (const existingProduct of existingProducts) {
      const similarity = this.calculateSimilarity(productData, existingProduct);
      if (similarity > 0.3) {
        similarities.push({
          id: existingProduct._id,
          name: existingProduct.name,
          similarity: similarity
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  calculateSimilarity(product1, product2) {
    let score = 0;
    let factors = 0;

    if (product1.name && product2.name) {
      const nameScore = this.stringSimilarity(product1.name.toLowerCase(), product2.name.toLowerCase());
      score += nameScore * 0.4;
      factors += 0.4;
    }

    if (product1.category === product2.category) {
      score += 0.3;
    }
    factors += 0.3;

    if (product1.specifications?.material && product2.specifications?.material) {
      if (product1.specifications.material.toLowerCase() === product2.specifications.material.toLowerCase()) {
        score += 0.2;
      }
    }
    factors += 0.2;

    if (product1.specifications?.capacity && product2.specifications?.capacity) {
      const capacity1 = product1.specifications.capacity.value || 0;
      const capacity2 = product2.specifications.capacity.value || 0;
      
      if (capacity1 > 0 && capacity2 > 0) {
        const diff = Math.abs(capacity1 - capacity2);
        const max = Math.max(capacity1, capacity2);
        const capacityScore = 1 - (diff / max);
        score += capacityScore * 0.1;
      }
    }
    factors += 0.1;

    return factors > 0 ? score / factors : 0;
  }

  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
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
}

// Create and export singleton instance
const aiService = new AIService();

module.exports = {
  processWithAI: (extractedText, fileName) => aiService.processWithAI(extractedText, fileName),
  analyzeProductSimilarity: (productData, existingProducts) => aiService.analyzeProductSimilarity(productData, existingProducts)
};

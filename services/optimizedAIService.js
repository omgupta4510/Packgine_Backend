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
4. If no products are found in this chunk, return empty products array
5. Avoid duplicating products that might appear in other chunks

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
        "color": "Color",
        "minimumOrderQuantity": 1000
      },
      "pricing": {
        "basePrice": 0,
        "currency": "USD"
      },
      "features": [],
      "certifications": [],
      "sustainability": {},
      "images": []
    }
  ],
  "summary": {
    "totalProducts": 0,
    "categories": [],
    "processingNotes": "What was found in this chunk"
  }
}`;
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
5. If information is missing, use reasonable defaults

REQUIRED OUTPUT FORMAT (JSON ONLY - NO OTHER TEXT):
{
  "products": [
    {
      "name": "Product Name",
      "description": "Detailed product description",
      "category": "Primary category (e.g., Bottle, Jar, Tube, Cap, etc.)",
      "broaderCategory": "Broader category (e.g., Primary Packaging, Beauty, Personal Care, etc.)",
      "subcategory": "Specific subcategory if applicable",
      "specifications": {
        "material": "Material type (e.g., HDPE, Glass, Aluminum, etc.)",
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
        "color": "Color description",
        "finish": "Surface finish (e.g., Glossy, Matte, etc.)",
        "minimumOrderQuantity": numeric_value,
        "closure": "Closure type if applicable",
        "additionalSpecs": "Any other relevant specifications"
      },
      "pricing": {
        "basePrice": numeric_value,
        "currency": "USD/EUR/etc",
        "priceBreaks": [
          {
            "minQuantity": numeric_value,
            "price": numeric_value
          }
        ]
      },
      "features": [
        "Feature 1",
        "Feature 2"
      ],
      "certifications": [
        "ISO 9001",
        "FDA Approved",
        "etc."
      ],
      "sustainability": {
        "recycledContent": percentage_if_available,
        "biodegradable": boolean_if_known,
        "compostable": boolean_if_known,
        "refillable": boolean_if_known
      },
      "images": [
        "Image URLs or descriptions if mentioned"
      ]
    }
  ],
  "summary": {
    "totalProducts": number,
    "categories": ["category1", "category2"],
    "processingNotes": "Description of what was found or processing notes"
  }
}

IMPORTANT: 
- If NO actual products are found, return: {"products": [], "summary": {"totalProducts": 0, "categories": [], "processingNotes": "No product information found"}}
- Only return valid JSON, no explanatory text before or after
- Ensure all numeric values are properly formatted numbers, not strings`;
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
        if (!product.images) {
          product.images = [];
        }

        // Set defaults for missing specifications
        if (!product.specifications.minimumOrderQuantity) {
          product.specifications.minimumOrderQuantity = 1000;
        }
        if (!product.specifications.material) {
          product.specifications.material = '';
        }

        // Validate and set broader category
        if (!product.broaderCategory) {
          product.broaderCategory = this.mapToBroaderCategory(product.category);
        }
      });

      return parsedResponse;

    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  mapToBroaderCategory(category) {
    const categoryMapping = {
      'Bottle': 'Primary Packaging',
      'Jar': 'Primary Packaging',
      'Tube': 'Primary Packaging',
      'Cap': 'Primary Packaging',
      'Closure': 'Primary Packaging',
      'Dropper': 'Primary Packaging',
      'Dispenser': 'Primary Packaging',
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

    return categoryMapping[category] || 'Primary Packaging';
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

// AI and Text Processing Configuration
module.exports = {
  // Token limits for different providers (with safety margins)
  tokenLimits: {
    openai: {
      'gpt-4o': 120000,        // 128k context with safety margin
      'gpt-4': 7000,           // 8k context with safety margin
      'gpt-3.5-turbo': 15000   // 16k context with safety margin
    },
    groq: {
      'llama-3.1-70b-versatile': 7000,  // 8k context with safety margin
      'llama-3.1-8b-instant': 7000,     // 8k context with safety margin
      'mixtral-8x7b-32768': 30000       // 32k context with safety margin
    },
    anthropic: {
      'claude-3-opus': 190000,     // 200k context with safety margin
      'claude-3-sonnet': 190000,   // 200k context with safety margin
      'claude-3-haiku': 190000     // 200k context with safety margin
    }
  },

  // Text optimization settings
  textOptimization: {
    // Maximum characters to process before chunking
    maxTextLength: 50000,
    
    // Keywords that indicate product-related content
    productKeywords: [
      'product', 'bottle', 'jar', 'cap', 'container', 'packaging',
      'ml', 'oz', 'liter', 'gallon', 'gram', 'kg', 'pound',
      'material', 'plastic', 'glass', 'aluminum', 'steel', 'HDPE', 'PET',
      'price', 'cost', '$', '€', '£', 'USD', 'EUR', 'pricing',
      'specification', 'dimension', 'size', 'height', 'width', 'depth',
      'minimum order', 'MOQ', 'quantity', 'wholesale', 'bulk',
      'certification', 'FDA', 'ISO', 'compliant', 'approved',
      'color', 'transparent', 'opaque', 'clear', 'amber', 'blue',
      'closure', 'screw', 'snap', 'pump', 'spray', 'dropper',
      'finish', 'glossy', 'matte', 'smooth', 'textured'
    ],
    
    // Patterns to remove from text (noise reduction)
    noisePatterns: [
      /\[.*?\]/g,           // Remove bracketed content
      /\(\s*\)/g,           // Remove empty parentheses
      /\{\s*\}/g,           // Remove empty braces
      /\|+/g,               // Multiple pipes
      /\-{3,}/g,            // Multiple dashes
      /\={3,}/g,            // Multiple equals
      /&nbsp;/g,            // HTML entities
      /&[a-zA-Z0-9#]+;/g,   // Other HTML entities
      /\.{3,}/g,            // Multiple dots
      /\s{3,}/g,            // Multiple spaces
      /\n\s*\n/g,           // Multiple newlines
      /Page \d+/gi,         // Page numbers
      /^Table of Contents/gmi, // TOC headers
      /^Index$/gmi,         // Index headers
      /^References$/gmi,    // Reference headers
      /^Appendix/gmi        // Appendix headers
    ],
    
    // Context lines to include around product keywords
    contextLines: 2,
    
    // Minimum line length to consider (filter out very short lines)
    minLineLength: 10,
    
    // Maximum lines per chunk
    maxLinesPerChunk: 200
  },

  // File processing settings
  fileProcessing: {
    // Maximum file size for processing (50MB)
    maxFileSize: 50 * 1024 * 1024,
    
    // Text extraction settings
    pdf: {
      // Maximum pages to process
      maxPages: 100,
      // Skip pages that are likely covers/TOC
      skipPages: ['cover', 'table of contents', 'index']
    },
    
    excel: {
      // Maximum rows per sheet
      maxRows: 10000,
      // Maximum sheets to process
      maxSheets: 10,
      // Skip empty cells
      skipEmptyCells: true
    },
    
    powerpoint: {
      // Maximum slides to process
      maxSlides: 200,
      // Include notes slides
      includeNotes: true,
      // Skip template slides
      skipTemplates: true
    }
  },

  // AI provider settings
  aiSettings: {
    // Default provider preference order
    providerPriority: ['openai', 'groq', 'anthropic'],
    
    // Model selection based on task complexity
    modelSelection: {
      simple: {
        openai: 'gpt-3.5-turbo',
        groq: 'llama-3.1-8b-instant'
      },
      complex: {
        openai: 'gpt-4o',
        groq: 'llama-3.1-70b-versatile'
      }
    },
    
    // Request settings
    temperature: 0.1,
    maxTokens: 4000,
    
    // Retry settings
    maxRetries: 3,
    retryDelay: 1000,
    
    // Rate limiting
    requestsPerMinute: 60,
    requestsPerHour: 3000
  },

  // Quality control settings
  qualityControl: {
    // Minimum confidence score for extracted products
    minConfidenceScore: 0.7,
    
    // Required fields for product validation
    requiredFields: ['name', 'category'],
    
    // Duplicate detection settings
    duplicateThreshold: 0.8,
    
    // Maximum products per file
    maxProductsPerFile: 1000,
    
    // Validation rules
    validation: {
      name: {
        minLength: 3,
        maxLength: 200,
        forbiddenWords: ['test', 'example', 'sample']
      },
      price: {
        min: 0,
        max: 10000,
        currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
      },
      quantity: {
        min: 1,
        max: 1000000
      }
    }
  },

  // Logging and monitoring
  logging: {
    // Log levels: error, warn, info, debug
    level: 'info',
    
    // Log file settings
    file: {
      enabled: true,
      path: './logs/ai-processing.log',
      maxSize: '10MB',
      maxFiles: 5
    },
    
    // Performance monitoring
    performance: {
      enabled: true,
      trackTokenUsage: true,
      trackProcessingTime: true,
      trackSuccessRate: true
    }
  }
};

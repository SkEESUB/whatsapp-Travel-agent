// Gemini AI Service - Centralized Google Gemini API integration
// Replaces OpenAI with Google Generative AI
// Uses axios for HTTP requests

const axios = require('axios');

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Generate AI response using Google Gemini
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string>} - Text response or fallback message
 */
async function generateAIResponse(prompt) {
  try {
   console.log('🤖 [Gemini] Starting request...');
    
    // Validate API key exists
   if (!GEMINI_API_KEY) {
     console.error('❌ [Gemini] GEMINI_API_KEY is not set in environment variables');
     return '⚠️ Travel information temporarily unavailable. Please try again later.';
    }

    // Prepare request payload
   const requestBody = {
     contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    };

    // Make API request
   const response = await axios.post(
      GEMINI_API_URL,
     requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          key: GEMINI_API_KEY
        }
      }
    );

   console.log('✅ [Gemini] Response received successfully');

    // Extract text from response
   const candidates = response.data?.candidates;
    
   if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
     console.warn('⚠️ [Gemini] No candidates in response');
     return '⚠️ Travel information temporarily unavailable. Please try again later.';
    }

   const content = candidates[0]?.content;
    
   if (!content || !content.parts || !Array.isArray(content.parts)) {
     console.warn('⚠️ [Gemini] Invalid content structure in response');
     return '⚠️ Travel information temporarily unavailable. Please try again later.';
    }

   const text = content.parts.map(part => part.text).join('');
    
   if (!text || text.trim() === '') {
     console.warn('⚠️ [Gemini] Empty text in response');
     return '⚠️ Travel information temporarily unavailable. Please try again later.';
    }

   console.log('✨ [Gemini] Text extracted successfully');
   return text.trim();

  } catch (error) {
    // Comprehensive error handling
   console.error('❌ [Gemini] Error occurred:', {
     message: error.message,
      status: error.response?.status,
      data: error.response?.data,
     code: error.code
    });

    // Specific error messages for debugging
   if (error.response?.status === 400) {
     console.error('❌ [Gemini] Bad Request - Invalid prompt or parameters');
    } else if (error.response?.status === 403) {
     console.error('❌ [Gemini] Forbidden - Check API key permissions');
    } else if (error.response?.status === 429) {
     console.error('❌ [Gemini] Rate Limit Exceeded - Too many requests');
    } else if (error.response?.status === 500) {
     console.error('❌ [Gemini] Internal Server Error - Google API issue');
    } else if (error.code === 'ECONNABORTED') {
     console.error('❌ [Gemini] Request Timeout - Network issue');
    } else if (error.code === 'ENOTFOUND') {
     console.error('❌ [Gemini] DNS Error - Cannot resolve API endpoint');
    }

    // Always return safe fallback message
   return '⚠️ Travel information temporarily unavailable. Please try again later.';
  }
}

/**
 * Test Gemini API connection
 * @returns {Promise<boolean>} - True if API is accessible
 */
async function testConnection() {
  try {
   console.log('🔍 [Gemini] Testing connection...');
    
   const testPrompt = 'Hello';
   const result = await generateAIResponse(testPrompt);
    
   if (result.includes('⚠️')) {
     console.error('❌ [Gemini] Connection test failed');
     return false;
    }

   console.log('✅ [Gemini] Connection test successful');
   return true;

  } catch (error) {
   console.error('❌ [Gemini] Connection test error:', error.message);
   return false;
  }
}

/**
 * Initialize and validate Gemini service
 * Logs startup information
 */
function initialize() {
  console.log('🚀 [Gemini] Initializing service...');
  console.log(`📋 [Gemini] Model: ${GEMINI_MODEL}`);
  
  if (!GEMINI_API_KEY) {
   console.error('❌ [Gemini] CRITICAL: GEMINI_API_KEY not found in environment variables');
   console.error('❌ [Gemini] Please add GEMINI_API_KEY to your .env file');
   return false;
  }

  // Mask API key for security
  const maskedKey = GEMINI_API_KEY.substring(0, 8) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length -4);
  console.log(`✅ [Gemini] API Key configured: ${maskedKey}`);
  console.log(`✅ [Gemini] API URL: ${GEMINI_API_URL}`);
  console.log('✅ [Gemini] Service initialized successfully');
  
  return true;
}

// Export all functions
module.exports = {
  generateAIResponse,
  testConnection,
  initialize
};

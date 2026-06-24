// Image Service - WhatsApp Image Message Processing
// Downloads images and uses Gemini Vision API to identify places

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

// WhatsApp Configuration
const WHATSAPP_CONFIG = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  baseUrl: 'https://graph.facebook.com/v18.0',
};

// Gemini Configuration
let genAI = null;

/**
 * Initialize Gemini AI
 */
function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY not configured');
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Get Gemini Vision model
 */
function getGeminiVisionModel() {
  const ai = initializeGemini();
  if (!ai) throw new Error('Gemini AI not initialized');
  return ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

// Temporary directory for images
const TEMP_DIR = path.join(os.tmpdir(), 'travelbot-images');

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Failed to create temp directory', { error: error.message });
  }
}

/**
 * Download image from WhatsApp Cloud API
 */
async function downloadImage(mediaId) {
  try {
    logger.info('Downloading image from WhatsApp', { mediaId });

    // Step 1: Get media URL
    const urlResponse = await axios.get(
      `${WHATSAPP_CONFIG.baseUrl}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        },
        timeout: 10000,
      }
    );

    const mediaUrl = urlResponse.data.url;

    if (!mediaUrl) {
      throw new Error('Media URL not found');
    }

    // Step 2: Download actual image
    const imageResponse = await axios.get(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
      },
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    logger.info('Image downloaded successfully', {
      mediaId,
      size: imageResponse.data.byteLength,
    });

    return Buffer.from(imageResponse.data);

  } catch (error) {
    logger.error('Failed to download image', {
      error: error.message,
      mediaId,
    });
    throw new Error(`Image download failed: ${error.message}`);
  }
}

/**
 * Detect actual uploaded image mime type based on magic bytes (file signature)
 */
function detectMimeType(buffer) {
  if (!buffer || buffer.length < 12) {
    return 'image/jpeg';
  }

  // JPEG/JPG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }

  // WEBP: RIFF .... WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }

  // HEIC: ftypheic or ftypmsf1 etc. (bytes 4-7 = ftyp, bytes 8-11 = heic, heix, msf1 etc.)
  const ftyp = buffer.toString('ascii', 4, 8);
  const brand = buffer.toString('ascii', 8, 12);
  if (ftyp === 'ftyp' && (brand.startsWith('hei') || brand.startsWith('hev') || brand.startsWith('msf'))) {
    return 'image/heic';
  }

  return 'image/jpeg'; // Default fallback
}

/**
 * Identify place in image using Gemini Vision API
 */
async function identifyPlace(imageBuffer) {
  try {
    const mimeType = detectMimeType(imageBuffer);
    
    logger.info('Identifying place with Gemini Vision', {
      bufferSize: imageBuffer.byteLength,
      mimeType,
    });

    // Convert image to base64
    const imageBase64 = imageBuffer.toString('base64');

    // Get Gemini model
    const model = getGeminiVisionModel();

    // Create prompt for place identification
    const prompt = `You are a travel expert. Look at this image and identify:

1. What place/location is this? (be specific - city, landmark, or region)
2. What country is it in?
3. Is it a tourist destination?

Return ONLY the place name (city or landmark), nothing else. If you can't identify it, return "Unknown location".

Example responses:
- "Goa, India"
- "Taj Mahal, Agra"
- "Manali, Himachal Pradesh"
- "Unknown location"`;

    // Generate content with image
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const identifiedPlace = response.text().trim();

    if (!identifiedPlace || identifiedPlace === 'Unknown location') {
      throw new Error('Could not identify place in image');
    }

    logger.info('Place identified successfully', {
      place: identifiedPlace,
    });

    return {
      success: true,
      place: identifiedPlace,
      confidence: 'high',
    };

  } catch (error) {
    logger.error('Place identification failed', {
      error: error.message,
    });
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

/**
 * Get travel suggestions for identified place
 */
async function getTravelSuggestions(place) {
  try {
    const model = getGeminiVisionModel();

    const prompt = `I see an image of "${place}". As a travel assistant, give me a brief response (max 100 words):

1. Is this a good tourist destination?
2. What is it famous for?
3. Best time to visit?

Keep it conversational and enthusiastic. Use emojis.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text().trim();

  } catch (error) {
    logger.error('Failed to get travel suggestions', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Process image message from WhatsApp
 * Downloads image, identifies place, returns response
 */
async function processImageMessage(phoneNumber, mediaId) {
  try {
    logger.info('Processing image message', {
      phoneNumber,
      mediaId,
    });

    // Step 1: Ensure temp directory exists
    await ensureTempDir();

    // Step 2: Download image
    const imageBuffer = await downloadImage(mediaId);

    // Step 3: Identify place
    const identification = await identifyPlace(imageBuffer);

    // Step 4: Get travel suggestions
    const suggestions = await getTravelSuggestions(identification.place);

    logger.info('Image message processed successfully', {
      phoneNumber,
      identifiedPlace: identification.place,
    });

    return {
      success: true,
      place: identification.place,
      suggestions,
      mediaId,
    };

  } catch (error) {
    logger.error('Image message processing failed', {
      error: error.message,
      phoneNumber,
      mediaId,
    });

    return {
      success: false,
      error: error.message,
      place: null,
      suggestions: null,
    };
  }
}

/**
 * Format image response with place identification
 */
function formatImageResponse(place, suggestions = null) {
  let response = `🏖️ *That looks like ${place}!*\n\n`;

  if (suggestions) {
    response += `${suggestions}\n\n`;
  }

  response += `Want me to plan a trip there? Just tell me:\n`;
  response += `• How many days?\n`;
  response += `• Your budget?\n`;
  response += `• Number of people?`;

  return response;
}

/**
 * Generate image error message
 */
function getImageErrorMessage(error) {
  return `⚠️ *Sorry, I couldn't identify the place in your photo.*\n\nPlease try again or send the destination name as text.\n\nError: ${error}`;
}

module.exports = {
  downloadImage,
  identifyPlace,
  processImageMessage,
  formatImageResponse,
  getImageErrorMessage,
};

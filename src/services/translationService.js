// Translation Service
// Multi-language support using Gemini API with caching

const { GoogleGenerativeAI } = require("@google/generative-ai");
const cacheManager = require('../cache/cacheManager');
const logger = require('../config/logger');

// Supported languages
const SUPPORTED_LANGUAGES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
};

let genAI = null;

/**
 * Initialize Gemini
 */
function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      logger.error('❌ GEMINI_API_KEY not configured');
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Get Gemini model
 */
function getGeminiModel() {
  const ai = initializeGemini();
  if (!ai) throw new Error('Gemini AI not initialized');
  return ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
}

/**
 * Detect language of text
 */
async function detectLanguage(text) {
  try {
    if (!text || typeof text !== 'string') {
      return { language: 'en', confidence: 0 };
    }

    // Quick heuristic detection for common patterns
    const quickDetect = quickLanguageDetection(text);
    if (quickDetect.confidence > 80) {
      return quickDetect;
    }

    // Use Gemini for accurate detection
    const prompt = `Detect the language of this text. Return ONLY the language code.

Text: "${text}"

Supported languages: en, hi, ta, te, kn, ml, bn, mr, gu

Return format: language_code (e.g., "hi" for Hindi)`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const detected = response.text().trim().toLowerCase();

    // Extract language code
    const langMatch = detected.match(/\b(en|hi|ta|te|kn|ml|bn|mr|gu)\b/);
    const language = langMatch ? langMatch[1] : 'en';

    logger.debug('Language detected', {
      text: text.substring(0, 50),
      language,
      confidence: 70,
    });

    return {
      language,
      confidence: 70,
    };

  } catch (error) {
    logger.error('Language detection error', {
      error: error.message,
    });
    return { language: 'en', confidence: 0 };
  }
}

/**
 * Quick language detection using character patterns
 */
function quickLanguageDetection(text) {
  // Hindi (Devanagari script)
  if (/[\u0900-\u097F]/.test(text)) {
    return { language: 'hi', confidence: 95 };
  }

  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return { language: 'ta', confidence: 95 };
  }

  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return { language: 'te', confidence: 95 };
  }

  // Kannada
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return { language: 'kn', confidence: 95 };
  }

  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return { language: 'ml', confidence: 95 };
  }

  // Bengali
  if (/[\u0980-\u09FF]/.test(text)) {
    return { language: 'bn', confidence: 95 };
  }

  // Marathi (also uses Devanagari, but check for common words)
  const marathiWords = ['आहे', 'नाही', 'मला', 'तुला', 'काय', 'कसा'];
  for (const word of marathiWords) {
    if (text.includes(word)) {
      return { language: 'mr', confidence: 85 };
    }
  }

  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(text)) {
    return { language: 'gu', confidence: 95 };
  }

  // Hinglish detection (Hindi words in Latin script)
  const hinglishWords = ['hai', 'nahi', 'mein', 'hum', 'tum', 'karna', 'jana', 'aana', 'dekha', 'accha', 'theek'];
  let hinglishCount = 0;
  const lowerText = text.toLowerCase();
  
  for (const word of hinglishWords) {
    if (lowerText.includes(word)) {
      hinglishCount++;
    }
  }

  if (hinglishCount >= 2) {
    return { language: 'hi', confidence: 75 }; // Hinglish → treat as Hindi
  }

  // Default to English
  return { language: 'en', confidence: 50 };
}

/**
 * Translate text to English (for processing)
 */
async function translateToEnglish(text, sourceLang) {
  try {
    if (!text || sourceLang === 'en') {
      return text;
    }

    // Check cache
    const cacheKey = `translation:${sourceLang}:en:${Buffer.from(text).toString('base64').substring(0, 50)}`;
    const cached = await cacheManager.getFromCache(cacheKey);
    
    if (cached) {
      logger.debug('Translation cache hit', { sourceLang });
      return cached;
    }

    // Translate using Gemini
    const prompt = `Translate this text to English. Keep city names, hotel names, and prices as-is.

Text (${sourceLang}): "${text}"

Return ONLY the translation, nothing else.`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translated = response.text().trim();

    // Cache translation (24 hours)
    await cacheManager.setCache(cacheKey, translated, 86400);

    logger.debug('Text translated to English', {
      sourceLang,
      originalLength: text.length,
      translatedLength: translated.length,
    });

    return translated;

  } catch (error) {
    logger.error('Translation to English error', {
      error: error.message,
      sourceLang,
    });
    // Return original text on error
    return text;
  }
}

/**
 * Translate text from English to target language
 */
async function translateFromEnglish(text, targetLang) {
  try {
    if (!text || targetLang === 'en') {
      return text;
    }

    // Check cache
    const cacheKey = `translation:en:${targetLang}:${Buffer.from(text).toString('base64').substring(0, 50)}`;
    const cached = await cacheManager.getFromCache(cacheKey);
    
    if (cached) {
      logger.debug('Translation cache hit', { targetLang });
      return cached;
    }

    // Translate using Gemini
    const prompt = `Translate this English text to ${SUPPORTED_LANGUAGES[targetLang]}. 

Rules:
- Keep city names in English (Goa, Manali, etc.)
- Keep hotel names in English
- Keep prices as-is (₹10,000)
- Keep numbers as-is
- Translate only the connecting text
- Maintain WhatsApp formatting (*bold*, _italic_, etc.)

English: "${text}"

Return ONLY the translation, nothing else.`;

    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const translated = response.text().trim();

    // Cache translation (24 hours)
    await cacheManager.setCache(cacheKey, translated, 86400);

    logger.debug('Text translated from English', {
      targetLang,
      originalLength: text.length,
      translatedLength: translated.length,
    });

    return translated;

  } catch (error) {
    logger.error('Translation from English error', {
      error: error.message,
      targetLang,
    });
    // Return original text on error
    return text;
  }
}

/**
 * Get localized menu text
 */
async function getLocalizedMenu(language) {
  try {
    if (language === 'en') {
      return `📋 *MENU OPTIONS*

1️⃣ 🚍 Transport - Get travel options
2️⃣ 🏨 Hotels - See hotel recommendations
3️⃣ 📅 Itinerary - Day-by-day plan
4️⃣ 💰 Budget - See breakdown
5️⃣ 🌤 Weather - Check forecast
6️⃣ 🍛 Food - Local food guide
7️⃣ 🎫 Booking - Book your trip

━━━━━━━━━━━━━━━━
💡 Type "reset" to start new trip
💡 Type "help" for assistance

Reply with a number (1-7)`;
    }

    // Translate menu to user's language
    const englishMenu = `Menu Options:
1. Transport - Get travel options
2. Hotels - See hotel recommendations
3. Itinerary - Day-by-day plan
4. Budget - See breakdown
5. Weather - Check forecast
6. Food - Local food guide
7. Booking - Book your trip

Type "reset" to start new trip
Type "help" for assistance

Reply with a number`;

    return await translateFromEnglish(englishMenu, language);

  } catch (error) {
    logger.error('Failed to get localized menu', {
      error: error.message,
    });
    // Return English menu as fallback
    return getLocalizedMenu('en');
  }
}

/**
 * Translate full response (handles caching of entire responses)
 */
async function translateResponse(text, targetLang, sourceLang = 'en') {
  try {
    if (targetLang === 'en' || sourceLang === targetLang) {
      return text;
    }

    if (sourceLang === 'en') {
      return await translateFromEnglish(text, targetLang);
    }

    // Translate to English first, then to target
    const english = await translateToEnglish(text, sourceLang);
    return await translateFromEnglish(english, targetLang);

  } catch (error) {
    logger.error('Response translation error', {
      error: error.message,
    });
    return text;
  }
}

/**
 * Extract language change command from message
 */
function extractLanguageChange(message) {
  const lower = message.toLowerCase();

  // English commands
  const langCommands = {
    'language english': 'en',
    'language hindi': 'hi',
    'language tamil': 'ta',
    'language telugu': 'te',
    'language kannada': 'kn',
    'language malayalam': 'ml',
    'language bengali': 'bn',
    'language marathi': 'mr',
    'language gujarati': 'gu',
  };

  for (const [command, lang] of Object.entries(langCommands)) {
    if (lower.includes(command)) {
      return lang;
    }
  }

  // Hindi commands
  if (lower.includes('भाषा') || lower.includes('bhasha')) {
    if (lower.includes('हिंदी') || lower.includes('hindi')) return 'hi';
    if (lower.includes('अंग्रेजी') || lower.includes('english')) return 'en';
  }

  // Direct language codes
  const directCodes = ['en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr', 'gu'];
  if (/^language\s+(en|hi|ta|te|kn|ml|bn|mr|gu)$/i.test(lower)) {
    const match = lower.match(/^language\s+(en|hi|ta|te|kn|ml|bn|mr|gu)$/i);
    if (match) return match[1];
  }

  return null;
}

/**
 * Get language display name
 */
function getLanguageName(code) {
  return SUPPORTED_LANGUAGES[code] || 'English';
}

/**
 * Get all supported languages
 */
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES;
}

module.exports = {
  detectLanguage,
  translateToEnglish,
  translateFromEnglish,
  getLocalizedMenu,
  translateResponse,
  extractLanguageChange,
  getLanguageName,
  getSupportedLanguages,
  quickLanguageDetection,
  SUPPORTED_LANGUAGES,
};

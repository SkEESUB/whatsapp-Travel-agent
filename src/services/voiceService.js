// Voice Service - WhatsApp Voice Message Transcription
// Downloads audio from WhatsApp, transcribes using OpenAI Whisper or Google Speech-to-Text

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../config/logger');

// Configuration
const WHATSAPP_CONFIG = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  baseUrl: 'https://graph.facebook.com/v18.0',
};

// OpenAI Whisper Configuration
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: 'https://api.openai.com/v1',
  model: 'whisper-1',
};

// Google Speech-to-Text Configuration (fallback)
const GOOGLE_CONFIG = {
  apiKey: process.env.GOOGLE_SPEECH_API_KEY,
  baseUrl: 'https://speech.googleapis.com/v1',
};

// Temporary directory for audio files
const TEMP_DIR = path.join(os.tmpdir(), 'travelbot-voice');

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
 * Download media from WhatsApp Cloud API
 */
async function downloadMedia(mediaId) {
  try {
    logger.info('Downloading media from WhatsApp', { mediaId });

    // Step 1: Get media URL
    const urlResponse = await axios.get(
      `${WHATSAPP_CONFIG.baseUrl}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        },
        timeout: 10000, // 10 second timeout
      }
    );

    const mediaUrl = urlResponse.data.url;

    if (!mediaUrl) {
      throw new Error('Media URL not found');
    }

    // Step 2: Download actual media file
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
      },
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
    });

    logger.info('Media downloaded successfully', {
      mediaId,
      size: mediaResponse.data.byteLength,
    });

    return Buffer.from(mediaResponse.data);

  } catch (error) {
    logger.error('Failed to download media', {
      error: error.message,
      mediaId,
    });
    throw new Error(`Media download failed: ${error.message}`);
  }
}

/**
 * Transcribe audio using OpenAI Whisper API
 * Supports Indian accents and Hindi language
 */
async function transcribeAudioWithOpenAI(audioBuffer) {
  try {
    if (!OPENAI_CONFIG.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    logger.info('Transcribing audio with OpenAI Whisper', {
      bufferSize: audioBuffer.byteLength,
    });

    // Save audio to temp file
    const tempFile = path.join(TEMP_DIR, `voice-${Date.now()}.ogg`);
    await fs.writeFile(tempFile, audioBuffer);

    try {
      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('file', await fs.readFile(tempFile), {
        filename: 'voice.ogg',
        contentType: 'audio/ogg',
      });
      formData.append('model', OPENAI_CONFIG.model);
      formData.append('language', 'hi'); // Default to Hindi for Indian users
      formData.append('response_format', 'text');

      // Send to Whisper API
      const response = await axios.post(
        `${OPENAI_CONFIG.baseUrl}/audio/transcriptions`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`,
          },
          timeout: 30000, // 30 second timeout for transcription
        }
      );

      const transcribedText = response.data.text?.trim();

      if (!transcribedText) {
        throw new Error('Empty transcription received');
      }

      logger.info('Audio transcribed successfully (OpenAI)', {
        text: transcribedText.substring(0, 50),
        length: transcribedText.length,
      });

      return transcribedText;

    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        logger.warn('Failed to delete temp file', { error: error.message });
      }
    }

  } catch (error) {
    logger.error('OpenAI Whisper transcription failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Transcribe audio using Google Speech-to-Text API (fallback)
 */
async function transcribeAudioWithGoogle(audioBuffer) {
  try {
    if (!GOOGLE_CONFIG.apiKey) {
      throw new Error('Google Speech API key not configured');
    }

    logger.info('Transcribing audio with Google Speech-to-Text', {
      bufferSize: audioBuffer.byteLength,
    });

    // Convert to base64
    const audioContent = audioBuffer.toString('base64');

    // Prepare request
    const request = {
      audio: {
        content: audioContent,
      },
      config: {
        encoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'hi-IN', // Hindi (India)
        alternativeLanguageCodes: ['en-IN'], // English (India) as fallback
        model: 'latest_long',
        useEnhanced: true,
      },
    };

    // Send to Google Speech API
    const response = await axios.post(
      `${GOOGLE_CONFIG.baseUrl}/speech:recognize?key=${GOOGLE_CONFIG.apiKey}`,
      request,
      {
        timeout: 30000,
      }
    );

    // Extract transcription
    const results = response.data.results;
    
    if (!results || results.length === 0) {
      throw new Error('No transcription results');
    }

    const transcribedText = results[0].alternatives[0].transcript?.trim();

    if (!transcribedText) {
      throw new Error('Empty transcription received');
    }

    logger.info('Audio transcribed successfully (Google)', {
      text: transcribedText.substring(0, 50),
      length: transcribedText.length,
      confidence: results[0].alternatives[0].confidence,
    });

    return transcribedText;

  } catch (error) {
    logger.error('Google Speech-to-Text transcription failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Transcribe audio (tries OpenAI first, falls back to Google)
 */
async function transcribeAudio(audioBuffer) {
  try {
    // Try OpenAI Whisper first
    try {
      return await transcribeAudioWithOpenAI(audioBuffer);
    } catch (openaiError) {
      logger.warn('OpenAI transcription failed, trying Google', {
        error: openaiError.message,
      });

      // Fallback to Google
      return await transcribeAudioWithGoogle(audioBuffer);
    }

  } catch (error) {
    logger.error('All transcription services failed', {
      error: error.message,
    });
    throw new Error(`Voice transcription failed: ${error.message}`);
  }
}

/**
 * Process voice message from WhatsApp
 * Downloads audio, transcribes, and returns text
 */
async function processVoiceMessage(phoneNumber, mediaId) {
  try {
    logger.info('Processing voice message', {
      phoneNumber,
      mediaId,
    });

    // Step 1: Ensure temp directory exists
    await ensureTempDir();

    // Step 2: Download audio
    const audioBuffer = await downloadMedia(mediaId);

    // Step 3: Transcribe audio
    const transcribedText = await transcribeAudio(audioBuffer);

    logger.info('Voice message processed successfully', {
      phoneNumber,
      originalMediaId: mediaId,
      transcribedText: transcribedText.substring(0, 100),
    });

    return {
      success: true,
      text: transcribedText,
      mediaId,
    };

  } catch (error) {
    logger.error('Voice message processing failed', {
      error: error.message,
      phoneNumber,
      mediaId,
    });

    return {
      success: false,
      error: error.message,
      text: null,
    };
  }
}

/**
 * Format voice response with transcription
 */
function formatVoiceResponse(transcribedText, normalResponse) {
  return `🎤 *I heard:* "${transcribedText}"\n\n${normalResponse}`;
}

/**
 * Generate voice error message
 */
function getVoiceErrorMessage(error) {
  return `⚠️ *Sorry, I couldn't understand your voice message.*\n\nPlease try again or send a text message.\n\nError: ${error}`;
}

module.exports = {
  downloadMedia,
  transcribeAudio,
  processVoiceMessage,
  formatVoiceResponse,
  getVoiceErrorMessage,
};

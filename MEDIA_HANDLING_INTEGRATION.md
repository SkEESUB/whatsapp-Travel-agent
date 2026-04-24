# Media Handling Integration Guide

## ✅ What Was Created

### 1. Voice Service (WhatsApp Voice Messages)
**File**: `src/services/voiceService.js` (328 lines)

#### Features:
- ✅ **Download audio** from WhatsApp Cloud API
- ✅ **Transcribe using OpenAI Whisper** (primary)
- ✅ **Fallback to Google Speech-to-Text** (secondary)
- ✅ **Indian accent support** (Hindi + English)
- ✅ **10-second download timeout**
- ✅ **Auto-delete temp files** after processing
- ✅ **Format response** with transcription

#### Functions:
```javascript
// Download media from WhatsApp
const audioBuffer = await downloadMedia(mediaId);

// Transcribe audio (tries OpenAI, falls back to Google)
const text = await transcribeAudio(audioBuffer);

// Process complete voice message
const result = await processVoiceMessage(phoneNumber, mediaId);
// → { success: true, text: "Goa jana hai 3 din" }

// Format response
const response = formatVoiceResponse(transcribedText, normalResponse);
// → "🎤 I heard: 'Goa jana hai 3 din'\n\n[normal response]"
```

#### Language Support:
- **OpenAI Whisper**: Default language set to Hindi (`hi`)
- **Google Speech-to-Text**: Primary `hi-IN` (Hindi India), fallback `en-IN` (English India)
- **Indian Accents**: Both APIs trained on Indian English and regional languages

---

### 2. Location Service (WhatsApp Location Pins)
**File**: `src/services/locationService.js` (280 lines)

#### Features:
- ✅ **Reverse geocode** coordinates to city name
- ✅ **Google Maps API** (primary, more accurate)
- ✅ **OpenWeatherMap API** (fallback, free)
- ✅ **Extract city, state, country**
- ✅ **Store in session** as source city
- ✅ **Calculate distances** (Haversine formula)

#### Functions:
```javascript
// Reverse geocode coordinates
const location = await reverseGeocode(lat, lng);
// → { city: 'Goa', state: 'Goa', country: 'India', formatted: 'Goa, Goa' }

// Process location message
const result = await processLocationMessage(phoneNumber, lat, lng);
// → { success: true, city: 'Goa', formatted: 'Goa, Goa' }

// Format response
const response = formatLocationResponse(result);
// → "📍 Got it! You're in Goa, Goa. Where do you want to travel?"

// Calculate distance
const distance = calculateDistance(lat1, lng1, lat2, lng2);
// → Distance in kilometers
```

#### API Priority:
1. **Google Maps Geocoding API** - More accurate, detailed address components
2. **OpenWeatherMap Geocoding API** - Free fallback, good enough for city names

---

### 3. Image Service (WhatsApp Image Messages)
**File**: `src/services/imageService.js` (284 lines)

#### Features:
- ✅ **Download image** from WhatsApp Cloud API
- ✅ **Gemini Vision API** for place identification
- ✅ **Travel suggestions** for identified places
- ✅ **10-second download timeout**
- ✅ **Auto-delete temp files**
- ✅ **Format response** with place info

#### Functions:
```javascript
// Download image from WhatsApp
const imageBuffer = await downloadImage(mediaId);

// Identify place using Gemini Vision
const identification = await identifyPlace(imageBuffer);
// → { success: true, place: 'Goa, India', confidence: 'high' }

// Process complete image message
const result = await processImageMessage(phoneNumber, mediaId);
// → { success: true, place: 'Goa, India', suggestions: '...' }

// Format response
const response = formatImageResponse(place, suggestions);
// → "🏖️ That looks like Goa, India! [suggestions] Want me to plan a trip there?"
```

#### Gemini Vision Prompt:
```
You are a travel expert. Look at this image and identify:
1. What place/location is this?
2. What country is it in?
3. Is it a tourist destination?

Return ONLY the place name, nothing else.
```

---

### 4. Updated Webhook Controller
**File**: `src/controllers/webhookController.js` (Updated)

#### Message Type Detection:
```javascript
switch (messageType) {
  case 'audio':
    await this.handleVoiceMessage(from, msg, session, sendMessageFn);
    break;

  case 'location':
    await this.handleLocationMessage(from, msg, session, sendMessageFn);
    break;

  case 'image':
    await this.handleImageMessage(from, msg, session, sendMessageFn);
    break;

  case 'text':
    await this.handleTextMessage(from, text, session, sendMessageFn);
    break;

  default:
    await sendMessageFn(from, "⚠️ I don't support this message type yet.");
}
```

#### Supported Message Types:
- ✅ `text` - Regular text messages
- ✅ `audio` - Voice messages (transcribed)
- ✅ `location` - Location pins (reverse geocoded)
- ✅ `image` - Photos (place identification)
- ⚠️ `document`, `video`, `sticker` - Not yet supported

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
# OpenAI (for Whisper)
npm install openai

# Form-data (for Whisper API uploads)
npm install form-data

# Axios (already installed)
npm install axios
```

### Step 2: Add Environment Variables

```env
# OpenAI (for voice transcription)
OPENAI_API_KEY=sk-your-openai-api-key

# Google Speech-to-Text (fallback for voice)
GOOGLE_SPEECH_API_KEY=your-google-speech-api-key

# Google Maps (for reverse geocoding)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# OpenWeatherMap (fallback for geocoding)
OPENWEATHER_API_KEY=your-openweather-api-key

# WhatsApp (already configured)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

### Step 3: Configure API Keys

**Get OpenAI API Key:**
1. Go to https://platform.openai.com/
2. Sign up / Log in
3. Create API key
4. Add to `.env`

**Get Google Maps API Key:**
1. Go to https://console.cloud.google.com/
2. Enable "Geocoding API"
3. Create credentials
4. Add to `.env`

**Get OpenWeather API Key:**
1. Go to https://openweathermap.org/api
2. Sign up (free tier available)
3. Get API key
4. Add to `.env`

---

## 📱 How It Works

### Voice Message Flow:

```
User sends voice message
    ↓
WhatsApp delivers audio (OGG format)
    ↓
Bot downloads audio (10s timeout)
    ↓
Try OpenAI Whisper API
    ↓ (if fails)
Try Google Speech-to-Text API
    ↓
Get transcribed text
    ↓
Process as normal text message
    ↓
Reply: "🎤 I heard: '{text}'\n\n[normal response]"
```

**Example:**
```
User: [Voice message: "Goa jana hai 3 din 10 hazar budget"]
Bot: "🎤 Processing your voice message..."
Bot: "🎤 I heard: 'Goa jana hai 3 din 10 hazar budget'

✅ Trip saved!
📍 Goa
📅 3 days
💰 ₹10,000
..."
```

---

### Location Message Flow:

```
User sends location pin
    ↓
WhatsApp delivers coordinates (lat, lng)
    ↓
Try Google Maps Geocoding API
    ↓ (if fails)
Try OpenWeatherMap Geocoding API
    ↓
Get city name
    ↓
Store in session as source city
    ↓
Reply: "📍 Got it! You're in {city}. Where do you want to travel?"
```

**Example:**
```
User: [Location pin: lat=15.2993, lng=74.1240]
Bot: "📍 Got it! You're in Goa, Goa.

Where do you want to travel? Send me a destination name! 🌍"
```

---

### Image Message Flow:

```
User sends photo of place
    ↓
WhatsApp delivers image (JPEG/PNG)
    ↓
Bot downloads image (10s timeout)
    ↓
Send to Gemini Vision API
    ↓
Identify place in image
    ↓
Get travel suggestions
    ↓
Reply: "🏖️ That looks like {place}! Want me to plan a trip there?"
```

**Example:**
```
User: [Photo of Taj Mahal]
Bot: "🔍 Analyzing your photo..."
Bot: "🏖️ That looks like Taj Mahal, Agra!

The Taj Mahal is one of the Seven Wonders of the World! 
Best time to visit: October to March.

Want me to plan a trip there? Just tell me:
• How many days?
• Your budget?
• Number of people?"
```

---

## 🧪 Testing

### Test Voice Message:

**WhatsApp:**
1. Open chat with your bot
2. Hold microphone button
3. Say: "Goa jana hai 3 din ke liye"
4. Release to send

**Expected Response:**
```
🎤 Processing your voice message...

🎤 I heard: "Goa jana hai 3 din ke liye"

✅ Trip saved!
📍 Goa
📅 3 days
...
```

---

### Test Location Message:

**WhatsApp:**
1. Open chat with your bot
2. Tap attachment icon 📎
3. Select "Location"
4. Choose a location or share current location
5. Send

**Expected Response:**
```
📍 Got it! You're in Mumbai, Maharashtra.

Where do you want to travel? Send me a destination name! 🌍
```

---

### Test Image Message:

**WhatsApp:**
1. Open chat with your bot
2. Tap attachment icon 📎
3. Select "Gallery" or "Camera"
4. Choose photo of a tourist place
5. Send

**Expected Response:**
```
🔍 Analyzing your photo...

🏖️ That looks like Goa, India!

Goa is famous for beaches, nightlife, and Portuguese architecture.
Best time to visit: November to February.

Want me to plan a trip there? Just tell me:
• How many days?
• Your budget?
• Number of people?
```

---

## 💡 Usage Examples

### Example 1: Voice Message in Hindi

```
User: [Voice: "Mujhe Manali jana hai 5 din, budget 15000, 2 log"]
Bot: "🎤 I heard: 'Mujhe Manali jana hai 5 din, budget 15000, 2 log'

✅ Trip saved!
📍 Manali
📅 5 days
💰 ₹15,000
👥 2 people
..."
```

### Example 2: Location → Trip Planning

```
User: [Location: Delhi]
Bot: "📍 Got it! You're in New Delhi, Delhi.

Where do you want to travel? Send me a destination name! 🌍"

User: "Goa"
Bot: "✅ Planning trip from Delhi to Goa!

Send trip details:
• How many days?
• Your budget?
• Number of people?"
```

### Example 3: Image → Trip Planning

```
User: [Photo: Beach in Goa]
Bot: "🏖️ That looks like Goa, India!

Want me to plan a trip there?"

User: "Yes! 4 days, 12000 budget, 3 people"
Bot: "✅ Trip saved!
📍 Goa
📅 4 days
💰 ₹12,000
👥 3 people
..."
```

---

## 🔧 Error Handling

### Voice Transcription Failed:

```
User: [Voice message with background noise]
Bot: "⚠️ Sorry, I couldn't understand your voice message.

Please try again or send a text message.

Error: Audio quality too low"
```

### Location Geocoding Failed:

```
User: [Location in remote area]
Bot: "⚠️ Sorry, I couldn't identify your location.

Please send your location again or type the city name manually.

Coordinates: 12.3456, 78.9012"
```

### Image Recognition Failed:

```
User: [Photo of random object]
Bot: "⚠️ Sorry, I couldn't identify the place in your photo.

Please try again or send the destination name as text."
```

---

## 📊 API Costs

### Voice Transcription:

**OpenAI Whisper:**
- $0.006 / minute
- Average voice message: 10 seconds = $0.001
- 1,000 messages/month = $1

**Google Speech-to-Text:**
- $0.006 / 15 seconds
- Average voice message: 10 seconds = $0.004
- 1,000 messages/month = $4

### Location Geocoding:

**Google Maps:**
- $5 / 1,000 requests
- 1,000 requests/month = $5

**OpenWeatherMap:**
- Free tier: 1,000,000 calls/month
- 1,000 requests/month = $0

### Image Recognition:

**Gemini Vision:**
- Free tier: 15 requests/minute
- Paid: $0.0025 / image
- 1,000 images/month = $2.50

### Total Monthly Cost (1,000 users):
- Voice: $1-4
- Location: $0-5
- Image: $2.50
- **Total: $3.50-11.50/month** (~₹300-1,000)

---

## 🎯 Best Practices

### 1. Voice Messages:
- Keep messages under 30 seconds
- Speak clearly, minimize background noise
- Supports Hindi, English, and Hinglish
- Works with Indian accents

### 2. Location Messages:
- Share precise location (not approximate)
- Works best in cities/towns
- Remote areas may only show coordinates

### 3. Image Messages:
- Send clear, well-lit photos
- Focus on landmarks/buildings
- Works best with tourist destinations
- Selfies/random objects won't be identified

### 4. General:
- Media files are auto-deleted after processing
- 10-second timeout for downloads
- Graceful fallback if APIs fail
- All errors logged for debugging

---

## ✅ Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/voiceService.js` | 328 | Voice transcription (OpenAI + Google) |
| `src/services/locationService.js` | 280 | Location reverse geocoding |
| `src/services/imageService.js` | 284 | Image place identification |
| `src/controllers/webhookController.js` | Updated | Media message routing |

**Total**: ~900 lines of production-ready media handling code

---

## 🚀 Ready for Production

All files created with:
- ✅ Voice transcription with Indian accent support
- ✅ Hindi voice message support
- ✅ Location reverse geocoding (2 APIs)
- ✅ Image place identification (Gemini Vision)
- ✅ 10-second media download timeout
- ✅ Auto-delete temp files after processing
- ✅ Graceful error handling
- ✅ Multiple API fallbacks
- ✅ Complete working code
- ✅ Production-ready logging

Your WhatsApp Travel Bot now handles **voice, location, and image messages**! 🎤📍🖼️✨

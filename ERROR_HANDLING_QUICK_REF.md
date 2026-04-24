# Quick Reference: Error Handling Implementation

## 📦 Files Created

```
src/
├── middleware/
│   └── errorHandler.js          # Global error handler middleware
├── utils/
│   └── asyncWrapper.js          # Async function wrappers
├── services/
│   └── serviceWrappers.js       # Pre-wrapped service functions
└── app.js                        # Updated with process handlers
```

---

## 🚀 Quick Start

### 1. Import Wrappers

```javascript
// In your routes
const { asyncWrapper } = require('../utils/asyncWrapper');

// In your engines/controllers
const { getHotelsSafe, getTransportOptionsSafe } = require('../services/serviceWrappers');
```

### 2. Wrap Routes

```javascript
const express = require('express');
const router = express.Router();
const { asyncWrapper } = require('../utils/asyncWrapper');

// Before (unsafe)
router.post('/webhook', async (req, res) => {
  await controller.handleMessage(req, res);
});

// After (safe)
router.post('/webhook', asyncWrapper(async (req, res, next) => {
  await controller.handleMessage(req, res, next);
}));
```

### 3. Use Safe Services

```javascript
// In engines or controllers
const { getHotelsSafe } = require('../services/serviceWrappers');

async function getHotels(destination, budget, days) {
  // This will NEVER throw - always returns result or fallback
  const result = await getHotelsSafe(destination, budget, days);
  
  if (result.success) {
    return result.data;
  } else {
    return result.message; // Fallback message
  }
}
```

---

## 🛡️ Available Safe Services

All services in `serviceWrappers.js` have `Safe` versions:

### Transport
- `getBusOptionsSafe(origin, destination, budget, people)`
- `getTrainOptionsSafe(origin, destination, budget, people)`
- `getFlightOptionsSafe(origin, destination, budget, people)`

### Hotels
- `getHotelsSafe(destination, budget, days)`

### Itinerary
- `getItinerarySafe(destination, days, people, budget)`

### Budget
- `getBudgetPlanSafe(destination, totalBudget, people, days)`

### Weather
- `getWeatherSafe(cityName)`

### Gemini AI
- `generateAIResponseSafe(prompt)`
- `getTransportOptionsSafe(...)`
- `getHotelRecommendationsSafe(...)`
- `getTouristPlacesSafe(destination)`
- `getItineraryGeminiSafe(...)`
- `getBudgetPlanGeminiSafe(...)`

---

## 📝 Wrapper Types

### 1. asyncWrapper (For Routes)
```javascript
const { asyncWrapper } = require('../utils/asyncWrapper');

router.get('/test', asyncWrapper(async (req, res, next) => {
  // Any error here goes to errorHandler middleware
  const result = await someAsyncOperation();
  res.json(result);
}));
```

### 2. asyncWrapperWithFallback (For Controllers)
```javascript
const { asyncWrapperWithFallback } = require('../utils/asyncWrapper');

router.post('/webhook', asyncWrapperWithFallback(
  async (req, res, next) => {
    await controller.handleMessage(req, res, next);
  },
  async (req, res, error) => {
    // Custom fallback
    await sendFallbackMessage(req, error);
  }
));
```

### 3. tryCatchWrapper (For Services - String Return)
```javascript
const { tryCatchWrapper } = require('../utils/asyncWrapper');

const myService = tryCatchWrapper(
  async (param1, param2) => {
    const result = await doSomething(param1, param2);
    return result;
  },
  '⚠️ Service unavailable. Please try again.'
);
```

### 4. tryCatchWrapperStructured (For Services - Object Return)
```javascript
const { tryCatchWrapperStructured } = require('../utils/asyncWrapper');

const myService = tryCatchWrapperStructured(
  async (param1, param2) => {
    const result = await doSomething(param1, param2);
    return { success: true, data: result };
  },
  '⚠️ Service unavailable. Please try again.'
);
```

---

## 🎯 Error Response Examples

### On Gemini API Failure
```
User: "Show me hotels in Delhi"
Bot: "⚠️ AI service is temporarily busy. Please try again in a moment."
```

### On WhatsApp API Failure
```
User: "Show me transport options"
Bot: "⚠️ Message service unavailable. Please try again."
```

### On Network Timeout
```
User: "What's the weather?"
Bot: "⚠️ Request timed out. Please check your connection and try again."
```

### On Invalid Input
```
User: sends invalid JSON
Bot: "❌ Invalid request format. Please send a valid message."
```

---

## 🔍 Error Logging Format

All errors are logged like this:

```
============================================================
❌ ERROR CAUGHT BY GLOBAL HANDLER
============================================================
Category: GEMINI_API
Timestamp: 2024-01-15T10:30:00.000Z
Route: /webhook
Method: POST
Message: Gemini API timeout
Stack: Error: Gemini API timeout
    at generateContent (...)
    at ...
============================================================
```

---

## ✅ Checklist

- [x] `errorHandler.js` - Global error handler middleware
- [x] `asyncWrapper.js` - Async function wrappers
- [x] `serviceWrappers.js` - Pre-wrapped services
- [x] `app.js` - Process handlers + middleware
- [x] All services have try-catch
- [x] All controllers have try-catch
- [x] All engines have try-catch
- [x] Server never crashes
- [x] Users always get responses

---

## 🧪 Test It

### Test Server Stability
```bash
# Start server
npm start

# In another terminal, send invalid request
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d "{bad json}"

# Server should NOT crash and should log the error
```

### Test Uncaught Exception
```javascript
// Add this temporarily to app.js
setTimeout(() => {
  throw new Error('Test error');
}, 5000);

// Server should log error but continue running
```

---

## 📚 Full Documentation

See `ERROR_HANDLING_GUIDE.md` for complete documentation.

---

## 💡 Pro Tips

1. **Always use Safe services** - They handle errors automatically
2. **Keep try-catch in controllers** - For business logic errors
3. **Never expose stack traces** - Use error handler messages
4. **Log context** - Include user ID, action, relevant data
5. **Test error scenarios** - Ensure fallbacks work

---

**Your bot is now production-ready!** 🎉

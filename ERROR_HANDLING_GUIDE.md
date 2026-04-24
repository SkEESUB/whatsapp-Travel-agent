# Error Handling Implementation Guide

## Overview
This guide explains the production-grade error handling system implemented for the WhatsApp Travel Bot.

**Goal**: The server will NEVER crash, and users will ALWAYS receive a friendly response.

---

## Architecture

```
User Message
    ↓
Webhook Route (with asyncWrapper)
    ↓
Controller (with try-catch)
    ↓
Engine (with try-catch)
    ↓
Service (with tryCatchWrapper)
    ↓
Error Handler Middleware (catches everything)
    ↓
Process Handlers (catches uncaught exceptions)
```

---

## Files Created

### 1. `src/middleware/errorHandler.js`
Global Express error handler middleware that:
- Catches all synchronous and asynchronous errors
- Logs detailed error information (timestamp, route, message, stack)
- Categorizes errors (Gemini API, WhatsApp API, Network, etc.)
- Returns safe, user-friendly messages
- Never exposes internal errors to users

### 2. `src/utils/asyncWrapper.js`
Higher-order functions that wrap async code:
- `asyncWrapper()` - For route handlers
- `asyncWrapperWithFallback()` - For controllers with custom fallback
- `tryCatchWrapper()` - For services returning strings
- `tryCatchWrapperStructured()` - For services returning `{ success, data }`

### 3. `src/services/serviceWrappers.js`
Pre-configured wrapped versions of all services:
- Every service function has a `Safe` version
- Automatically returns fallback messages on error
- Import and use instead of raw services

### 4. Updated `src/app.js`
- Added `process.on('uncaughtException')` handler
- Added `process.on('unhandledRejection')` handler
- Both log errors but DO NOT crash the server
- Error handler middleware added as last middleware

---

## Usage Examples

### 1. Wrapping Route Handlers

**Before (can crash server):**
```javascript
router.post('/webhook', async (req, res) => {
  await webhookController.handleMessage(req, res, sendMessage);
});
```

**After (safe):**
```javascript
const { asyncWrapper } = require('../utils/asyncWrapper');

router.post('/webhook', asyncWrapper(async (req, res, next) => {
  await webhookController.handleMessage(req, res, sendMessage);
}));
```

### 2. Wrapping Controller Methods

Controllers already have try-catch blocks, but you can add an extra layer:

```javascript
const { asyncWrapperWithFallback } = require('../utils/asyncWrapper');

router.post('/webhook', asyncWrapperWithFallback(
  async (req, res, next) => {
    await webhookController.handleMessage(req, res, sendMessage);
  },
  async (req, res, error) => {
    // Fallback if controller fails
    const from = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
    if (from) {
      await sendMessage(from, '⚠️ Service temporarily unavailable. Please try again.');
    }
  }
));
```

### 3. Wrapping Service Functions

**Option A: Use pre-configured wrappers (Recommended)**

```javascript
const { getHotelsSafe, getTransportOptionsSafe } = require('../services/serviceWrappers');

// In your engine or controller:
const result = await getHotelsSafe(destination, budget, days);
// If error occurs, result = "⚠️ Hotel information temporarily unavailable..."
```

**Option B: Wrap manually**

```javascript
const { tryCatchWrapperStructured } = require('../utils/asyncWrapper');

const getHotelsSafe = tryCatchWrapperStructured(
  async (destination, budget, days) => {
    // Your original service logic
    const result = await hotelService.getHotels(destination, budget, days);
    return { success: true, data: result };
  },
  '⚠️ Hotel information temporarily unavailable. Please try again later.'
);
```

### 4. Using in Travel Engine

```javascript
const { getHotelsSafe, getItinerarySafe } = require('../services/serviceWrappers');

class TravelEngine {
  async getHotels(destination, budget, days) {
    // Wrapped service - will never throw
    const result = await getHotelsSafe(destination, budget, days);
    
    // result is either { success: true, data: ... } or { success: false, message: ... }
    return result;
  }
}
```

---

## Error Handling Layers

### Layer 1: Service Level
Services catch their own errors and return fallback messages:
```javascript
async function getHotels(destination, budget, days) {
  try {
    // Logic
    return result;
  } catch (err) {
    console.error('Error:', err.message);
    return '⚠️ Hotel information temporarily unavailable.';
  }
}
```

### Layer 2: Engine Level
Engines wrap services in try-catch:
```javascript
async getHotels(destination, budget, days) {
  try {
    const result = await hotelService.getHotels(destination, budget, days);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, message: '⚠️ Hotel service unavailable.' };
  }
}
```

### Layer 3: Controller Level
Controllers wrap engines in try-catch:
```javascript
async handleHotels(from, session, sendMessageFn) {
  try {
    const result = await travelEngine.getHotels(...);
    await sendMessageFn(from, result.data);
  } catch (err) {
    await sendMessageFn(from, '⚠️ Hotel service unavailable.');
  }
}
```

### Layer 4: Route Level (asyncWrapper)
Routes wrap controllers:
```javascript
router.post('/webhook', asyncWrapper(async (req, res, next) => {
  await controller.handleMessage(req, res, next);
}));
```

### Layer 5: Global Middleware (errorHandler)
Catches anything that slips through:
```javascript
app.use(ErrorHandler.handle());
```

### Layer 6: Process Handlers
Catches uncaught exceptions and unhandled rejections:
```javascript
process.on('uncaughtException', (error) => {
  console.error('Uncaught:', error);
  // Server continues running
});
```

---

## Error Categories

The error handler automatically categorizes errors:

| Category | Trigger | User Message |
|----------|---------|--------------|
| `GEMINI_API` | Gemini API errors | "⚠️ AI service is temporarily busy..." |
| `WHATSAPP_API` | WhatsApp API errors | "⚠️ Message service unavailable..." |
| `NETWORK_TIMEOUT` | Timeout/connection errors | "⚠️ Request timed out..." |
| `INVALID_JSON` | JSON parsing errors | "❌ Invalid request format..." |
| `RATE_LIMIT` | 429 status code | "⏳ Too many requests..." |
| `NOT_FOUND` | 404 status code | "❌ Service not found..." |
| `AUTH_ERROR` | 401/403 status codes | "❌ Authentication failed..." |
| `UNKNOWN` | Anything else | "⚠️ Service temporarily unavailable..." |

---

## Logging Format

All errors are logged with structured format:

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
    at ...
============================================================
```

---

## Best Practices

### 1. Always Use Wrapped Services
```javascript
// ✅ Good
const { getHotelsSafe } = require('../services/serviceWrappers');
const result = await getHotelsSafe(destination, budget, days);

// ❌ Bad - can throw uncaught errors
const result = await hotelService.getHotels(destination, budget, days);
```

### 2. Keep Try-Catch in Controllers
Even with wrappers, controllers should have their own try-catch for business logic errors.

### 3. Never Expose Stack Traces to Users
Always use the error handler's `getUserMessage()` method.

### 4. Log Contextual Information
Include user ID, action type, and relevant data in error logs.

### 5. Return Safe Fallbacks
Every service must return a fallback message, never throw.

---

## Testing Error Handling

### Test 1: Gemini API Failure
```javascript
// Temporarily set invalid API key
process.env.GEMINI_API_KEY = 'invalid';
// Trigger any AI request - should return fallback message
```

### Test 2: Network Timeout
```javascript
// Disconnect internet or use invalid API URL
// Should return timeout message
```

### Test 3: Invalid JSON
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d "{invalid json}"
# Should return 400 with friendly message
```

### Test 4: Unknown Route
```bash
curl http://localhost:3000/unknown
# Should return 404 with friendly message
```

### Test 5: Uncaught Exception
```javascript
// Simulate uncaught exception
setTimeout(() => {
  throw new Error('Test uncaught exception');
}, 1000);
// Server should continue running
```

---

## Production Recommendations

### 1. Use Winston or Pino for Logging
Replace `console.error` with proper logging library:
```javascript
const winston = require('winston');
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log' })
  ]
});
```

### 2. Add Error Monitoring
Integrate with services like:
- Sentry
- New Relic
- DataDog
- AWS CloudWatch

### 3. Graceful Shutdown
For production, implement graceful shutdown:
```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
```

### 4. Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## Summary

With this error handling system:
- ✅ Server NEVER crashes
- ✅ Users ALWAYS get friendly responses
- ✅ All errors are logged with context
- ✅ No stack traces exposed to users
- ✅ Multiple layers of protection
- ✅ Production-ready and scalable

**The bot is now bulletproof!** 🛡️

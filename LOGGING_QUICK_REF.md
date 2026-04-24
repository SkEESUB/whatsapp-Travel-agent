# Logging System - Quick Reference

## 📦 Files Created

```
src/
├── config/
│   └── logger.js              # Winston logger configuration
├── middleware/
│   └── requestLogger.js       # HTTP request logging
├── utils/
│   └── apiLogger.js           # API call logging utilities
logs/
├── error.log                  # Errors only (auto-created)
├── combined.log               # Everything (auto-created)
└── api.log                    # API calls only (auto-created)
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install winston uuid
```

### 2. Import Logger
```javascript
const logger = require('./config/logger');
```

### 3. Basic Usage
```javascript
logger.debug('Debug message', { detail: 'value' });
logger.info('Info message', { userId: '123' });
logger.warn('Warning message', { action: 'retry' });
logger.error('Error message', { error: err.message });
```

---

## 📝 Logging Patterns

### User Actions
```javascript
logger.userAction({
  userId: from,
  action: 'transport_requested',
  details: { origin: 'Hyderabad', destination: 'Delhi' },
  requestId: req.requestId,
});
```

### Business Events
```javascript
logger.businessEvent({
  event: 'trip_saved',
  data: { destination: 'Goa', budget: 15000 },
  requestId: req.requestId,
});
```

### Service Calls
```javascript
logger.serviceCall({
  serviceName: 'TravelEngine',
  action: 'getHotels',
  params: { destination: 'Goa' },
  success: true,
  duration: 1200,
  requestId: req.requestId,
});
```

### API Calls
```javascript
const { apiCall, logGeminiCall, logWhatsAppMessage } = require('./utils/apiLogger');

// Generic API call
const response = await apiCall({
  apiName: 'Gemini',
  endpoint: 'https://...',
  method: 'POST',
  data: { ... },
  requestId: req.requestId,
});

// Specialized loggers
logGeminiCall('gemini-2.5-flash', promptLength, true, 1500, null, requestId);
logWhatsAppMessage(to, true, null, requestId);
logWeatherCall('Goa', true, weatherData, null, requestId);
```

---

## 🔄 Replace console.log/error

### Before → After

```javascript
// ❌ Old
console.log("User:", from, "Message:", text);

// ✅ New
logger.info('User message', { userId: from, text });
```

```javascript
// ❌ Old
console.error("Error:", err.message, err.stack);

// ✅ New
logger.error('Operation failed', {
  error: err.message,
  stack: err.stack,
});
```

```javascript
// ❌ Old
console.log("Trip saved:", trip);

// ✅ New
logger.businessEvent({
  event: 'trip_saved',
  data: trip,
  requestId: req.requestId,
});
```

---

## 📊 Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Failures, crashes | API failed, DB error |
| `warn` | Potential issues | Missing data, retries |
| `info` | Important events | User actions, saved trips |
| `debug` | Detailed debugging | Request payloads |

---

## 📁 Log Files

### Location: `logs/` directory

| File | Contents | Max Size |
|------|----------|----------|
| `error.log` | Errors only | 5MB (5 files) |
| `combined.log` | Everything | 5MB (5 files) |
| `api.log` | API calls only | 5MB (5 files) |

### Auto-Rotation
- Max size: 5MB per file
- Max files: 5 (older deleted)
- Format: `error.log`, `error1.log`, `error2.log`...

---

## 🔍 Request ID Tracking

Every request gets a unique UUID:

```javascript
// Automatically added by middleware
req.requestId = 'abc-123-def-456';

// Included in all logs
logger.info('Processing', { requestId: req.requestId });

// Added to response headers
X-Request-ID: abc-123-def-456
```

**Trace entire request flow:**
```bash
grep "abc-123-def-456" logs/combined.log
```

---

## 🛡️ Privacy Protection

### Automatically Sanitized
- `access_token` - Removed
- `token` - Removed
- `authorization` - Removed
- `password` - Removed
- `secret` - Removed

### Body Preview
Request bodies truncated to 200 chars in logs.

### Never Log
- Full message content
- API keys
- Access tokens
- Personal data

---

## ⚡ Performance

### Async Logging
All Winston transports are async - no blocking!

### Environment Config
```bash
# Development - see everything
LOG_LEVEL=debug

# Production - only important logs
LOG_LEVEL=info
```

### Best Practice
```javascript
// ✅ Good - truncate large data
logger.info('Request', {
  body: JSON.stringify(data).substring(0, 500)
});

// ❌ Bad - could be huge
logger.info('Request', { body: data });
```

---

## 🧪 Testing

### Test All Levels
```javascript
const logger = require('./src/config/logger');

logger.debug('Debug test');
logger.info('Info test');
logger.warn('Warn test');
logger.error('Error test');

// Check files
cat logs/combined.log
cat logs/error.log
```

### Test Request Logger
```bash
npm start
curl http://localhost:3000/webhook
cat logs/combined.log | grep "requestId"
```

### Test API Logger
```javascript
const { apiCall } = require('./src/utils/apiLogger');

await apiCall({
  apiName: 'Test',
  endpoint: 'https://httpbin.org/get',
});

cat logs/api.log
```

---

## 🎯 Real Examples

### In webhookController.js
```javascript
const logger = require('../config/logger');

async handleMessage(req, res, sendMessageFn) {
  try {
    const from = msg.from;
    const text = msg.text?.body;
    
    logger.userAction({
      userId: from,
      action: 'message_received',
      details: { length: text?.length },
      requestId: req.requestId,
    });
    
    // ... logic
    
  } catch (err) {
    logger.error('Handler error', {
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
    });
  }
}
```

### In travelEngine.js
```javascript
const logger = require('../config/logger');
const { logGeminiCall } = require('../utils/apiLogger');

async getHotels(destination, budget, days, requestId) {
  const startTime = Date.now();
  
  try {
    logger.serviceCall({
      serviceName: 'TravelEngine',
      action: 'getHotels',
      params: { destination, budget, days },
      requestId,
    });
    
    const result = await hotelService.getHotels(destination, budget, days);
    const duration = Date.now() - startTime;
    
    logger.info('Hotels retrieved', {
      destination,
      duration: `${duration}ms`,
      requestId,
    });
    
    return { success: true, data: result };
    
  } catch (err) {
    logger.error('Hotel error', {
      destination,
      error: err.message,
      requestId,
    });
    
    return { success: false, message: '⚠️ Unavailable' };
  }
}
```

---

## 📚 Full Documentation

See `LOGGING_GUIDE.md` for complete documentation.

---

## ✅ Checklist

- [x] Winston logger configured
- [x] Request ID tracking (UUID)
- [x] Request logger middleware
- [x] API call logging utilities
- [x] Log rotation (5MB, 5 files)
- [x] Privacy sanitization
- [x] Async logging (performance)
- [x] Structured JSON format
- [x] Colorized console output
- [x] Multiple log levels

---

**Your bot now has enterprise-grade logging!** 🎉

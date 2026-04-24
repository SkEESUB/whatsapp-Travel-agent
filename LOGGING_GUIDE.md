# Production-Grade Logging System - Implementation Guide

## Overview
This guide explains the complete Winston-based logging system implemented for the WhatsApp Travel Bot.

**Features**:
- ✅ Structured JSON logging
- ✅ Multiple log levels (error, warn, info, debug)
- ✅ Log rotation (5MB max, 5 files)
- ✅ Request ID tracking (UUID)
- ✅ API call monitoring
- ✅ Privacy-safe (no sensitive data)
- ✅ Async logging (performance-friendly)

---

## Files Created

### 1. `src/config/logger.js` (222 lines)
Main Winston logger configuration:
- Console transport (colorized, for development)
- File transports (JSON, for production):
  - `logs/error.log` - Errors only
  - `logs/combined.log` - Everything
  - `logs/api.log` - External API calls only
- Helper methods for structured logging
- Request ID support

### 2. `src/middleware/requestLogger.js` (95 lines)
HTTP request logging middleware:
- Generates unique request ID (UUID)
- Logs request details (method, path, body preview)
- Tracks response time
- Logs response status
- Sanitizes sensitive data
- Adds request ID to response headers

### 3. `src/utils/apiLogger.js` (264 lines)
API call logging utilities:
- `apiCall()` - Wrapper for axios calls
- `apiCallWrapper()` - Generic API wrapper
- `logWhatsAppMessage()` - WhatsApp API logging
- `logGeminiCall()` - Gemini API logging
- `logWeatherCall()` - Weather API logging

### 4. Updated `src/app.js`
- Integrated logger for all process handlers
- Added request logger middleware
- Added graceful shutdown logging
- Replaced all console.log/error with logger

---

## Installation

Install required dependencies:

```bash
npm install winston uuid
```

---

## Usage Guide

### 1. Basic Logging

**Import logger:**
```javascript
const logger = require('./config/logger');
```

**Log at different levels:**
```javascript
logger.debug('Debug message', { detail: 'value' });
logger.info('Info message', { userId: '123' });
logger.warn('Warning message', { action: 'retry' });
logger.error('Error message', { error: err.message, stack: err.stack });
```

### 2. Structured Logging Methods

**User Actions:**
```javascript
logger.userAction({
  userId: from,
  action: 'transport_requested',
  details: { origin: 'Hyderabad', destination: 'Delhi' },
  requestId: req.requestId,
});
```

**Business Events:**
```javascript
logger.businessEvent({
  event: 'trip_saved',
  data: {
    userId: from,
    destination: 'Goa',
    budget: 15000,
  },
  requestId: req.requestId,
});
```

**Service Calls:**
```javascript
logger.serviceCall({
  serviceName: 'TravelEngine',
  action: 'getHotels',
  params: { destination: 'Goa', budget: 5000 },
  success: true,
  duration: 1200,
  requestId: req.requestId,
});
```

### 3. API Call Logging

**Using apiCall wrapper:**
```javascript
const { apiCall } = require('./utils/apiLogger');

const response = await apiCall({
  apiName: 'Gemini',
  endpoint: 'https://generativelanguage.googleapis.com/...',
  method: 'POST',
  data: { contents: [...] },
  timeout: 15000,
  requestId: req.requestId,
});
```

**Using specialized loggers:**
```javascript
const { logGeminiCall, logWhatsAppMessage, logWeatherCall } = require('./utils/apiLogger');

// Gemini
logGeminiCall('gemini-2.5-flash', prompt.length, true, 1500, null, requestId);

// WhatsApp
logWhatsAppMessage(to, true, null, requestId);

// Weather
logWeatherCall('Goa', true, { temperature: 28, condition: 'Clear' }, null, requestId);
```

### 4. Request ID Tracking

Request ID is automatically added to all logs within a request:

```javascript
// In middleware (automatic)
function requestLogger(req, res, next) {
  req.requestId = uuidv4();
  next();
}

// In controller (use it)
logger.info('Processing request', { requestId: req.requestId });

// In engine (pass it)
async getHotels(destination, budget, days, requestId) {
  logger.info('Getting hotels', { requestId });
}
```

---

## Log Format

### Console Output (Development)
```
[2024-01-15 10:30:00] info: User Action: 123456 - message_received [abc-123-def]
  {
    "category": "user",
    "userId": "123456",
    "action": "message_received",
    "details": "{\"messageLength\":15,\"hasTrip\":false}",
    "requestId": "abc-123-def"
  }
```

### File Output (Production - JSON)
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "User Action: 123456 - message_received",
  "category": "user",
  "userId": "123456",
  "action": "message_received",
  "details": "{\"messageLength\":15,\"hasTrip\":false}",
  "requestId": "abc-123-def",
  "service": "whatsapp-travel-bot",
  "environment": "production"
}
```

---

## Log Files

### Location
All logs are stored in `logs/` directory:

```
logs/
├── error.log       # Errors only (max 5MB, 5 files)
├── combined.log    # Everything (max 5MB, 5 files)
└── api.log         # API calls only (max 5MB, 5 files)
```

### Log Rotation
- Max file size: 5MB
- Max files: 5 (older files are deleted)
- Format: `error.log`, `error1.log`, `error2.log`, etc.

---

## Migration: Replace console.log/error

### Pattern 1: Simple console.log
**Before:**
```javascript
console.log("User:", from, "Action:", action);
```

**After:**
```javascript
logger.info('User action', { userId: from, action });
```

### Pattern 2: console.log with object
**Before:**
```javascript
console.log("Trip saved:", { destination, days, budget });
```

**After:**
```javascript
logger.info('Trip saved', { destination, days, budget });
```

### Pattern 3: console.error
**Before:**
```javascript
console.error("Error:", err.message, err.stack);
```

**After:**
```javascript
logger.error('Operation failed', {
  error: err.message,
  stack: err.stack,
});
```

### Pattern 4: Conditional logging
**Before:**
```javascript
if (process.env.DEBUG) {
  console.log("Debug info:", data);
}
```

**After:**
```javascript
logger.debug('Debug info', { data });
```

---

## Environment Variables

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Environment (affects console output)
NODE_ENV=production
```

### Log Levels Explained

| Level | When to Use | Example |
|-------|-------------|---------|
| `error` | Failures, crashes | API call failed, database error |
| `warn` | Potential issues | Missing optional data, retries |
| `info` | Important events | User actions, business events |
| `debug` | Detailed debugging | Request payloads, intermediate steps |

---

## Best Practices

### 1. Always Include Request ID
```javascript
// ✅ Good
logger.info('Processing', { requestId: req.requestId });

// ❌ Bad
logger.info('Processing');
```

### 2. Use Structured Data
```javascript
// ✅ Good
logger.info('User action', { userId: from, action: 'trip_saved' });

// ❌ Bad
logger.info(`User ${from} saved trip`);
```

### 3. Never Log Sensitive Data
```javascript
// ✅ Good
logger.info('API call', { endpoint: '/users' });

// ❌ Bad
logger.info('API call', { token: 'secret123', password: 'pass' });
```

### 4. Truncate Large Data
```javascript
// ✅ Good
logger.info('Request body', {
  body: JSON.stringify(body).substring(0, 500)
});

// ❌ Bad
logger.info('Request body', { body }); // Could be huge
```

### 5. Include Duration for Performance
```javascript
// ✅ Good
const startTime = Date.now();
// ... operation
logger.info('Operation complete', {
  duration: `${Date.now() - startTime}ms`
});

// ❌ Bad
logger.info('Operation complete');
```

### 6. Use Appropriate Log Level
```javascript
// ✅ Good
logger.error('Database connection failed', { error: err.message });
logger.warn('API retry attempt', { attempt: 2 });
logger.info('User logged in', { userId: '123' });
logger.debug('Processing request payload', { size: 1024 });

// ❌ Bad
logger.info('Error occurred'); // Should be error level
logger.error('User logged in'); // Should be info level
```

---

## Testing

### Test Logging System

```javascript
const logger = require('./src/config/logger');

// Test all log levels
logger.debug('Debug test');
logger.info('Info test');
logger.warn('Warn test');
logger.error('Error test');

// Test structured logging
logger.userAction({
  userId: 'test123',
  action: 'test_action',
  details: { foo: 'bar' },
});

// Check log files
cat logs/combined.log
cat logs/error.log
```

### Test Request Logger

```bash
# Start server
npm start

# Make request
curl http://localhost:3000/webhook

# Check logs - should see request ID
cat logs/combined.log | grep "requestId"
```

### Test API Logger

```javascript
const { apiCall } = require('./src/utils/apiLogger');

// Test successful call
const response = await apiCall({
  apiName: 'Test',
  endpoint: 'https://httpbin.org/get',
  requestId: 'test-123',
});

// Check api.log
cat logs/api.log
```

---

## Performance Considerations

### 1. Async Logging
Winston uses async logging by default - no blocking:
```javascript
// All transports are async
transports: [
  new winston.transports.File({ ... }) // Async
]
```

### 2. Log Level Filtering
Set appropriate log level for environment:
```bash
# Development - see everything
LOG_LEVEL=debug

# Production - only important logs
LOG_LEVEL=info
```

### 3. Truncate Large Data
Always truncate request/response bodies:
```javascript
body: JSON.stringify(data).substring(0, 500)
```

### 4. Avoid Logging in Hot Paths
Don't log inside tight loops:
```javascript
// ❌ Bad - logs every iteration
for (let i = 0; i < 1000; i++) {
  logger.info('Processing', { i });
}

// ✅ Good - log summary
logger.info('Processing complete', { total: 1000 });
```

---

## Production Deployment

### 1. Set Environment Variables
```bash
NODE_ENV=production
LOG_LEVEL=info
```

### 2. Monitor Log Files
```bash
# Watch error log in real-time
tail -f logs/error.log

# Search for specific request
grep "request-id-here" logs/combined.log

# Count errors by type
grep "error" logs/error.log | sort | uniq -c
```

### 3. Log Aggregation (Optional)
Integrate with log management services:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki**
- **Datadog**
- **New Relic**
- **Splunk**

### 4. Log Shipping
Use Filebeat or Fluentd to ship logs to centralized storage.

---

## Troubleshooting

### Problem: No logs appearing
**Solution:**
```bash
# Check if logs directory exists
ls -la logs/

# Check file permissions
chmod 755 logs/

# Check log level
echo $LOG_LEVEL
```

### Problem: Logs too verbose
**Solution:**
```bash
# Increase log level
export LOG_LEVEL=warn
```

### Problem: Performance issues
**Solution:**
```bash
# Reduce log level in production
export LOG_LEVEL=error

# Or disable file logging
# Comment out file transports in logger.js
```

### Problem: Log files too large
**Solution:**
Already handled by rotation (5MB max, 5 files). Adjust if needed:
```javascript
maxsize: 10 * 1024 * 1024, // 10MB
maxFiles: 10,
```

---

## Summary

With this logging system:
- ✅ All logs are structured and searchable
- ✅ Request tracking across entire flow
- ✅ API calls monitored with timing
- ✅ Privacy-safe (no sensitive data)
- ✅ Performance-friendly (async logging)
- ✅ Production-ready (rotation, levels)
- ✅ Developer-friendly (colorized console)

**Your bot now has enterprise-grade logging!** 📊

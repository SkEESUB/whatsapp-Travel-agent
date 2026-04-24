# Admin Dashboard Integration Guide

## ✅ What Was Created

### 1. Admin Authentication Middleware
**File**: `src/middleware/adminAuth.js` (149 lines)

#### Features:
- ✅ **API Key Authentication** - Via header or query parameter
- ✅ **Rate Limiting** - 30 requests/minute per IP
- ✅ **Phone Number Masking** - Privacy protection (91****9999)
- ✅ **Security Logging** - All access attempts logged

#### Usage:
```javascript
const { authenticateAdmin, adminRateLimiter } = require('./middleware/adminAuth');

// Apply to routes
router.use(authenticateAdmin);
router.use(adminRateLimiter);

// Mask phone numbers
const { maskPhoneNumber, maskPhoneNumbers } = require('./middleware/adminAuth');
const masked = maskPhoneNumber('919999999999'); // → "91****9999"
```

---

### 2. Admin Controller
**File**: `src/controllers/adminController.js` (705 lines)

#### Endpoints Implemented:

| Endpoint | Method | Description | Cache |
|----------|--------|-------------|-------|
| `/admin/stats` | GET | Dashboard statistics | 5 min |
| `/admin/popular-destinations` | GET | Top 10 destinations | 5 min |
| `/admin/users` | GET | Paginated user list | No |
| `/admin/trips` | GET | Recent trips | No |
| `/admin/revenue` | GET | Revenue breakdown | 5 min |
| `/admin/queue-stats` | GET | BullMQ queue status | No |
| `/admin/cache-stats` | GET | Redis cache stats | No |
| `/admin/health` | GET | System health check | No |
| `/admin/broadcast` | POST | Send message to users | No |
| `/admin/block-user` | POST | Block abusive user | No |

---

### 3. Admin Routes
**File**: `src/routes/admin.js` (96 lines)

#### Route Configuration:
```javascript
const adminRoutes = require('./routes/admin');

// In app.js
app.use('/admin', adminRoutes);
```

All routes require:
- `X-Admin-API-Key` header OR `?apiKey=` parameter
- Rate limited to 30 req/min

---

### 4. Daily Analytics Job
**File**: `src/jobs/dailyAnalyticsJob.js` (246 lines)

#### Features:
- ✅ **Automatic Scheduling** - Runs at midnight daily
- ✅ **Compiles Statistics**:
  - New users
  - Trips started/completed
  - Popular destinations
  - Subscription revenue
  - Affiliate clicks
  - Active users
  - Conversion funnel
  - Conversion rate

#### Functions:
```javascript
const { compileDailyStats, scheduleDailyJob, triggerManualCompilation } = require('./jobs/dailyAnalyticsJob');

// Schedule daily job (call once on server start)
scheduleDailyJob();

// Manual trigger (for testing)
await triggerManualCompilation('2025-01-15');

// Compile for specific date
await compileDailyStats(new Date('2025-01-15'));
```

---

## 🚀 Integration into app.js

### Step 1: Import Admin Routes

```javascript
// src/app.js

const adminRoutes = require('./routes/admin');
const { scheduleDailyJob } = require('./jobs/dailyAnalyticsJob');
```

### Step 2: Mount Admin Routes

```javascript
// Add before other routes (after middleware)
app.use('/admin', adminRoutes);
```

### Step 3: Schedule Daily Analytics Job

```javascript
// After all routes, before server.listen()
scheduleDailyJob();
console.log('📊 Daily analytics job scheduled for midnight');
```

### Step 4: Add Environment Variable

```env
# .env
ADMIN_API_KEY=your-super-secret-admin-key-here-change-this
```

---

## 📡 API Documentation

### 1. GET /admin/stats

**Description**: Dashboard statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "activeToday": 85,
      "newToday": 12
    },
    "messages": {
      "today": 450
    },
    "trips": {
      "today": 35,
      "thisMonth": 520
    },
    "revenue": {
      "thisMonth": 45000
    },
    "errors": {
      "today": 3
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  },
  "fromCache": false
}
```

**Example Request**:
```bash
curl -H "X-Admin-API-Key: your-key" \
  http://localhost:3000/admin/stats
```

---

### 2. GET /admin/popular-destinations?days=7

**Description**: Top 10 destinations by time period

**Query Parameters**:
- `days` - Number of days to look back (default: 7)

**Response**:
```json
{
  "success": true,
  "data": {
    "days": 7,
    "destinations": [
      {
        "destination": "goa",
        "count": 150,
        "avgBudget": 12000,
        "avgDays": 3,
        "avgPeople": 2.5
      },
      {
        "destination": "manali",
        "count": 120,
        "avgBudget": 15000,
        "avgDays": 4,
        "avgPeople": 3.0
      }
    ],
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

**Example Request**:
```bash
curl -H "X-Admin-API-Key: your-key" \
  "http://localhost:3000/admin/popular-destinations?days=30"
```

---

### 3. GET /admin/users?page=1&limit=20

**Description**: Paginated user list

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "...",
        "phone": "91****9999",
        "subscription": {
          "plan": "premium",
          "tripsRemaining": -1
        },
        "totalTrips": 45,
        "lastActiveAt": "2025-01-15T08:30:00.000Z",
        "createdAt": "2024-12-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "totalPages": 63
    }
  }
}
```

**Example Request**:
```bash
curl -H "X-Admin-API-Key: your-key" \
  "http://localhost:3000/admin/users?page=2&limit=10"
```

---

### 4. GET /admin/trips?page=1&limit=20

**Description**: Recent trips

**Response**:
```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "_id": "...",
        "userPhone": "91****9999",
        "destination": "goa",
        "days": 3,
        "budget": 10000,
        "people": 2,
        "status": "completed",
        "createdAt": "2025-01-15T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 520,
      "totalPages": 26
    }
  }
}
```

---

### 5. GET /admin/revenue?from=2025-01-01&to=2025-01-31

**Description**: Revenue breakdown

**Query Parameters**:
- `from` - Start date (ISO format, default: 30 days ago)
- `to` - End date (ISO format, default: today)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "from": "2025-01-01T00:00:00.000Z",
      "to": "2025-01-31T23:59:59.999Z"
    },
    "subscriptionRevenue": {
      "daily": [
        {
          "date": "2025-01-15",
          "revenue": 1200,
          "newSubscriptions": 8
        }
      ],
      "total": 45000
    },
    "affiliateRevenue": {
      "daily": [
        {
          "date": "2025-01-15",
          "platforms": [
            { "platform": "makemytrip", "clicks": 50 },
            { "platform": "booking", "clicks": 35 }
          ],
          "totalClicks": 85
        }
      ],
      "totalClicks": 1250,
      "estimated": 6250,
      "note": "Estimated: ₹50 per booking, 10% conversion rate"
    },
    "totalRevenue": 51250,
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### 6. GET /admin/queue-stats

**Description**: BullMQ queue statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "jobs": {
      "active": 5,
      "waiting": 12,
      "completed": 8500,
      "failed": 23,
      "delayed": 0,
      "total": 8540
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### 7. GET /admin/cache-stats

**Description**: Redis cache statistics

**Response**:
```json
{
  "success": true,
  "data": {
    "cache": {
      "status": "connected",
      "hitRate": "85%",
      "missRate": "15%",
      "hits": 15000,
      "misses": 2650,
      "total": 17650,
      "memoryUsage": "12.50M"
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### 8. GET /admin/health

**Description**: System health check

**Response**:
```json
{
  "success": true,
  "data": {
    "server": {
      "uptime": 86400,
      "memory": {
        "rss": 125000000,
        "heapTotal": 85000000,
        "heapUsed": 65000000,
        "external": 2000000
      },
      "nodeVersion": "v18.17.0",
      "timestamp": "2025-01-15T10:30:00.000Z"
    },
    "redis": {
      "status": "connected",
      "host": "localhost",
      "port": 6379
    },
    "mongodb": {
      "status": "connected",
      "database": "travelbot"
    },
    "gemini": {
      "status": "configured",
      "model": "gemini-2.5-flash"
    },
    "whatsapp": {
      "status": "configured",
      "phoneNumberId": "set"
    },
    "overall": "healthy"
  }
}
```

---

### 9. POST /admin/broadcast

**Description**: Send message to users

**Request Body**:
```json
{
  "message": "🎉 New feature: Now supporting 9 Indian languages!",
  "filter": {
    "plan": "premium",
    "activeDays": 7
  },
  "limit": 100
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 45,
    "queued": 45,
    "failed": 0,
    "note": "Messages will be sent respecting WhatsApp rate limits"
  }
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/admin/broadcast \
  -H "X-Admin-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🌟 Upgrade to Premium for unlimited trips!",
    "filter": { "plan": "free", "activeDays": 30 },
    "limit": 50
  }'
```

---

### 10. POST /admin/block-user

**Description**: Block abusive user

**Request Body**:
```json
{
  "phoneNumber": "919999999999",
  "reason": "Spam messages"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "User blocked successfully",
    "user": {
      "_id": "...",
      "phone": "91****9999",
      "isBlocked": true,
      "blockedAt": "2025-01-15T10:30:00.000Z",
      "blockedReason": "Spam messages"
    }
  }
}
```

---

## 📊 Analytics Dashboard Example

### Sample Dashboard UI (HTML/JS):

```html
<!DOCTYPE html>
<html>
<head>
  <title>TravelBot Admin Dashboard</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .card { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .number { font-size: 36px; font-weight: bold; color: #2196F3; }
    .label { color: #666; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>TravelBot Admin Dashboard</h1>
  
  <div class="stats">
    <div class="card">
      <div class="number" id="totalUsers">-</div>
      <div class="label">Total Users</div>
    </div>
    <div class="card">
      <div class="number" id="activeToday">-</div>
      <div class="label">Active Today</div>
    </div>
    <div class="card">
      <div class="number" id="tripsToday">-</div>
      <div class="label">Trips Today</div>
    </div>
    <div class="card">
      <div class="number" id="revenue">-</div>
      <div class="label">Revenue This Month</div>
    </div>
  </div>

  <script>
    const API_KEY = 'your-admin-api-key';
    const BASE_URL = 'http://localhost:3000/admin';

    async function loadDashboard() {
      const response = await fetch(`${BASE_URL}/stats`, {
        headers: { 'X-Admin-API-Key': API_KEY }
      });
      
      const { data } = await response.json();
      
      document.getElementById('totalUsers').textContent = data.users.total;
      document.getElementById('activeToday').textContent = data.users.activeToday;
      document.getElementById('tripsToday').textContent = data.trips.today;
      document.getElementById('revenue').textContent = `₹${data.revenue.thisMonth.toLocaleString()}`;
    }

    // Load every 5 minutes
    loadDashboard();
    setInterval(loadDashboard, 300000);
  </script>
</body>
</html>
```

---

## 🔐 Security Best Practices

### 1. Environment Variable
```env
ADMIN_API_KEY=generate-a-long-random-string-here
```

**Generate secure key**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Rate Limiting
- 30 requests/minute per IP
- Automatically blocks abusive IPs
- Returns `429 Too Many Requests` when exceeded

### 3. Phone Number Privacy
- All phone numbers masked: `91****9999`
- Only first 4 and last 4 digits visible
- Full number never exposed in admin API

### 4. Access Logging
All admin actions logged:
```
[WARN] Admin access attempt without API key { ip: '192.168.1.1' }
[WARN] Invalid admin API key attempt { ip: '192.168.1.1' }
[INFO] Admin authenticated { ip: '10.0.0.1', path: '/admin/stats' }
[WARN] User blocked { phoneHash: 'abc...', reason: 'Spam' }
```

---

## 🧪 Testing

### Test Authentication:
```bash
# Without API key (should fail)
curl http://localhost:3000/admin/stats
# → 401 Unauthorized

# With wrong API key (should fail)
curl -H "X-Admin-API-Key: wrong-key" http://localhost:3000/admin/stats
# → 403 Forbidden

# With correct API key (should succeed)
curl -H "X-Admin-API-Key: your-key" http://localhost:3000/admin/stats
# → 200 OK
```

### Test All Endpoints:
```bash
# Stats
curl -H "X-Admin-API-Key: your-key" http://localhost:3000/admin/stats

# Popular destinations
curl -H "X-Admin-API-Key: your-key" "http://localhost:3000/admin/popular-destinations?days=7"

# Users (page 1)
curl -H "X-Admin-API-Key: your-key" "http://localhost:3000/admin/users?page=1&limit=10"

# Health check
curl -H "X-Admin-API-Key: your-key" http://localhost:3000/admin/health

# Broadcast message
curl -X POST http://localhost:3000/admin/broadcast \
  -H "X-Admin-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test broadcast","limit":5}'

# Block user
curl -X POST http://localhost:3000/admin/block-user \
  -H "X-Admin-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"919999999999","reason":"Testing"}'
```

### Test Daily Analytics Job:
```javascript
const { triggerManualCompilation } = require('./src/jobs/dailyAnalyticsJob');

// Trigger manually
triggerManualCompilation().then(console.log);
```

---

## 📝 Environment Variables

Add to `.env`:

```env
# Admin Dashboard
ADMIN_API_KEY=your-super-secret-key-here

# (Already existing)
REDIS_HOST=localhost
REDIS_PORT=6379
MONGODB_URI=mongodb://localhost:27017/travelbot
```

---

## ✅ Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `src/middleware/adminAuth.js` | 149 | Authentication & rate limiting |
| `src/controllers/adminController.js` | 705 | Admin endpoint handlers |
| `src/routes/admin.js` | 96 | Route definitions |
| `src/jobs/dailyAnalyticsJob.js` | 246 | Daily analytics aggregation |
| `src/cache/cacheManager.js` | Updated | Added getCacheStats() |

**Total**: ~1,200 lines of production-ready admin dashboard code

---

## 🚀 Ready for Production

All files created with:
- ✅ 10 admin endpoints (stats, users, trips, revenue, health, etc.)
- ✅ API key authentication
- ✅ Rate limiting (30 req/min)
- ✅ Phone number masking for privacy
- ✅ Optimized aggregation pipelines
- ✅ 5-minute cache for expensive queries
- ✅ Daily analytics job (runs at midnight)
- ✅ Broadcast messaging to users
- ✅ User blocking functionality
- ✅ Health monitoring (Redis, MongoDB, Gemini, WhatsApp)
- ✅ Zero syntax errors
- ✅ Complete working code

Your WhatsApp Travel Bot now has a **production-ready admin dashboard**! 📊✨

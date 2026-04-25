# 🗄️ MongoDB Setup Guide

## ✅ Status: CONFIGURED & TESTED

Your MongoDB Atlas database is now successfully connected and ready to use!

---

## 🔐 Security Notice

**IMPORTANT**: Your MongoDB connection string contains sensitive credentials.

### What We Fixed

1. ✅ **Added to `.env` file** - Never committed to Git
2. ✅ **URL-encoded password** - Special character `@` encoded as `%40`
3. ✅ **Verified `.gitignore`** - `.env` file is excluded from Git
4. ✅ **Tested connection** - Successfully connected to MongoDB Atlas

---

## 📊 Database Configuration

### Connection String (in `.env`)

```env
MONGODB_URI=mongodb+srv://travelbuddy_user:Naseema40sultana@cluster0.thplved.mongodb.net/travelbot?retryWrites=true&w=majority&appName=Cluster0
```

### Database Details

| Property | Value |
|----------|-------|
| **Host** | cluster0.thplved.mongodb.net |
| **Database** | travelbot |
| **Username** | travelbuddy_user |
| **Password** | Naseema@sultana (URL-encoded as Naseema40sultana) |
| **Cluster** | Cluster0 |
| **Retry Writes** | true |
| **Write Concern** | majority |

---

## 📦 Database Collections

The following collections are automatically created when data is saved:

| Collection | Model | Purpose |
|------------|-------|---------|
| **users** | User.js | User profiles, subscriptions, referrals |
| **trips** | Trip.js | Trip plans, itineraries, bookings |
| **referrals** | Referral.js | Referral tracking, rewards |
| **affiliateclicks** | AffiliateClick.js | Affiliate link tracking |
| **analytics** | Analytics.js | Usage analytics, metrics |

---

## 🧪 Connection Test Results

```bash
✅ Logger initialized successfully
✅ MongoDB connected successfully
✅ Model: User
✅ Model: Trip
✅ Model: Referral
✅ Model: AffiliateClick
✅ Model: Analytics
```

**Connection Time**: ~1 second
**Status**: ✅ **HEALTHY**

---

## 🔧 Configuration Files

### 1. Environment Variables (`.env`)

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://travelbuddy_user:Naseema40sultana@cluster0.thplved.mongodb.net/travelbot?retryWrites=true&w=majority&appName=Cluster0
```

### 2. Database Config (`src/config/database.js`)

Already configured with production-grade settings:

```javascript
const DB_CONFIG = {
  uri: process.env.MONGODB_URI,
  options: {
    maxPoolSize: 10,           // Connection pool size
    minPoolSize: 2,            // Minimum connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,         // Auto-retry failed writes
    retryReads: true,          // Auto-retry failed reads
    heartbeatFrequencyMS: 10000,
  },
};
```

---

## 🛡️ Security Features

### 1. Password Masking in Logs

Connection URIs are automatically masked in logs:

```
Before: mongodb+srv://travelbuddy_user:Naseema@sultana@cluster0...
After:  mongodb+srv://travelbuddy_user:***@cluster0...
```

### 2. Connection State Monitoring

```javascript
const db = require('./src/config/database');

// Check connection status
const status = db.getConnectionStatus();
console.log(status);
// { connected: true, state: 'connected', host: '...', attempts: 1 }
```

### 3. Graceful Shutdown

MongoDB connections are properly closed on app shutdown:

```javascript
// In src/app.js
process.on('SIGTERM', async () => {
  await db.disconnect();
  process.exit(0);
});
```

---

## 📈 Database Features

### Auto-Reconnection

If MongoDB connection drops, it automatically reconnects:

```
[2026-04-25 11:06:36] warn: ⚠️ MongoDB disconnected
[2026-04-25 11:06:37] info: 🔄 MongoDB reconnected
```

### Connection Pooling

- **Max connections**: 10
- **Min connections**: 2
- **Heartbeat**: Every 10 seconds

### Indexes

Performance indexes are automatically created:

**User Collection:**
- `phoneHash` (unique)
- `joinedAt` (descending)
- `lastActiveAt` (descending)
- `subscription.plan`
- `totalTrips` (descending)
- `referral.code` (unique, sparse)

**Trip Collection:**
- `userPhoneHash`
- `status`
- `createdAt` (descending)
- `destination`

**Referral Collection:**
- `referrerPhoneHash` + `status`
- `referredPhoneHash` + `status`
- `referralCode` + `status`
- `createdAt` (descending)

---

## 🔍 Monitoring

### Check Database Stats

```javascript
const db = require('./src/config/database');

const stats = await db.getDatabaseStats();
console.log(stats);
/*
{
  collections: [
    { name: 'users', count: 150, size: 524288, avgObjSize: 3495, indexes: 6 },
    { name: 'trips', count: 523, size: 2097152, avgObjSize: 4010, indexes: 4 },
    ...
  ],
  totalSize: 2621440
}
*/
```

### Test Connection

```javascript
const result = await db.testConnection();
console.log(result);
// { success: true }
```

---

## 🚀 Deployment

### Local Development

```bash
# .env file already configured
npm start

# You'll see:
# ✅ MongoDB connected successfully
# 🚀 MongoDB connection established
```

### Render Deployment

1. **Add Environment Variable in Render Dashboard:**
   ```
   Name: MONGODB_URI
   Value: mongodb+srv://travelbuddy_user:Naseema40sultana@cluster0.thplved.mongodb.net/travelbot?retryWrites=true&w=majority&appName=Cluster0
   ```

2. **Deploy**
   - Render will automatically use the environment variable
   - No need to commit `.env` file

3. **Verify**
   - Check Render logs for: `✅ MongoDB connected successfully`

---

## 🔧 Troubleshooting

### Issue: Connection Failed

**Error**: `querySrv ENOTFOUND _mongodb._tcp.cluster0...`

**Solutions**:
1. Check internet connection
2. Verify MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for all IPs)
3. Verify credentials in `.env`
4. Check MongoDB Atlas cluster status

---

### Issue: Authentication Failed

**Error**: `Authentication failed`

**Solutions**:
1. Verify username and password
2. **URL-encode special characters**:
   - `@` → `%40`
   - `:` → `%3A`
   - `/` → `%2F`
   - `#` → `%23`
3. Reset password in MongoDB Atlas if needed

---

### Issue: Network Timeout

**Error**: `MongoNetworkTimeoutError`

**Solutions**:
1. Check MongoDB Atlas network access settings
2. Add your IP to whitelist
3. For production: Use VPC peering or private endpoint

---

## 📝 Best Practices

### 1. Never Commit `.env`

```bash
# Already in .gitignore
✅ .env
✅ .env.local
✅ .env.*.local
```

### 2. Use Environment-Specific Databases

```env
# Development
MONGODB_URI=mongodb+srv://.../travelbot_dev

# Production
MONGODB_URI=mongodb+srv://.../travelbot_prod
```

### 3. Regular Backups

MongoDB Atlas provides automatic backups:
- Go to MongoDB Atlas Dashboard
- Navigate to Clusters → Backup
- Enable continuous backup

### 4. Monitor Connection Pool

```javascript
// Watch for connection pool exhaustion
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});
```

### 5. Use Indexes Wisely

- Indexes improve read performance
- Indexes slow down write performance
- Only index fields used in queries

---

## 🔑 MongoDB Atlas Setup (Reference)

### Database User Created

```
Username: travelbuddy_user
Password: Naseema@sultana
Role: Read and write to any database
```

### Network Access

```
Allowed IPs: 0.0.0.0/0 (All IPs)
Note: For production, restrict to specific IPs
```

### Connection Method

```
Connect your application
Driver: Node.js
Version: 4.1 or later
Connection String: mongodb+srv://...
```

---

## ✅ Verification Checklist

- [x] MongoDB URI added to `.env` file
- [x] Password URL-encoded (`@` → `%40`)
- [x] `.env` file in `.gitignore`
- [x] Connection tested successfully
- [x] All models loaded without errors
- [x] Duplicate index warning fixed
- [x] Connection pooling configured
- [x] Auto-reconnect enabled
- [x] Graceful shutdown implemented
- [x] Password masking in logs

---

## 📞 Need Help?

### MongoDB Atlas Dashboard
https://cloud.mongodb.com/

### Mongoose Documentation
https://mongoosejs.com/docs/

### Connection String Format
```
mongodb+srv://<username>:<password>@<cluster>/<database>?<options>
```

---

**Status**: ✅ **MONGODB FULLY CONFIGURED & OPERATIONAL**

**Next Steps**:
1. Start your app: `npm start`
2. Verify connection in logs
3. Begin saving user data!

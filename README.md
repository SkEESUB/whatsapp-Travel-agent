# TravelBuddy — WhatsApp AI Travel Assistant

TravelBuddy is a production-grade, highly scalable WhatsApp Chatbot built from scratch using Node.js, Express, MongoDB, and Redis. It allows users to plan customized travel itineraries, request local food guides, view weather forecasts, calculate budgets, and receive booking recommendations—all from a single, simple text or voice message on WhatsApp.

---

## 🚀 Key Features

* **AI-Powered Trip Planning**: Integrates with Google Gemini API to parse free-form inputs (e.g. *"Goa 3 days 15000 budget for 2 people"*) and output day-wise itineraries, local travel guides, and budget breakdowns.
* **Affiliate Monetization**: Automatically generates monetized booking links for flights, hotels, trains, and buses with built-in click analytics and URL shortening.
* **Premium Subscriptions**: Fully integrated with Razorpay Payment Links API and Webhooks to support Free, Basic, and Premium subscription plans.
* **Multi-Language Support**: Complete internationalization for English, Hindi, Telugu, Tamil, Marathi, Bengali, Gujarati, Kannada, and Malayalam.
* **Voice & Image Recognition**: Voice message transcription using OpenAI Whisper API and landmark identification using Gemini Vision API.
* **Robust Task Queuing**: Utilizes BullMQ backed by Redis to manage background workers and handle high volume spikes (1,00,000+ concurrent users).
* **Process Management**: Configured for PM2 cluster mode to utilize multi-core server processors.

---

## 🛠️ Complete Tech Stack

* **Runtime**: Node.js 20
* **Framework**: Express.js
* **AI & LLM**: Google Gemini API (`gemini-1.5-flash`), OpenAI Whisper API
* **Database**: MongoDB with Mongoose ODM
* **Cache & Sessions**: Redis via `ioredis`
* **Message Queue**: BullMQ
* **Payments**: Razorpay SDK
* **Process Manager**: PM2
* **Containerization**: Docker & Docker Compose
* **Load Balancer**: Nginx
* **Logging**: Winston with daily file rotation
* **Testing Framework**: Jest & Supertest

---

## 📁 Project Structure

```text
whatsapp-travel-bot/
├── docker/
│   ├── Dockerfile             # Production-grade multi-stage container file
│   └── docker-compose.yml     # Composed stack for App, Redis, MongoDB, Nginx
├── nginx/
│   └── nginx.conf             # Nginx load-balancing and SSL configuration
├── scripts/
│   ├── deploy.sh              # Direct deployment commands
│   ├── seed.sh                # Local DB seeding script (creates test user)
│   └── healthcheck.sh         # Container health inspection script
├── src/
│   ├── app.js                 # Express server configuration
│   ├── server.js              # Server entry point
│   ├── cache/
│   │   └── cacheManager.js    # Redis cache-through wrappers
│   ├── config/
│   │   ├── env.js             # Environment validator
│   │   ├── database.js        # MongoDB database connector
│   │   ├── redis.js           # Redis client singleton
│   │   └── logger.js          # Winston logs configuration
│   ├── controllers/
│   │   ├── adminController.js # Admin dashboard and stats
│   │   ├── paymentController.js # Payment webhook & link creation
│   │   └── webhookController.js # Main WhatsApp message flow orchestrator
│   ├── engine/
│   │   ├── contextManager.js  # Conversational state transitions
│   │   ├── intentDetector.js  # Intent classification rules
│   │   ├── nlpParser.js       # Indian format number & text parsing
│   │   └── travelEngine.js    # AI travel orchestration logic
│   ├── middleware/
│   │   ├── errorHandler.js    # Global fail-safe exception middleware
│   │   ├── rateLimiter.js     # Redis-backed sliding window limiter
│   │   └── webhookVerifier.js # Facebook X-Hub signature verification
│   ├── models/
│   │   ├── User.js            # User schemas, referral, and subscription
│   │   ├── Trip.js            # Planned trips and user feedback
│   │   └── Transaction.js     # Payment audit logging
│   └── utils/
│       ├── linkShortener.js   # Built-in Redis short link generator
│       └── retryHelper.js     # Exponential backoff retry utility
├── tests/
│   ├── unit/                  # NLP, Session, Intent, and Cache tests
│   └── integration/           # Webhook processing, Trip planning, and Payments
├── jest.config.js             # Testing suite parameters
└── README.md                  # Comprehensive Documentation
```

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the root directory based on `.env.example`:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
API_BASE_URL=http://localhost:3000

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_APP_SECRET=your_app_secret

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# OpenAI (Whisper voice transcription)
OPENAI_API_KEY=your_openai_api_key

# Databases
MONGODB_URI=mongodb://localhost:27017/travelbot
REDIS_URL=redis://localhost:6379

# Razorpay Payments
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

---

## 🚀 Getting Started

### Local Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Initial Database**:
   Seeding generates a mock premium user (Phone: `919999999999`) and mock transaction history to preview the dashboard instantly.
   ```bash
   chmod +x scripts/seed.sh
   ./scripts/seed.sh
   ```

3. **Start Development Mode**:
   ```bash
   npm run dev
   ```

### Running with Docker

Start the entire load-balanced application stack (App + Nginx + Redis + MongoDB):
```bash
npm run docker:up
```

Stop the stack:
```bash
npm run docker:down
```

---

## 🧪 Running the Test Suite

Execute the comprehensive Jest test suite covering units and integration flows:
```bash
npm run test
```

For coverage reports:
```bash
npx jest --coverage
```

---

## 📋 API Endpoints

### WhatsApp Webhook
* `GET /webhook`: Verification endpoint for WhatsApp API setup.
* `POST /webhook`: Message receiver endpoint (applies X-Hub security signature checks, input validator, and sliding window rate limits).

### Subscriptions & Payments
* `GET /payment/plans`: Fetch available Free, Basic, and Premium subscription config details.
* `POST /payment/create-link`: Generate a Razorpay payment link for user billing.
* `POST /payment/webhook`: Razorpay verification endpoint (captured, failed, link paid).

### Admin Dashboard API
*(Requires `x-admin-api-key` header matching configuration)*
* `GET /admin/stats`: General operational metadata (active users, total trips).
* `GET /admin/users`: Paginated, masked user accounts list.
* `GET /admin/trips`: Paginated listing of planned trips.
* `GET /admin/popular-destinations`: Top destinations and analytics.
* `GET /admin/revenue`: Transaction stats and daily revenue trends.
* `GET /admin/queue-stats`: BullMQ job execution status.
* `GET /admin/cache-stats`: Redis cache hit/miss details.
* `POST /admin/broadcast`: Send messaging alerts to user groups.
* `POST /admin/block-user`: Lock abusive user accounts.

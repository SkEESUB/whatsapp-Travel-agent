# Input Validation & NLP Parser - Integration Guide

## Overview
This guide explains the comprehensive input validation and NLP parsing system for the WhatsApp Travel Bot.

**Features**:
- ✅ Webhook payload validation
- ✅ Message sanitization (XSS, SQL injection protection)
- ✅ Spam protection (length limits)
- ✅ Natural language trip parsing
- ✅ Indian number formats (10k, 1L, etc.)
- ✅ City name aliases and misspellings
- ✅ Conversational follow-up for missing fields
- ✅ Multi-language support (Hinglish)

---

## Files Created

### 1. `src/middleware/inputValidator.js` (245 lines)
Input validation and sanitization:
- Validates WhatsApp webhook payload structure
- Rejects empty/invalid messages
- Strips HTML tags and injection patterns
- Limits message length (500 chars max)
- Normalizes Unicode
- Validates phone numbers

### 2. `src/engine/nlpParser.js` (432 lines)
Natural language parser:
- Parses various input formats
- Extracts: source, destination, days, budget, people, preferences
- Handles Indian number formats (k, L, crores)
- 25+ city aliases and misspellings
- Detects travel preferences (adventure, religious, etc.)
- Returns missing fields for follow-up

### 3. `src/utils/followUpManager.js` (407 lines)
Conversational follow-up:
- Tracks which fields are missing
- Asks targeted follow-up questions
- Validates user responses
- Builds complete trip from partial inputs
- Defaults people to 1 if not specified

---

## Integration

### Step 1: Add Input Validator to Routes

**File: `src/routes/webhook.js`**

```javascript
const express = require('express');
const axios = require('axios');
const webhookController = require('../controllers/webhookController');
const { validateInput } = require('../middleware/inputValidator');

const router = express.Router();

// Verify webhook (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive messages (POST) - with validation
router.post('/', validateInput, async (req, res) => {
  try {
    res.sendStatus(200);
    await webhookController.handleMessage(req, res, sendMessage);
  } catch (err) {
    console.error('❌ Webhook route error:', err);
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

async function sendMessage(to, text) {
  // ... existing code
}

module.exports = router;
```

### Step 2: Update Webhook Controller

**File: `src/controllers/webhookController.js`**

```javascript
const sessionManager = require('../utils/sessionManager');
const travelEngine = require('../engine/travelEngine');
const { parseTripDetails, isCommand, isGreeting } = require('../engine/nlpParser');
const followUpManager = require('../utils/followUpManager');
const logger = require('../config/logger');

class WebhookController {
  
  async handleMessage(req, res, sendMessageFn) {
    try {
      const requestId = req.requestId;
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      
      if (!value?.messages) {
        logger.debug('No messages in webhook', { requestId });
        return;
      }

      const msg = value.messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim();

      if (!text) {
        logger.debug('Empty message', { from, requestId });
        return;
      }

      const session = this.getSession(from);

      logger.userAction({
        userId: from,
        action: 'message_received',
        details: { textLength: text.length },
        requestId,
      });

      // Check if in follow-up mode
      if (session.followUp?.awaitingField) {
        await this.handleFollowUpResponse(from, text, session, sendMessageFn, requestId);
        return;
      }

      // Route message
      await this.routeMessage(from, text, session, sendMessageFn, requestId);

    } catch (err) {
      logger.error('Webhook handler error', {
        error: err.message,
        stack: err.stack,
      });
    }
  }

  async routeMessage(from, text, session, sendMessageFn, requestId) {
    const lower = text.toLowerCase().trim();

    // Greeting
    if (isGreeting(text)) {
      await sendMessageFn(from, this.getGreetingMessage());
      return;
    }

    // Commands
    if (isCommand(text)) {
      await this.handleCommand(from, lower, session, sendMessageFn, requestId);
      return;
    }

    // Parse trip details
    const parsed = parseTripDetails(text);

    if (parsed.confidence >= 50) {
      // Has some useful information
      await this.handleParsedTrip(from, parsed, session, sendMessageFn, requestId);
      return;
    }

    // Unknown input
    await sendMessageFn(from, this.getFallbackMessage());
  }

  async handleParsedTrip(from, parsed, session, sendMessageFn, requestId) {
    // Start follow-up if fields are missing
    const followUp = followUpManager.startFollowUp(session, parsed);

    if (followUp.complete) {
      // All fields present - save trip
      await this.handleTripSave(from, session, followUp.trip, sendMessageFn, requestId);
      return;
    }

    // Ask follow-up question
    if (followUp.inFollowUp) {
      await sendMessageFn(from, followUp.question);
      return;
    }

    // Should not reach here
    await sendMessageFn(from, this.getFallbackMessage());
  }

  async handleFollowUpResponse(from, text, session, sendMessageFn, requestId) {
    const result = followUpManager.processFollowUpResponse(session, text);

    if (!result.success) {
      // Invalid response - ask again
      await sendMessageFn(from, result.error + '\\n\\n' + result.retryQuestion);
      return;
    }

    if (result.complete) {
      // Trip complete - save it
      await this.handleTripSave(from, session, result.trip, sendMessageFn, requestId);
      return;
    }

    // Ask next question
    await sendMessageFn(from, result.nextQuestion);
  }

  async handleTripSave(from, session, trip, sendMessageFn, requestId) {
    try {
      const savedTrip = sessionManager.saveTrip(session, trip);

      logger.businessEvent({
        event: 'trip_saved',
        data: {
          userId: from,
          destination: savedTrip.destination,
          days: savedTrip.days,
          budget: savedTrip.budget,
        },
        requestId,
      });

      await sendMessageFn(from, `✅ Trip Saved!

📍 ${savedTrip.destination}
📅 ${savedTrip.days} days
💰 ₹${savedTrip.budget}
👥 ${savedTrip.people}
💵 Per person: ₹${savedTrip.perPersonBudget}

Reply:
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
7️⃣ Weather
8️⃣ Food`);

      // Reset follow-up
      followUpManager.resetFollowUp(session);

    } catch (err) {
      logger.error('Trip save error', {
        error: err.message,
        requestId,
      });
      await sendMessageFn(from, '⚠️ Error saving trip. Please try again.');
    }
  }

  async handleCommand(from, lower, session, sendMessageFn, requestId) {
    // ... existing command handling
  }

  getSession(user) {
    return sessionManager.getSession(user);
  }

  getGreetingMessage() {
    return `👋 Hello! Welcome to TravelBot ✈️

Send trip details like:
• "Goa 3 days 10000 2 people"
• "I want to visit Manali for 5 days"
• "Plan Goa trip under 15k"

Or reply:
1️⃣ Plan Trip
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
6️⃣ Help`;
  }

  getFallbackMessage() {
    return `❓ I didn't understand.

Try sending:
• "Goa 3 days 10000 2 people"
• "Plan trip to Manali"
• "I want to visit Kerala"

Or type "help" for options.`;
  }
}

module.exports = new WebhookController();
```

---

## Usage Examples

### Example 1: Complete Trip Details
```
User: "Goa 3 days 10000 2 people"

Parsed: {
  destination: "goa",
  days: 3,
  budget: 10000,
  people: 2,
  missing: [],
  confidence: 100
}

Bot: "✅ Trip Saved! ..."
```

### Example 2: Natural Language
```
User: "I want to go to Goa for 3 days with budget 10000 for 2 people"

Parsed: {
  destination: "goa",
  days: 3,
  budget: 10000,
  people: 2,
  missing: [],
  confidence: 100
}

Bot: "✅ Trip Saved! ..."
```

### Example 3: Indian Number Format
```
User: "Manali trip, 5 days, 15k budget, 2 persons"

Parsed: {
  destination: "manali",
  days: 5,
  budget: 15000,
  people: 2,
  missing: [],
  confidence: 100
}

Bot: "✅ Trip Saved! ..."
```

### Example 4: Missing Fields → Follow-up
```
User: "Goa trip"

Parsed: {
  destination: "goa",
  days: null,
  budget: null,
  people: 1,
  missing: ["days", "budget"],
  confidence: 50
}

Bot: "📅 How many days is your trip?

Example: 3 days"

User: "3"

Bot: "💰 What's your total budget?

Example: 10000 or 10k"

User: "10k"

Bot: "✅ Trip Saved! ..."
```

### Example 5: Mixed Language (Hinglish)
```
User: "Goa jana hai 3 din 10000 mein"

Parsed: {
  destination: "goa",
  days: 3,
  budget: 10000,
  people: 1,
  missing: [],
  confidence: 75
}

Bot: "✅ Trip Saved! ..."
```

### Example 6: City Alias
```
User: "Bombay 2 days 5000"

Parsed: {
  destination: "mumbai",  // "bombay" → "mumbai"
  days: 2,
  budget: 5000,
  people: 1,
  missing: [],
  confidence: 100
}

Bot: "✅ Trip Saved! ..."
```

---

## Supported Formats

### Trip Details
- `"Goa 3 days 10000 2 people"`
- `"I want to go to Goa for 3 days"`
- `"goa, 3 days, 10k budget, 2 persons"`
- `"Plan a trip to Manali for weekend under 15000"`
- `"Mumbai to Goa 3 days 2 people 10000 budget"`
- `"Goa trip"` (missing info → bot asks)
- `"3 days goa 10000"`
- `"Goa jana hai 3 din 10000 mein"` (Hinglish)

### Budget Formats
- `10000` → 10000
- `10k` → 10000
- `1L` → 100000
- `1.5L` → 150000
- `10,000` → 10000

### Duration Formats
- `3 days` → 3
- `weekend` → 2
- `1 week` → 7
- `2 weeks` → 14
- `3 nights` → 4

### People Formats
- `2 people` → 2
- `family` → 4
- `couple` → 2
- `solo` → 1

---

## Security Features

### XSS Protection
```javascript
// Input: "<script>alert('XSS')</script> Goa"
// Sanitized: "[REMOVED] Goa"
```

### SQL Injection Protection
```javascript
// Input: "'; DROP TABLE users; -- Goa"
// Sanitized: "[REMOVED] [REMOVED] [REMOVED] Goa"
```

### Length Limit
```javascript
// Input: 2000 character message
// Result: Truncated to 500 characters
```

### HTML Stripping
```javascript
// Input: "<b>Goa</b> trip"
// Sanitized: "Goa trip"
```

---

## City Aliases (25+ cities)

| City | Aliases |
|------|---------|
| Mumbai | bombay, bmbai, mumabi, mumba |
| Delhi | new delhi, nd, dilli, delhi ncr |
| Bangalore | bengaluru, blr, banglore |
| Hyderabad | hyd, hyderbad, hydrabad |
| Chennai | madras, chn, chenai |
| Kolkata | calcutta, ccu, kolcata |
| Goa | panaji, panjim, north goa, south goa |
| Jaipur | pink city, jipur, jaiput |
| Varanasi | benaras, kashi, banaras |
| ... | ... |

---

## Testing

### Test Input Validation
```bash
# Valid message
curl -X POST http://localhost:3000/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"1234567890","text":{"body":"Goa 3 days 10000 2 people"}}]}}]}]}'

# Empty message (should return 200, ignore)
curl -X POST http://localhost:3000/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"1234567890","text":{"body":""}}]}}]}]}'

# XSS attempt (should be sanitized)
curl -X POST http://localhost:3000/webhook \\
  -H "Content-Type: application/json" \\
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"1234567890","text":{"body":"<script>alert(1)</script> Goa"}}]}}]}]}'
```

### Test NLP Parser
```javascript
const { parseTripDetails } = require('./src/engine/nlpParser');

console.log(parseTripDetails('Goa 3 days 10000 2 people'));
console.log(parseTripDetails('I want to visit Manali for 5 days'));
console.log(parseTripDetails('Bombay trip under 10k'));
console.log(parseTripDetails('Goa jana hai 3 din'));
```

---

## Best Practices

### 1. Always Validate Input
```javascript
// ✅ Good
router.post('/webhook', validateInput, handler);

// ❌ Bad
router.post('/webhook', handler);
```

### 2. Use NLP Parser for Trip Details
```javascript
// ✅ Good
const parsed = parseTripDetails(text);

// ❌ Bad - manual regex
const match = text.match(/(\\w+)\\s+(\\d+)\\s+days?/);
```

### 3. Handle Follow-up Gracefully
```javascript
// ✅ Good
if (session.followUp?.awaitingField) {
  await handleFollowUpResponse(from, text, session);
}

// ❌ Bad - ignore follow-up
await routeMessage(from, text, session);
```

### 4. Log User Actions
```javascript
// ✅ Good
logger.userAction({
  userId: from,
  action: 'trip_parsed',
  details: parsed,
});

// ❌ Bad
console.log('User:', from, 'Parsed:', parsed);
```

---

## Summary

With this system:
- ✅ All inputs validated and sanitized
- ✅ Natural language parsing works
- ✅ Indian formats supported
- ✅ Missing fields trigger follow-up
- ✅ Spam/injection protected
- ✅ Production-ready

**Your bot now understands natural language!** 🎯

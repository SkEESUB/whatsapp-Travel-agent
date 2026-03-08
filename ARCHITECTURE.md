# WhatsApp Travel Agent - Modular AI Architecture

## 🏗️ Project Structure

```
src/
├── controllers/
│   └── webhookController.js    # Main message routing & business logic
├── services/
│   ├── transportService.js     # Bus, Train, Flight generation
│   ├── hotelService.js         # Hotel recommendations
│   ├── itineraryService.js     # Day-by-day itinerary plans
│   └── budgetService.js        # Budget breakdown calculations
├── engine/
│   └── travelEngine.js         # Central orchestrator (facade pattern)
├── utils/
│   ├── sessionManager.js       # Session state management
│   ├── formatter.js            # Output formatting utilities
│   └── distanceRules.js        # Distance-based transport rules
└── routes/
    └── webhook.js              # Express route handlers
```

## 🎯 Architecture Overview

### Controller Layer
**webhookController.js** handles all incoming WhatsApp messages:
- Message parsing and validation
- Session state checks
- Routing to appropriate handlers
- Response composition

### Service Layer
Each service has **single responsibility**:

**transportService.js**
- `getBusOptions(origin, destination, budget, people)` → Exactly 4 bus options
- `getTrainOptions(origin, destination, budget, people)` → Trains with numbers & names
- `getFlightOptions(origin, destination, budget, people)` → Flights with distance validation

**hotelService.js**
- `getHotels(destination, budget, days)` → 2 budget + 2 mid-range + 1 premium

**itineraryService.js**
- `getItinerary(destination, days, people, budget)` → Day-by-day plans

**budgetService.js**
- `getBudgetPlan(destination, totalBudget, people, days)` → Category breakdown

### Engine Layer
**travelEngine.js** orchestrates all services:
- Single entry point for all travel queries
- Applies business rules (distance checks, mode availability)
- Error handling and fallbacks
- Returns standardized response format

### Utility Layer
**sessionManager.js** fixes critical bugs:
- `resetTransportSession(session)` → Clears origin on new transport request
- `clearTransportSession(session)` → Resets after response sent
- `saveTrip(session, tripData)` → Saves trip with budget breakdown

**formatter.js** ensures clean output:
- Maximum 4 transport options enforced
- WhatsApp-friendly formatting
- No long paragraphs
- Clean spacing and structure

**distanceRules.js** provides Indian travel logic:
- Short distance (<200km): Bus preferred, flights unavailable
- Medium distance (200-800km): Train preferred
- Long distance (>800km): Flight preferred, bus discouraged

## 🔧 Key Features

### 1. Session Management Fixes

**Problem:** Previous origin city reused across requests

**Solution:**
```javascript
// When user types "Transport"
sessionManager.resetTransportSession(session);
// Sets: awaitingOrigin = true, origin = null

// After response sent
sessionManager.clearTransportSession(session);
// Sets: awaitingOrigin = false, awaitingTransportMode = false, origin = null
```

### 2. Input Validation

**Problem:** Trip details interpreted as origin city

**Solution:**
```javascript
if (session.awaitingOrigin && containsNumbers(text)) {
  await sendMessage(
    from,
    "❌ Please send only the city name.\n\nExample: Hyderabad\n\n(Don't include days, budget, or people)"
  );
  return;
}
```

### 3. Distance-Based Transport Rules

**Problem:** Flights suggested for short distances

**Solution:**
```javascript
const distanceInfo = distanceRules.getRecommendedTransport(origin, destination);

if (distanceInfo.unavailable.includes(mode.toLowerCase())) {
  return {
    success: false,
    message: "✈️ Flights are not available for short distances."
  };
}
```

### 4. Strict Output Formatting

**Problem:** Gemini responses too long and messy

**Solution:**
```javascript
// In all service prompts:
"Generate EXACTLY 4 options"
"No explanations"
"No paragraphs"
"Clean format only"
"Return ONLY the list"

// Formatter enforces limits:
options.slice(0, MAX_OPTIONS) // Always max 4
```

## 📋 Example Responses

### Bus Options Format
```
🚌 *Bus Options*
Hyderabad → Delhi

💰 Budget: ₹3000 (2 people)

1️⃣ APSRTC Garuda
Depart: 20:30
Arrive: 03:00
Duration: 6h 30m
Price: ₹620
Type: AC Seater

2️⃣ Orange Travels
...
```

### Train Options Format
```
🚆 *Train Options*
Hyderabad → Delhi

1️⃣ 12722 Dakshin Express
Depart: 21:30
Arrive: 05:45
Duration: 8h 15m
Classes: SL / 3A / 2A
Price: ₹450–₹1200

2️⃣ 17226 Amaravati Express
...
```

### Hotel Format
```
🏨 *Hotels in Delhi*

💰 Budget: ₹8000
📅 3 night(s)

*Budget Hotels*
• Hotel Blue Moon – ₹1800 – Karol Bagh

• Mid-Range Stay – ₹3500 – CP

*Mid-Range*
• Hotel Royal – ₹4200 – Connaught Place
```

## 🧪 Testing Routes

Test these scenarios:

**Hyderabad → Delhi** (Long distance)
- ✅ Flight should be available
- ✅ Train should be available  
- ✅ Bus should be discouraged

**Guntur → Bangalore** (Medium distance)
- ✅ Train preferred
- ✅ Bus optional
- ✅ Flight possible

**Kurnool → Hyderabad** (Short distance)
- ✅ Bus preferred
- ✅ Train optional
- ❌ Flights unavailable

**Mumbai → Goa** (Medium distance)
- ✅ Train preferred
- ✅ Bus optional

## 🚀 How to Run

1. Install dependencies:
```bash
npm install @google/generative-ai
```

2. Set environment variables in `.env`:
```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
WHATSAPP_PHONE_NUMBER_ID=your_id
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

3. Start server:
```bash
npm start
```

## 🎯 Usage Flow

```
User: "Goa 3 days 15000 2 people"
→ Trip saved with budget breakdown

User: "Transport"
→ Bot: "Traveling from which city?"

User: "Hyderabad"
→ Bot: "Choose transport mode: Bus/Train/Flight"

User: "train"
→ Travel Engine calls trainService
→ Distance rules applied
→ Exactly 4 trains returned
→ Formatted for WhatsApp
→ Session cleared

User: "hotels"
→ Hotel service called
→ 2 budget + 2 mid-range + 1 premium
→ Structured output

User: "places"
→ Tourist places returned
→ 6 attractions listed

User: "itinerary"
→ Day-by-day plan generated

User: "budget"
→ Category breakdown shown
```

## 🔐 Error Handling

All services follow this pattern:
```javascript
try {
  const result = await service.method(params);
  
  if (!result) {
    return {
      success: false,
      message: "⚠️ Travel information temporarily unavailable. Please try again later."
    };
  }
  
  return { success: true, data: result };
  
} catch (err) {
  console.error("❌ Error:", err.message);
  return {
    success: false,
    message: "⚠️ Travel information temporarily unavailable. Please try again later."
  };
}
```

## 💡 Benefits of This Architecture

1. **Modularity** - Each service is independent
2. **Testability** - Easy to unit test each service
3. **Extensibility** - Add new transport modes or services easily
4. **Maintainability** - Clear separation of concerns
5. **Reliability** - Comprehensive error handling
6. **Scalability** - Ready for real API integration

## 🔮 Future Enhancements

- Add real-time bus API (redBus, AbhiBus)
- Integrate train API (IRCTC)
- Connect flight booking APIs
- Add restaurant recommendations service
- Implement weather checking service
- Add emergency contacts service

---

**Built with ❤️ using Node.js, Express, and Google Gemini AI**

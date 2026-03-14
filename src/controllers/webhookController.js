// Webhook Controller - Handle all WhatsApp message logic
const sessionManager = require("../utils/sessionManager");
const transportEngine = require("../engines/transportEngine");
const travelEngine = require("../engine/travelEngine");

class WebhookController {
  constructor() {
    this.sessions = {};
  }

  getSession(user) {
    return sessionManager.getSession(user);
  }

  // Check if input contains numbers
  containsNumbers(text) {
    return /\d/.test(text);
  }

  // Capitalize text
  capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  // Parse trip details from message
  parseTripLoosely(text) {
    const cleaned = text
      .toLowerCase()
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const patterns = [
      /([a-z\s]+?)\s+(\d+)\s*days?\s+(\d+)\s*(?:rs|₹)?\s*(\d+)\s*people?/,
      /([a-z\s]+?)\s+(\d+)\s*days?\s+(\d+)\s+people\s+(\d+)/,
      /([a-z\s]+?)\s+(\d+)\s*days?\s+budget\s+(\d+)\s+(\d+)\s*people?/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        return {
          destination: this.capitalize(match[1].trim()),
          days: Number(match[2]),
          budget: Number(match[3]),
          people: Number(match[4]),
        };
      }
    }

    return null;
  }

  async sendMessage(to, text, sendMessageFn) {
    await sendMessageFn(to, text);
  }

  // Handle incoming message
  async handleMessage(req, res, sendMessageFn) {
    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages) {
        console.log("📭 No messages in webhook");
        return;
      }

      const msg = value.messages[0];
      const from = msg.from;
      const text = msg.text?.body?.trim();

      if (!text) {
        console.log("📭 Empty message received");
        return;
      }

      const session = this.getSession(from);
      const lower = text.toLowerCase().trim();

      console.log("📩 Incoming message:", { from, text, lower });
      console.log("📊 Session state:", {
        hasTrip: !!session.trip,
        awaitingOrigin: session.awaitingOrigin,
        awaitingTransportMode: session.awaitingTransportMode,
      });

      // Route to appropriate handler
      await this.routeMessage(from, lower, text, session, sendMessageFn);

    } catch (err) {
      console.error("❌ Webhook handler error:", err.message);
    }
  }

async routeMessage(from, lower, text, session, sendMessageFn) {

  // NEW TRIP RESET
  if (lower === "new trip") {
    sessionManager.resetSession(session);

    await sendMessageFn(
      from,
      "🔄 Starting a new trip!\n\nSend trip details like:\nDelhi 3 days 10000 2 people"
    );

    return;
  }

  // Greeting
  if (["hi", "hello", "hii", "hey"].includes(lower)) {
    await sendMessageFn(from, this.getGreetingMessage());
    return;
  }

    // Plan trip
    if (lower === "1" || lower === "plan trip") {
      await sendMessageFn(from, "✍️ Send trip details like:\nDelhi 3 days 10000 2 people");
      return;
    }

    // Transport - RESET SESSION EVERY TIME
    if (lower === "2" || lower === "transport") {
      await this.handleTransportRequest(from, session, sendMessageFn);
      return;
    }

    // Hotels
    if (lower === "3" || lower === "hotels") {
      await this.handleHotels(from, session, sendMessageFn);
      return;
    }

    // Itinerary
    if (lower === "4" || lower === "itinerary") {
      await this.handleItinerary(from, session, sendMessageFn);
      return;
    }

    // Budget
    if (lower === "5" || lower === "budget") {
      await this.handleBudget(from, session, sendMessageFn);
      return;
    }

    // Help
    if (lower === "6" || lower === "help") {
      await sendMessageFn(from, this.getHelpMessage());
      return;
    }

    // Tourist Places
    if (lower === "places") {
      await this.handlePlaces(from, session, sendMessageFn);
      return;
    }

    // Origin input - WITH VALIDATION
    if (session.awaitingOrigin) {
      await this.handleOriginInput(from, text, session, sendMessageFn);
      return;
    }

    // Transport mode selection - FIXED: Keep session active
    if (session.awaitingTransportMode) {
      await this.handleTransportMode(from, lower, text, session, sendMessageFn);
      return;
    }

    // NEW: Detect transport mode keywords anywhere in conversation
    if (session.trip && session.origin && !session.awaitingTransportMode) {
      // Check if user is trying to select a transport mode
      const normalizedText = text.toLowerCase().trim();
      if (normalizedText.includes('bus') || normalizedText.includes('train') || normalizedText.includes('flight')) {
        await this.handleTransportMode(from, normalizedText, text, session, sendMessageFn);
        return;
      }
    }

    // Trip parsing
    const trip = this.parseTripLoosely(text);
    
    if (trip?.destination && trip?.days && trip?.budget && trip?.people) {
      await this.handleTripSave(from, session, trip, sendMessageFn);
      return;
    }

    // Fallback
    await sendMessageFn(from, this.getFallbackMessage());
  }

  async handleTransportRequest(from, session, sendMessageFn) {
    if (!session.trip) {
      await sendMessageFn(from, "❌ Please send trip details first.\n\nExample: Delhi 3 days 10000 2 people");
      return;
    }
    
    // CRITICAL: Reset transport session completely
    sessionManager.resetTransportSession(session);
    await sendMessageFn(from, "📍 Traveling from which city?");
  }

  async handleOriginInput(from, text, session, sendMessageFn) {
    // Validate input doesn't contain numbers
    if (this.containsNumbers(text)) {
      await sendMessageFn(
        from,
        "❌ Please send only the city name.\n\nExample: Hyderabad\n\n(Don't include days, budget, or people)"
      );
      return;
    }
    
    // Valid city name - save it
    session.origin = text.toLowerCase().trim();
    session.awaitingOrigin = false;
    session.awaitingTransportMode = true;

    console.log("📍 Origin saved:", session.origin);
    await sendMessageFn(from, "🚍 Choose transport mode:\n\nBus\nTrain\nFlight");
  }

  async handleTransportMode(from, modeInput, fullText, session, sendMessageFn) {
    // Validate session.trip exists
    if (!session.trip) {
      await sendMessageFn(from, "❌ Please send trip details first.\n\nExample: Delhi 3 days 10000 2 people");
      return;
    }
    
    // Normalize input to lowercase for detection
    const normalizedMode = fullText.toLowerCase().trim();
      
    // Detect transport mode from input
    let selectedMode = null;
    if (normalizedMode.includes('bus')) {
      selectedMode = 'bus';
    } else if (normalizedMode.includes('train')) {
      selectedMode = 'train';
    } else if (normalizedMode.includes('flight')) {
      selectedMode = 'flight';
    }
      
    // If no valid mode detected in awaitingTransportMode state, ask again
    if (!selectedMode && session.awaitingTransportMode) {
      await sendMessageFn(from, "Please type: Bus / Train / Flight");
      return;
    }
      
    // If still no mode, use the original mode parameter
    if (!selectedMode) {
      selectedMode = modeInput;
    }
      
    // Validate mode
    if (!["bus", "train", "flight"].includes(selectedMode)) {
      await sendMessageFn(from, "Please type: Bus / Train / Flight");
      return;
    }
  
    const { destination, budgetBreakdown, people } = session.trip;
    // CALL TRANSPORT ENGINE

const origin = session.origin;
const destinationCity = destination;

console.log(`[Transport] Getting ${selectedMode} options: ${origin} → ${destinationCity}`);

// LOADING MESSAGE
await sendMessageFn(from, "🔎 Searching transport options... Please wait ⏳");

const transportResult = await transportEngine.getTransportOptions(
  origin,
  destinationCity
);

// Send result to WhatsApp
await sendMessageFn(from, transportResult);

// keep session active so user can switch bus/train
session.awaitingTransportMode = true;

console.log("[Transport] Results shown - keeping session active for mode switching");

return;

    // Use travel engine
    const result = await travelEngine.getTransport(
      this.capitalize(session.origin),
      destination,
      this.capitalize(selectedMode),
      transportBudget,
      people
    );

    if (result.success) {
      await sendMessageFn(from, result.data);
        
      // Show recommendation if available
      if (result.recommended && result.recommended !== selectedMode) {
        await sendMessageFn(from, `💡 Tip: ${this.capitalize(result.recommended)} is recommended for this route.`);
      }
        
      // FIXED: Keep transport session active so user can switch modes
      console.log("✅ [Transport] Results shown - keeping session active for mode switching");
    } else {
      await sendMessageFn(from, result.message || "⚠️ Unable to fetch transport data. Please try again.");
    }
      
    // REMOVED: Don't clear session here - only clear when user explicitly exits or starts new trip
  }

async handleHotels(from, session, sendMessageFn) {
  if (!session.trip) {
    await sendMessageFn(from, "❌ Please send trip details first.");
    return;
  }

  const { destination, days, budgetBreakdown } = session.trip;
  const hotelBudget = budgetBreakdown?.hotel || Math.floor(session.trip.budget * 0.4);

  // HOTEL LOADING MESSAGE
  await sendMessageFn(from, "🏨 Searching best hotels... Please wait ⏳");

  const result = await travelEngine.getHotels(destination, hotelBudget, days);

  if (result.success) {
    await sendMessageFn(from, result.data);
  } else {
    await sendMessageFn(from, result.message);
  }
}

  async handlePlaces(from, session, sendMessageFn) {
    if (!session.trip) {
      await sendMessageFn(from, "❌ Please send trip details first.");
      return;
    }

    const { destination } = session.trip;
    const result = await travelEngine.getTouristPlaces(destination);

    if (result.success) {
      await sendMessageFn(from, result.data);
    } else {
      await sendMessageFn(from, result.message);
    }
  }

async handleItinerary(from, session, sendMessageFn) {
  if (!session.trip) {
    await sendMessageFn(from, "❌ Please send trip details first.");
    return;
  }

  const { destination, days, budget, people } = session.trip;

  // ITINERARY LOADING MESSAGE
  await sendMessageFn(from, "🗺 Creating your travel itinerary... Please wait ⏳");

  const result = await travelEngine.getItinerary(destination, days, people, budget);

  if (result.success) {
    await sendMessageFn(from, result.data);
  } else {
    await sendMessageFn(from, result.message);
  }
}

  async handleBudget(from, session, sendMessageFn) {
    if (!session.trip) {
      await sendMessageFn(from, "❌ Please send trip details first.");
      return;
    }

    const { destination, budget, people, days } = session.trip;
    const result = await travelEngine.getBudget(destination, budget, people, days);

    if (result.success) {
      await sendMessageFn(from, result.data);
    } else {
      await sendMessageFn(from, result.message);
    }
  }

  async handleTripSave(from, session, trip, sendMessageFn) {
    const savedTrip = sessionManager.saveTrip(session, trip);

await sendMessageFn(
  from,
  `📋 *TRIP SUMMARY*

📍 Destination: ${savedTrip.destination}
📅 Days: ${savedTrip.days}
👥 Travelers: ${savedTrip.people}
💰 Total Budget: ₹${savedTrip.budget}
💵 Per Person: ₹${savedTrip.perPersonBudget}

──────────────

Choose what you want:

🚍 2 Transport
🏨 3 Hotels
🗺 4 Itinerary
💰 5 Budget

🔄 Type *new trip* anytime to start again.`
);
  }

getGreetingMessage() {
  return `👋 Welcome to *TravelBot* ✈️

Plan your trip in seconds!

Send trip details like:
Delhi 3 days 10000 2 people

──────────────

📋 *Main Menu*

1️⃣ Plan Trip  
2️⃣ Transport Options  
3️⃣ Hotel Suggestions  
4️⃣ Travel Itinerary  
5️⃣ Budget Planner  
6️⃣ Help

Tip: You can type commands like *Hotels* or *Itinerary* anytime.`;
}
  getHelpMessage() {
    return `📋 Commands:

1️⃣ Plan Trip - How to enter trip details
2️⃣ Transport - Get travel options
3️⃣ Hotels - See hotel recommendations
4️⃣ Itinerary - Get day-wise plan
5️⃣ Budget - Show budget breakdown
6️⃣ Help - Show this menu

✨ Extra: Type "places" for tourist attractions!`;
  }

  getFallbackMessage() {
    return `❓ I didn't understand.

Try sending:
Delhi 3 days 10000 2 people

Or type "help" for options.`;
  }
}

module.exports = new WebhookController();

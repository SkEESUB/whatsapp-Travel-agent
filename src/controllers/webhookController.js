// Webhook Controller - Handle all WhatsApp message logic
const sessionManager = require("../utils/sessionManager");
const travelEngine = require("../engine/travelEngine");
const voiceService = require("../services/voiceService");
const locationService = require("../services/locationService");
const imageService = require("../services/imageService");
const referralService = require("../services/referralService");
const streakService = require("../services/streakService");
const logger = require("../config/logger");

class WebhookController {
  constructor() {
    this.sessions = {};
  }

  async getSession(user) {
    return await sessionManager.getSession(user);
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
    let from;
    let session;
    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value;
      if (!value?.messages) {
        logger.info("📭 No messages in webhook");
        return;
      }

      const msg = value.messages[0];
      from = msg.from;
      const messageType = msg.type; // text, audio, location, image, etc.

      logger.info("📩 Incoming message", {
        from,
        type: messageType,
      });

      session = await this.getSession(from);

      // Route based on message type
      switch (messageType) {
        case 'audio':
          await this.handleVoiceMessage(from, msg, session, sendMessageFn);
          break;

        case 'location':
          await this.handleLocationMessage(from, msg, session, sendMessageFn);
          break;

        case 'image':
          await this.handleImageMessage(from, msg, session, sendMessageFn);
          break;

        case 'text':
          const text = msg.text?.body?.trim();
          if (!text) {
            logger.info("📭 Empty text message received");
            return;
          }
          await this.handleTextMessage(from, text, session, sendMessageFn);
          break;

        case 'document':
        case 'video':
        case 'sticker':
          await sendMessageFn(from, "⚠️ I can't process this media type yet. Please send text, voice, location, or image.");
          break;

        default:
          logger.warn(`⚠️ Unsupported message type: ${messageType}`);
          await sendMessageFn(from, "⚠️ I don't support this message type yet. Please send text, voice, location, or image.");
      }

    } catch (err) {
      logger.error("❌ Webhook handler error", {
        error: err.message,
        stack: err.stack,
      });
    } finally {
      if (from && session) {
        await sessionManager.saveSession(from, session);
      }
    }
  }

  async handleTextMessage(from, text, session, sendMessageFn) {
    const lower = text.toLowerCase().trim();

    logger.info("📊 Session state", {
      from,
      hasTrip: !!session.trip,
      awaitingOrigin: session.awaitingOrigin,
      awaitingTransportMode: session.awaitingTransportMode,
    });

    // Route to appropriate handler
    await this.routeMessage(from, lower, text, session, sendMessageFn);
  }

  /**
   * Handle voice message
   */
  async handleVoiceMessage(from, msg, session, sendMessageFn) {
    try {
      const mediaId = msg.audio?.id;

      if (!mediaId) {
        await sendMessageFn(from, "⚠️ Could not process voice message. Please try again.");
        return;
      }

      logger.info("🎤 Processing voice message", { from, mediaId });

      // Send processing message
      await sendMessageFn(from, "🎤 Processing your voice message...");

      // Process voice message
      const result = await voiceService.processVoiceMessage(from, mediaId);

      if (!result.success) {
        await sendMessageFn(from, voiceService.getVoiceErrorMessage(result.error));
        return;
      }

      // Log transcribed text
      logger.info("✅ Voice transcribed", {
        from,
        text: result.text.substring(0, 100),
      });

      // Process as text message
      await this.handleTextMessage(from, result.text, session, sendMessageFn);

    } catch (error) {
      logger.error("❌ Voice message handling error", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, voiceService.getVoiceErrorMessage("Unexpected error"));
    }
  }

  /**
   * Handle location message
   */
  async handleLocationMessage(from, msg, session, sendMessageFn) {
    try {
      const location = msg.location;

      if (!location?.latitude || !location?.longitude) {
        await sendMessageFn(from, "⚠️ Could not process location. Please send again.");
        return;
      }

      const { latitude, longitude } = location;

      logger.info("📍 Processing location message", {
        from,
        lat: latitude,
        lng: longitude,
      });

      // Process location
      const result = await locationService.processLocationMessage(from, latitude, longitude);

      if (!result.success) {
        await sendMessageFn(from, locationService.getLocationErrorMessage(result.error));
        return;
      }

      // Store location as source city in session
      session.sourceCity = result.city;
      session.sourceLocation = {
        lat: latitude,
        lng: longitude,
        city: result.city,
      };

      // Send response
      const response = locationService.formatLocationResponse(result);
      await sendMessageFn(from, response);

      logger.info("✅ Location processed", {
        from,
        city: result.city,
      });

    } catch (error) {
      logger.error("❌ Location message handling error", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, locationService.getLocationErrorMessage("Unexpected error"));
    }
  }

  /**
   * Handle image message
   */
  async handleImageMessage(from, msg, session, sendMessageFn) {
    try {
      const mediaId = msg.image?.id;

      if (!mediaId) {
        await sendMessageFn(from, "⚠️ Could not process image. Please try again.");
        return;
      }

      logger.info("🖼️ Processing image message", { from, mediaId });

      // Send processing message
      await sendMessageFn(from, "🔍 Analyzing your photo...");

      // Process image
      const result = await imageService.processImageMessage(from, mediaId);

      if (!result.success) {
        await sendMessageFn(from, imageService.getImageErrorMessage(result.error));
        return;
      }

      // Format and send response
      const response = imageService.formatImageResponse(result.place, result.suggestions);
      await sendMessageFn(from, response);

      logger.info("✅ Image processed", {
        from,
        place: result.place,
      });

    } catch (error) {
      logger.error("❌ Image message handling error", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, imageService.getImageErrorMessage("Unexpected error"));
    }
  }

  async routeMessage(from, lower, text, session, sendMessageFn) {
    // Greeting
    if (["hi", "hello", "hii", "hey"].includes(lower)) {
      await sendMessageFn(from, this.getGreetingMessage());
      return;
    }

    // Referral commands
    if (referralService.isReferralRequest(lower)) {
      await this.handleReferralRequest(from, session, sendMessageFn);
      return;
    }

    // Check for referral code in message
    const referralCode = referralService.extractReferralCode(text);
    if (referralCode) {
      await this.handleReferralCodeApplication(from, referralCode, session, sendMessageFn);
      return;
    }

    // Streak/Gamification commands
    if (lower === 'streak' || lower === 'profile' || lower === 'stats') {
      await this.handleGamificationStats(from, session, sendMessageFn);
      return;
    }

    // Leaderboard
    if (lower === 'leaderboard' || lower === 'top referrers') {
      await this.handleLeaderboard(from, session, sendMessageFn);
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

    // Weather
    if (lower === "7" || lower === "weather") {
      await this.handleWeather(from, session, sendMessageFn);
      return;
    }

    // Food
    if (lower === "8" || lower === "food") {
      await this.handleFood(from, session, sendMessageFn);
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
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.\n\nExample: Delhi 3 days 10000 2 people");
        return;
      }
      
      console.log(`[User: ${from}] [Action: Transport Request] Starting transport flow`);
      
      // CRITICAL: Reset transport session completely
      sessionManager.resetTransportSession(session);
      await sendMessageFn(from, "📍 Traveling from which city?");
    } catch (err) {
      console.error(`❌ [User: ${from}] [Transport Request] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Transport service unavailable. Please try again.");
    }
  }

  async handleOriginInput(from, text, session, sendMessageFn) {
    try {
      // Validate input doesn't contain numbers
      if (this.containsNumbers(text)) {
        await sendMessageFn(
          from,
          "❌ Please send only the city name.\n\nExample: Hyderabad\n\n(Don't include days, budget, or people)"
        );
        return;
      }
      
      // Sanitize city name - remove special characters
      const sanitizedCity = text.replace(/[^a-zA-Z\s]/g, '').trim();
      
      if (!sanitizedCity || sanitizedCity.length < 2) {
        await sendMessageFn(from, "❌ Please send a valid city name.");
        return;
      }
      
      // Valid city name - save it
      session.origin = sanitizedCity.toLowerCase();
      session.awaitingOrigin = false;
      session.awaitingTransportMode = true;

      console.log(`[User: ${from}] [Origin Saved] ${session.origin}`);
      await sendMessageFn(from, "🚍 Choose transport mode:\n\nBus\nTrain\nFlight");
    } catch (err) {
      console.error(`❌ [User: ${from}] [Origin Input] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Error processing input. Please try again.");
    }
  }

  async handleTransportMode(from, modeInput, fullText, session, sendMessageFn) {
    try {
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
      const transportBudget = budgetBreakdown?.transport || Math.floor(session.trip.budget * 0.3);
      const origin = session.origin;
      
      console.log(`[User: ${from}] [Action: Transport] ${origin} → ${destination} via ${selectedMode}`);
  
      // Use travel engine
      const result = await travelEngine.getTransport(
        this.capitalize(origin),
        destination,
        selectedMode,
        transportBudget,
        people
      );
  
      if (result.success) {
        await sendMessageFn(from, result.data);
          
        // Show recommendation if available
        if (result.recommended && result.recommended !== selectedMode) {
          await sendMessageFn(from, `💡 Tip: ${this.capitalize(result.recommended)} is recommended for this route.`);
        }
          
        // Keep transport session active so user can switch modes
        session.awaitingTransportMode = true;
        console.log(`[User: ${from}] [Transport] Success - session active for mode switching`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Unable to fetch transport data. Please try again.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Transport Mode] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Transport service unavailable. Please try again.");
    }
  }

  async handleHotels(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination, days, budgetBreakdown } = session.trip;
      const hotelBudget = budgetBreakdown?.hotel || Math.floor(session.trip.budget * 0.4);

      console.log(`[User: ${from}] [Action: Hotels] ${destination}, Budget: ₹${hotelBudget}`);

      const result = await travelEngine.getHotels(destination, hotelBudget, days);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Hotels] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Hotel information unavailable.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Hotels] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Hotel service unavailable. Please try again.");
    }
  }

  async handlePlaces(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination } = session.trip;
      console.log(`[User: ${from}] [Action: Places] ${destination}`);

      const result = await travelEngine.getTouristPlaces(destination);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Places] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Tourist places unavailable.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Places] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Places service unavailable. Please try again.");
    }
  }

  async handleItinerary(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination, days, budget, people } = session.trip;
      console.log(`[User: ${from}] [Action: Itinerary] ${destination}, ${days} days`);

      const result = await travelEngine.getItinerary(destination, days, people, budget);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Itinerary] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Itinerary unavailable.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Itinerary] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Itinerary service unavailable. Please try again.");
    }
  }

  async handleBudget(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination, budget, people, days } = session.trip;
      console.log(`[User: ${from}] [Action: Budget] ${destination}, ₹${budget}`);

      const result = await travelEngine.getBudget(destination, budget, people, days);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Budget] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Budget information unavailable.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Budget] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Budget service unavailable. Please try again.");
    }
  }

  async handleWeather(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination } = session.trip;
      console.log(`[User: ${from}] [Action: Weather] ${destination}`);

      const result = await travelEngine.getWeather(destination);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Weather] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Weather data not available.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Weather] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Weather service unavailable. Please try again.");
    }
  }

  async handleFood(from, session, sendMessageFn) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination } = session.trip;
      console.log(`[User: ${from}] [Action: Food] ${destination}`);

      const result = await travelEngine.getFoodGuide(destination);

      if (result.success) {
        await sendMessageFn(from, result.data);
        console.log(`[User: ${from}] [Food] Success`);
      } else {
        await sendMessageFn(from, result.message || "⚠️ Food guide unavailable.");
      }
    } catch (err) {
      console.error(`❌ [User: ${from}] [Food] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Food service unavailable. Please try again.");
    }
  }

  async handleTripSave(from, session, trip, sendMessageFn) {
    try {
      // Validate trip data
      if (!trip.destination || trip.days <= 0 || trip.budget <= 0 || trip.people <= 0) {
        await sendMessageFn(from, "❌ Please send valid trip details.\n\nExample: Delhi 3 days 10000 2 people");
        return;
      }
      
      // Sanitize destination
      trip.destination = trip.destination.replace(/[^a-zA-Z\s]/g, '').trim();
      
      if (!trip.destination || trip.destination.length < 2) {
        await sendMessageFn(from, "❌ Please send a valid destination name.");
        return;
      }
      
      const savedTrip = sessionManager.saveTrip(session, trip);
      
      console.log(`[User: ${from}] [Trip Saved] ${savedTrip.destination}, ${savedTrip.days} days, ₹${savedTrip.budget}`);

      await sendMessageFn(
        from,
        `✅ Trip Saved!

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
8️⃣ Food`
      );
    } catch (err) {
      console.error(`❌ [User: ${from}] [Trip Save] Error:`, err.message);
      await sendMessageFn(from, "⚠️ Error saving trip. Please try again.");
    }
  }

  /**
   * Handle referral request (user wants to share their code)
   */
  async handleReferralRequest(from, session, sendMessageFn) {
    try {
      // Generate or get existing referral code
      const codeResult = await referralService.generateReferralCode(from);

      if (!codeResult.success) {
        await sendMessageFn(from, "⚠️ Failed to generate referral code. Please try again.");
        return;
      }

      // Get referral stats
      const statsResult = await referralService.getReferralStats(from);
      const stats = statsResult.success ? statsResult.stats : {
        totalReferred: 0,
        completedReferred: 0,
        pendingReferred: 0,
        bonusTripsEarned: 0,
      };

      // Format and send referral message
      const referralMessage = referralService.formatReferralMessage(
        from,
        codeResult.code,
        stats
      );

      await sendMessageFn(from, referralMessage);

      logger.info("Referral request handled", {
        from,
        code: codeResult.code,
      });

    } catch (error) {
      logger.error("Failed to handle referral request", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, "⚠️ Failed to process referral request. Please try again.");
    }
  }

  /**
   * Handle referral code application (new user with code)
   */
  async handleReferralCodeApplication(from, referralCode, session, sendMessageFn) {
    try {
      // Apply referral code
      const result = await referralService.applyReferralCode(from, referralCode, {
        userAgent: 'WhatsApp',
      });

      if (!result.success) {
        if (result.selfReferral) {
          await sendMessageFn(from, "⚠️ You can't use your own referral code!");
        } else if (result.alreadyReferred) {
          await sendMessageFn(from, "⚠️ You've already used a referral code!");
        } else if (result.abuse) {
          await sendMessageFn(from, "⚠️ Referral abuse detected. Code not applied.");
        } else {
          await sendMessageFn(from, `⚠️ Invalid referral code: ${referralCode}`);
        }
        return;
      }

      // Success message
      let message = `🎉 *Referral Code Applied!*

You've received *${result.newUserBonus} bonus trips*!

Your friend will also get bonus trips when you complete your first trip! 🎊

Let's start planning your trip! Send me:
• Destination
• Number of days
• Budget
• Number of people`;

      await sendMessageFn(from, message);

      // Notify referrer
      try {
        const { getUserByPhoneHash } = require('../services/userService');
        const referrer = await getUserByPhoneHash(result.referrerPhoneHash);
        
        if (referrer) {
          await sendMessageFn(
            referrer.phoneNumber,
            `🎉 Your friend just joined using your referral code!

You'll earn 2 bonus trips when they complete their first trip! 🔥`
          );
        }
      } catch (error) {
        logger.warn('Failed to notify referrer', { error: error.message });
      }

      logger.info("Referral code applied successfully", {
        newUser: from,
        code: referralCode,
      });

    } catch (error) {
      logger.error("Failed to apply referral code", {
        from,
        code: referralCode,
        error: error.message,
      });
      await sendMessageFn(from, "⚠️ Failed to apply referral code. Please try again.");
    }
  }

  /**
   * Handle gamification stats request
   */
  async handleGamificationStats(from, session, sendMessageFn) {
    try {
      const result = await streakService.getGamificationStats(from);

      if (!result.success) {
        await sendMessageFn(from, "⚠️ Failed to fetch your stats. Please try again.");
        return;
      }

      const message = streakService.formatGamificationMessage(result.stats);
      await sendMessageFn(from, message);

    } catch (error) {
      logger.error("Failed to handle gamification stats", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, "⚠️ Failed to fetch your stats. Please try again.");
    }
  }

  /**
   * Handle leaderboard request
   */
  async handleLeaderboard(from, session, sendMessageFn) {
    try {
      const result = await referralService.getLeaderboard(10);

      if (!result.success) {
        await sendMessageFn(from, "⚠️ Failed to fetch leaderboard. Please try again.");
        return;
      }

      const message = referralService.formatLeaderboardMessage(result.leaderboard);
      await sendMessageFn(from, message);

    } catch (error) {
      logger.error("Failed to handle leaderboard", {
        from,
        error: error.message,
      });
      await sendMessageFn(from, "⚠️ Failed to fetch leaderboard. Please try again.");
    }
  }

  getGreetingMessage() {
    return `👋 Hello! Welcome to TravelBot ✈️

Send trip details like:
Delhi 3 days 10000 2 people

Or reply:
1️⃣ Plan Trip
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
6️⃣ Help`;
  }

  getHelpMessage() {
    return `📋 Commands:

1️⃣ Plan Trip - How to enter trip details
2️⃣ Transport - Get travel options
3️⃣ Hotels - See hotel recommendations
4️⃣ Itinerary - Get day-wise plan
5️⃣ Budget - Show budget breakdown
6️⃣ Help - Show this menu
7️⃣ Weather - Check destination weather
8️⃣ Food - Local food guide

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

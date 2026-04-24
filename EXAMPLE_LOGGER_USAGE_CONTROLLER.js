// Example: How to use logger in webhookController.js
// This shows the BEFORE (console.log) and AFTER (logger) patterns

const logger = require('../config/logger');
const { logWhatsAppMessage } = require('../utils/apiLogger');
const sessionManager = require("../utils/sessionManager");
const travelEngine = require("../engine/travelEngine");

class WebhookController {
  
  // ===== BEFORE (Old Way - console.log) =====
  /*
  async handleMessage(req, res, sendMessageFn) {
    try {
      const from = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      const text = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
      
      console.log("📩 Incoming message:", { from, text });
      console.log("📊 Session state:", { hasTrip: !!session.trip });
      
      // Logic here...
      
    } catch (err) {
      console.error("❌ Webhook handler error:", err.message);
    }
  }
  */

  // ===== AFTER (New Way - logger) =====
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
        logger.debug('Empty message received', { from, requestId });
        return;
      }

      const session = this.getSession(from);
      const lower = text.toLowerCase().trim();

      // Log user action
      logger.userAction({
        userId: from,
        action: 'message_received',
        details: { messageLength: text.length, hasTrip: !!session.trip },
        requestId,
      });

      // Route to appropriate handler
      await this.routeMessage(from, lower, text, session, sendMessageFn, requestId);

    } catch (err) {
      logger.error('Webhook handler error', {
        error: err.message,
        stack: err.stack,
        requestId: req.requestId,
      });
    }
  }

  async routeMessage(from, lower, text, session, sendMessageFn, requestId) {
    // Example: Greeting
    if (["hi", "hello", "hii", "hey"].includes(lower)) {
      logger.info('User greeting detected', { userId: from, requestId });
      await sendMessageFn(from, this.getGreetingMessage());
      return;
    }

    // Example: Transport
    if (lower === "2" || lower === "transport") {
      logger.info('Transport request initiated', { userId: from, requestId });
      await this.handleTransportRequest(from, session, sendMessageFn, requestId);
      return;
    }

    // ... other routes
  }

  async handleTransportRequest(from, session, sendMessageFn, requestId) {
    try {
      if (!session.trip) {
        logger.warn('Transport requested without trip', { userId: from, requestId });
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }
      
      logger.userAction({
        userId: from,
        action: 'transport_initiated',
        details: { destination: session.trip.destination },
        requestId,
      });

      sessionManager.resetTransportSession(session);
      await sendMessageFn(from, "📍 Traveling from which city?");
    } catch (err) {
      logger.error('Transport request handler error', {
        userId: from,
        error: err.message,
        requestId,
      });
      await sendMessageFn(from, "⚠️ Transport service unavailable. Please try again.");
    }
  }

  async handleTransportMode(from, modeInput, fullText, session, sendMessageFn, requestId) {
    try {
      if (!session.trip) {
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination, budgetBreakdown, people } = session.trip;
      const transportBudget = budgetBreakdown?.transport || Math.floor(session.trip.budget * 0.3);
      const origin = session.origin;

      // Log transport request
      logger.userAction({
        userId: from,
        action: 'transport_mode_selected',
        details: { origin, destination, mode: modeInput },
        requestId,
      });

      // Use travel engine
      const result = await travelEngine.getTransport(
        this.capitalize(origin),
        destination,
        modeInput,
        transportBudget,
        people
      );

      if (result.success) {
        await sendMessageFn(from, result.data);
        
        // Log success
        logger.info('Transport options sent successfully', {
          userId: from,
          origin,
          destination,
          requestId,
        });
      } else {
        logger.warn('Transport options failed', {
          userId: from,
          error: result.message,
          requestId,
        });
        await sendMessageFn(from, result.message || "⚠️ Unable to fetch transport data.");
      }
    } catch (err) {
      logger.error('Transport mode handler error', {
        userId: from,
        error: err.message,
        stack: err.stack,
        requestId,
      });
      await sendMessageFn(from, "⚠️ Transport service unavailable. Please try again.");
    }
  }

  async handleHotels(from, session, sendMessageFn, requestId) {
    try {
      if (!session.trip) {
        logger.warn('Hotels requested without trip', { userId: from, requestId });
        await sendMessageFn(from, "❌ Please send trip details first.");
        return;
      }

      const { destination, days, budgetBreakdown } = session.trip;
      const hotelBudget = budgetBreakdown?.hotel || Math.floor(session.trip.budget * 0.4);

      logger.userAction({
        userId: from,
        action: 'hotels_requested',
        details: { destination, budget: hotelBudget },
        requestId,
      });

      const result = await travelEngine.getHotels(destination, hotelBudget, days);

      if (result.success) {
        await sendMessageFn(from, result.data);
        logger.info('Hotels sent successfully', { userId: from, destination, requestId });
      } else {
        logger.warn('Hotels request failed', { userId: from, error: result.message, requestId });
        await sendMessageFn(from, result.message || "⚠️ Hotel information unavailable.");
      }
    } catch (err) {
      logger.error('Hotels handler error', {
        userId: from,
        error: err.message,
        requestId,
      });
      await sendMessageFn(from, "⚠️ Hotel service unavailable. Please try again.");
    }
  }

  async handleTripSave(from, session, trip, sendMessageFn, requestId) {
    try {
      // Validate trip data
      if (!trip.destination || trip.days <= 0 || trip.budget <= 0 || trip.people <= 0) {
        logger.warn('Invalid trip data', { userId: from, trip, requestId });
        await sendMessageFn(from, "❌ Please send valid trip details.");
        return;
      }

      const savedTrip = sessionManager.saveTrip(session, trip);

      // Log business event
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

      await sendMessageFn(from, `✅ Trip Saved!...`);
    } catch (err) {
      logger.error('Trip save error', {
        userId: from,
        error: err.message,
        requestId,
      });
      await sendMessageFn(from, "⚠️ Error saving trip. Please try again.");
    }
  }

  getSession(user) {
    return sessionManager.getSession(user);
  }

  capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  getGreetingMessage() {
    return `👋 Hello! Welcome to TravelBot ✈️...`;
  }
}

module.exports = new WebhookController();

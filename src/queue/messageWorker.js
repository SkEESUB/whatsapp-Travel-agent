// Message Worker
// Processes WhatsApp messages from the queue

const { Worker } = require('bullmq');
const logger = require('../config/logger');
const { getRedisClient } = require('../config/redis');
const { getQueue, QUEUE_NAME } = require('./messageQueue');
const whatsappSender = require('../utils/whatsappSender');
const sessionService = require('../services/sessionService');
const travelEngine = require('../engine/travelEngine');
const { parseTripDetails, isCommand, isGreeting } = require('../engine/nlpParser');

// Configuration
const CONCURRENCY = 10; // Process 10 messages simultaneously
let worker = null;

/**
 * Process a single message
 */
async function processMessageJob(job) {
  const { phoneNumber, message, timestamp } = job.data;
  
  logger.info('Processing message', {
    jobId: job.id,
    phoneNumber,
    message: message?.substring(0, 100),
    attempt: job.attemptsMade + 1,
  });

  let session = null;

  try {
    // Get session
    session = await sessionService.getSession(phoneNumber);

    // Parse and route message
    const response = await routeMessage(phoneNumber, message, session);

    // Send response to user
    if (response) {
      await whatsappSender.sendMessage(phoneNumber, response);
      
      // Add to history
      await sessionService.addToHistory(phoneNumber, message, response);
    }

    logger.info('✅ Message processed successfully', {
      phoneNumber,
      responseLength: response?.length || 0,
    });

    return { success: true };

  } catch (error) {
    logger.error('❌ Error processing message', {
      phoneNumber,
      error: error.message,
      stack: error.stack,
    });

    // Send error response to user
    try {
      const errorMessage = error.message?.toLowerCase().includes('timeout')
        ? '⏳ Taking longer than expected. Please wait...'
        : '⚠️ Sorry, something went wrong. Please try again.';

      await whatsappSender.sendMessage(phoneNumber, errorMessage);
      
      if (session) {
        await sessionService.addToHistory(phoneNumber, message, errorMessage);
      }
    } catch (sendError) {
      logger.error('Failed to send error message to user', {
        phoneNumber,
        error: sendError.message,
      });
    }

    throw error; // Let BullMQ handle retry
  }
}

/**
 * Route message to appropriate handler
 */
async function routeMessage(phoneNumber, text, session) {
  const lower = text.toLowerCase().trim();

  // Greeting
  if (isGreeting(text)) {
    return getGreetingMessage();
  }

  // Commands
  if (isCommand(text)) {
    return await handleCommand(phoneNumber, lower, session);
  }

  // Based on session state
  switch (session.state) {
    case 'MENU':
      return await handleMenuInput(phoneNumber, text, session);
    
    case 'AWAITING_DESTINATION':
      return await handleAwaitingDestination(phoneNumber, text, session);
    
    case 'AWAITING_DAYS':
      return await handleAwaitingDays(phoneNumber, text, session);
    
    case 'AWAITING_BUDGET':
      return await handleAwaitingBudget(phoneNumber, text, session);
    
    default:
      return await handleMenuInput(phoneNumber, text, session);
  }
}

/**
 * Handle greeting
 */
function handleGreeting(phoneNumber, session) {
  return getGreetingMessage();
}

/**
 * Handle command
 */
async function handleCommand(phoneNumber, lower, session) {
  switch (lower) {
    case '1':
    case 'plan trip':
      await sessionService.setState(phoneNumber, 'AWAITING_DESTINATION');
      return '📍 Where do you want to go?\n\nExample: Goa, Manali, Kerala';
    
    case '2':
    case 'transport':
      return await handleTransport(phoneNumber, session);
    
    case '3':
    case 'hotels':
      return await handleHotels(phoneNumber, session);
    
    case '4':
    case 'itinerary':
      return await handleItinerary(phoneNumber, session);
    
    case '5':
    case 'budget':
      return await handleBudget(phoneNumber, session);
    
    case '6':
    case 'weather':
      return await handleWeather(phoneNumber, session);
    
    case '7':
    case 'food':
      return await handleFood(phoneNumber, session);
    
    case 'reset':
    case 'new trip':
      await sessionService.resetTrip(phoneNumber);
      return '✅ Trip reset. Send new trip details or type "1" to start planning.';
    
    case 'help':
    case 'menu':
      return getHelpMessage();
    
    default:
      return getFallbackMessage();
  }
}

/**
 * Handle menu input (trip planning)
 */
async function handleMenuInput(phoneNumber, text, session) {
  const parsed = parseTripDetails(text);

  if (parsed.confidence >= 50 && parsed.destination) {
    // Update trip data
    await sessionService.updateTripData(phoneNumber, {
      destination: parsed.destination,
      source: parsed.source,
      days: parsed.days,
      budget: parsed.budget,
      people: parsed.people,
      travelStyle: parsed.preferences?.[0] || '',
    });

    // Check if all required fields are present
    if (parsed.destination && parsed.days && parsed.budget) {
      return getTripConfirmationMessage(session.tripData);
    } else {
      // Ask for missing fields
      return await askMissingFields(phoneNumber, parsed, session);
    }
  }

  return getFallbackMessage();
}

/**
 * Handle awaiting destination
 */
async function handleAwaitingDestination(phoneNumber, text, session) {
  const parsed = parseTripDetails(text);
  
  if (parsed.destination) {
    await sessionService.updateTripData(phoneNumber, { destination: parsed.destination });
    await sessionService.setState(phoneNumber, 'AWAITING_DAYS');
    return '📅 How many days is your trip?\n\nExample: 3 days';
  }

  return '❌ Please enter a valid city name.\n\nExample: Goa';
}

/**
 * Handle awaiting days
 */
async function handleAwaitingDays(phoneNumber, text, session) {
  const parsed = parseTripDetails(text);
  
  if (parsed.days && parsed.days >= 1 && parsed.days <= 30) {
    await sessionService.updateTripData(phoneNumber, { days: parsed.days });
    await sessionService.setState(phoneNumber, 'AWAITING_BUDGET');
    return '💰 What\'s your total budget?\n\nExample: 10000 or 10k';
  }

  return '❌ Please enter valid number of days (1-30).\n\nExample: 3';
}

/**
 * Handle awaiting budget
 */
async function handleAwaitingBudget(phoneNumber, text, session) {
  const parsed = parseTripDetails(text);
  
  if (parsed.budget && parsed.budget >= 1000) {
    await sessionService.updateTripData(phoneNumber, { budget: parsed.budget });
    await sessionService.setState(phoneNumber, 'MENU');
    return getTripConfirmationMessage(session.tripData);
  }

  return '❌ Please enter a valid budget (₹1000+).\n\nExample: 10000 or 10k';
}

/**
 * Ask for missing fields
 */
async function askMissingFields(phoneNumber, parsed, session) {
  const missing = [];
  
  if (!parsed.destination) missing.push('destination');
  if (!parsed.days) missing.push('days');
  if (!parsed.budget) missing.push('budget');

  if (missing.includes('destination')) {
    await sessionService.setState(phoneNumber, 'AWAITING_DESTINATION');
    return '📍 Where do you want to go?\n\nExample: Goa, Manali, Kerala';
  }
  
  if (missing.includes('days')) {
    await sessionService.setState(phoneNumber, 'AWAITING_DAYS');
    return '📅 How many days is your trip?\n\nExample: 3 days';
  }
  
  if (missing.includes('budget')) {
    await sessionService.setState(phoneNumber, 'AWAITING_BUDGET');
    return '💰 What\'s your total budget?\n\nExample: 10000 or 10k';
  }

  return getFallbackMessage();
}

/**
 * Handle transport
 */
async function handleTransport(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first. Send: "Goa 3 days 10000 2 people"';
  }

  // Add your transport logic here
  return '🚍 Transport options coming soon...';
}

/**
 * Handle hotels
 */
async function handleHotels(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first. Send: "Goa 3 days 10000 2 people"';
  }

  try {
    const { destination, days, budget } = session.tripData;
    const hotelBudget = Math.floor(budget * 0.4);

    const result = await travelEngine.getHotels(destination, hotelBudget, days);

    if (result.success) {
      return result.data;
    }

    return result.message || '⚠️ Hotel information unavailable.';
  } catch (error) {
    logger.error('Hotels error', { error: error.message });
    return '⚠️ Hotel service temporarily unavailable. Please try again.';
  }
}

/**
 * Handle itinerary
 */
async function handleItinerary(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first.';
  }

  try {
    const { destination, days, budget, travelStyle } = session.tripData;
    const perDayBudget = Math.floor(budget / days);

    const result = await travelEngine.getItinerary(
      destination,
      days,
      perDayBudget,
      travelStyle
    );

    if (result.success) {
      return result.data;
    }

    return result.message || '⚠️ Itinerary unavailable.';
  } catch (error) {
    logger.error('Itinerary error', { error: error.message });
    return '⚠️ Itinerary service unavailable. Please try again.';
  }
}

/**
 * Handle budget
 */
async function handleBudget(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first.';
  }

  try {
    const { destination, days, budget, people } = session.tripData;
    const perPerson = Math.floor(budget / (people || 1));

    return `💰 *BUDGET BREAKDOWN*

📍 ${destination} | ${days} days
💵 Total: ₹${budget}
👤 Per Person: ₹${perPerson}

Breakdown:
🏨 Hotels (40%): ₹${Math.floor(budget * 0.4)}
🚍 Transport (30%): ₹${Math.floor(budget * 0.3)}
🍛 Food (20%): ₹${Math.floor(budget * 0.2)}
🎯 Activities (10%): ₹${Math.floor(budget * 0.1)}`;
  } catch (error) {
    return '⚠️ Budget calculation unavailable.';
  }
}

/**
 * Handle weather
 */
async function handleWeather(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first.';
  }

  try {
    const result = await travelEngine.getWeather(session.tripData.destination);
    
    if (result.success) {
      return result.data;
    }

    return result.message || '⚠️ Weather info unavailable.';
  } catch (error) {
    return '⚠️ Weather service unavailable.';
  }
}

/**
 * Handle food guide
 */
async function handleFood(phoneNumber, session) {
  if (!session.tripData?.destination) {
    return '❌ Please plan a trip first.';
  }

  try {
    const result = await travelEngine.getFoodGuide(session.tripData.destination);
    
    if (result.success) {
      return result.data;
    }

    return result.message || '⚠️ Food guide unavailable.';
  } catch (error) {
    return '⚠️ Food guide service unavailable.';
  }
}

/**
 * Get greeting message
 */
function getGreetingMessage() {
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
reset - Start new trip`;
}

/**
 * Get help message
 */
function getHelpMessage() {
  return `📋 Commands:

1️⃣ Plan Trip - Start planning
2️⃣ Transport - Get travel options
3️⃣ Hotels - See hotel recommendations
4️⃣ Itinerary - Get day-wise plan
5️⃣ Budget - Show budget breakdown
6️⃣ Weather - Check weather
7️⃣ Food - Local food guide
reset - Start new trip`;
}

/**
 * Get fallback message
 */
function getFallbackMessage() {
  return `❓ I didn't understand.

Try sending:
• "Goa 3 days 10000 2 people"
• "Plan trip to Manali"

Or type "help" for options.`;
}

/**
 * Get trip confirmation message
 */
function getTripConfirmationMessage(tripData) {
  return `✅ Trip Details Saved!

📍 Destination: ${tripData.destination}
📅 Duration: ${tripData.days} days
💰 Budget: ₹${tripData.budget}
👥 People: ${tripData.people || 1}

Reply:
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
reset - Start new trip`;
}

/**
 * Initialize worker
 */
async function initializeWorker() {
  try {
    const redisClient = getRedisClient();

    worker = new Worker(
      QUEUE_NAME,
      processMessageJob,
      {
        connection: redisClient,
        concurrency: CONCURRENCY,
      }
    );

    // Event: Worker ready
    worker.on('ready', () => {
      logger.info('🚀 Message worker ready', {
        concurrency: CONCURRENCY,
      });
    });

    // Event: Job completed
    worker.on('completed', (job, result) => {
      logger.info('✅ Worker completed job', {
        jobId: job.id,
        phoneNumber: job.data?.phoneNumber,
      });
    });

    // Event: Job failed
    worker.on('failed', (job, error) => {
      logger.error('❌ Worker failed job', {
        jobId: job.id,
        phoneNumber: job.data?.phoneNumber,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    // Event: Error
    worker.on('error', (error) => {
      logger.error('❌ Worker error', {
        error: error.message,
      });
    });

    logger.info('Message worker initialized', {
      queueName: QUEUE_NAME,
      concurrency: CONCURRENCY,
    });

    return worker;
  } catch (error) {
    logger.error('Failed to initialize worker', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Close worker
 */
async function closeWorker() {
  try {
    if (worker) {
      await worker.close();
      worker = null;
      logger.info('Worker closed');
    }
  } catch (error) {
    logger.error('Failed to close worker', {
      error: error.message,
    });
  }
}

module.exports = {
  initializeWorker,
  closeWorker,
  processMessageJob,
  CONCURRENCY,
};

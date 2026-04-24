// Trip Service
// Trip creation, tracking, and feedback management

const Trip = require('../models/Trip');
const User = require('../models/User');
const Analytics = require('../models/Analytics');
const { hashPhoneNumber } = require('../utils/security');
const logger = require('../config/logger');

/**
 * Create a new trip
 */
async function createTrip(phoneNumber, tripData) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const {
      source,
      destination,
      days,
      budget,
      people,
      travelStyle,
    } = tripData;
    
    // Validate required fields
    if (!destination || !days || !budget || !people) {
      throw new Error('Missing required trip data: destination, days, budget, people');
    }
    
    const trip = await Trip.create({
      userPhoneHash: phoneHash,
      source: source || '',
      destination: destination.toLowerCase().trim(),
      days,
      budget,
      people,
      travelStyle: travelStyle || '',
      servicesUsed: [],
      status: 'planning',
    });
    
    // Increment user's trip count
    await User.findOneAndUpdate(
      { phoneHash },
      {
        $inc: { totalTrips: 1 },
        $push: { 'preferences.favoriteDestinations': destination.toLowerCase().trim() },
      }
    );
    
    // Track in analytics
    const today = await Analytics.getToday();
    await today.incrementTrips();
    await today.addDestination(destination);
    
    logger.info('Trip created', {
      tripId: trip._id,
      destination: trip.destination,
      days: trip.days,
      budget: trip.budget,
    });
    
    return trip.toObject();
  } catch (error) {
    logger.error('Failed to create trip', {
      error: error.message,
      phoneNumber: hashPhoneNumber(phoneNumber).substring(0, 10) + '...',
    });
    throw error;
  }
}

/**
 * Update trip data
 */
async function updateTrip(tripId, data) {
  try {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { $set: data },
      { new: true, lean: true }
    );
    
    if (!trip) {
      throw new Error('Trip not found');
    }
    
    logger.info('Trip updated', {
      tripId,
      updates: Object.keys(data),
    });
    
    return trip;
  } catch (error) {
    logger.error('Failed to update trip', {
      error: error.message,
      tripId,
    });
    throw error;
  }
}

/**
 * Add service used to trip
 */
async function addServiceUsed(tripId, service) {
  try {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { $addToSet: { servicesUsed: service } },
      { new: true, lean: true }
    );
    
    if (!trip) {
      throw new Error('Trip not found');
    }
    
    // Track in analytics
    const today = await Analytics.getToday();
    await today.addServiceUsage(service);
    
    return trip;
  } catch (error) {
    logger.error('Failed to add service to trip', {
      error: error.message,
      tripId,
      service,
    });
    return null;
  }
}

/**
 * Complete a trip
 */
async function completeTrip(tripId) {
  try {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
        },
      },
      { new: true, lean: true }
    );
    
    if (!trip) {
      throw new Error('Trip not found');
    }
    
    // Track in analytics
    const today = await Analytics.getToday();
    await today.incrementMessages(); // Track as completed event
    
    logger.info('Trip completed', {
      tripId,
      destination: trip.destination,
      servicesUsed: trip.servicesUsed,
    });
    
    return trip;
  } catch (error) {
    logger.error('Failed to complete trip', {
      error: error.message,
      tripId,
    });
    throw error;
  }
}

/**
 * Cancel a trip
 */
async function cancelTrip(tripId) {
  try {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      },
      { new: true, lean: true }
    );
    
    if (!trip) {
      throw new Error('Trip not found');
    }
    
    logger.info('Trip cancelled', {
      tripId,
    });
    
    return trip;
  } catch (error) {
    logger.error('Failed to cancel trip', {
      error: error.message,
      tripId,
    });
    throw error;
  }
}

/**
 * Get user's trips
 */
async function getUserTrips(phoneNumber, options = {}) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const {
      status,
      limit = 20,
      skip = 0,
      sort = { createdAt: -1 },
    } = options;
    
    const query = { userPhoneHash: phoneHash };
    if (status) query.status = status;
    
    const trips = await Trip.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    
    return trips;
  } catch (error) {
    logger.error('Failed to get user trips', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Get trip by ID
 */
async function getTripById(tripId) {
  try {
    const trip = await Trip.findById(tripId).lean();
    return trip;
  } catch (error) {
    logger.error('Failed to get trip', {
      error: error.message,
      tripId,
    });
    return null;
  }
}

/**
 * Add feedback to trip
 */
async function addFeedback(tripId, rating, comment) {
  try {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      {
        $set: {
          'feedback.rating': rating,
          'feedback.comment': comment || '',
          'feedback.submittedAt': new Date(),
        },
      },
      { new: true, lean: true }
    );
    
    if (!trip) {
      throw new Error('Trip not found');
    }
    
    logger.info('Feedback added', {
      tripId,
      rating,
    });
    
    return trip;
  } catch (error) {
    logger.error('Failed to add feedback', {
      error: error.message,
      tripId,
    });
    throw error;
  }
}

/**
 * Get trip statistics for a user
 */
async function getUserTripStats(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const stats = await Trip.aggregate([
      {
        $match: { userPhoneHash: phoneHash }
      },
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          completedTrips: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledTrips: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          avgBudget: { $avg: '$budget' },
          avgDays: { $avg: '$days' },
          avgPeople: { $avg: '$people' },
        }
      }
    ]).lean();
    
    return stats[0] || {
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      avgBudget: 0,
      avgDays: 0,
      avgPeople: 0,
    };
  } catch (error) {
    logger.error('Failed to get user trip stats', {
      error: error.message,
    });
    return {
      totalTrips: 0,
      completedTrips: 0,
      cancelledTrips: 0,
      avgBudget: 0,
      avgDays: 0,
      avgPeople: 0,
    };
  }
}

/**
 * Get recent trips across all users
 */
async function getRecentTrips(limit = 10) {
  try {
    const trips = await Trip.find({ status: { $ne: 'cancelled' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('destination days budget people travelStyle createdAt')
      .lean();
    
    return trips;
  } catch (error) {
    logger.error('Failed to get recent trips', {
      error: error.message,
    });
    return [];
  }
}

module.exports = {
  createTrip,
  updateTrip,
  addServiceUsed,
  completeTrip,
  cancelTrip,
  getUserTrips,
  getTripById,
  addFeedback,
  getUserTripStats,
  getRecentTrips,
};

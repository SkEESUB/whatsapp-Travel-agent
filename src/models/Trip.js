// Trip Model
// Permanent trip storage with tracking and feedback

const mongoose = require('mongoose');

// Trip schema
const tripSchema = new mongoose.Schema({
  // User reference
  userPhoneHash: {
    type: String,
    required: true,
    index: true,
    trim: true,
  },
  
  // Trip details
  source: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  
  destination: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  
  days: {
    type: Number,
    required: true,
    min: 1,
    max: 365,
  },
  
  budget: {
    type: Number,
    required: true,
    min: 0,
  },
  
  people: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },
  
  travelStyle: {
    type: String,
    enum: ['adventure', 'relaxing', 'religious', 'romantic', 'historical', 'nature', 'party', ''],
    default: '',
  },
  
  // Services used during trip planning
  servicesUsed: [{
    type: String,
    enum: ['hotels', 'transport', 'itinerary', 'budget', 'weather', 'food'],
  }],
  
  // Trip status
  status: {
    type: String,
    enum: ['planning', 'completed', 'cancelled'],
    default: 'planning',
    index: true,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  completedAt: {
    type: Date,
  },
  
  // User feedback
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    submittedAt: {
      type: Date,
    },
  },
}, {
  timestamps: true,
});

// Compound indexes for performance
tripSchema.index({ userPhoneHash: 1, status: 1 });
tripSchema.index({ destination: 1, createdAt: -1 });
tripSchema.index({ status: 1, createdAt: -1 });
tripSchema.index({ createdAt: -1 });

// Virtual: Per person budget
tripSchema.virtual('perPersonBudget').get(function() {
  return Math.floor(this.budget / this.people);
});

// Virtual: Per day budget
tripSchema.virtual('perDayBudget').get(function() {
  return Math.floor(this.budget / this.days);
});

// Virtual: Trip duration in days (completed trips)
tripSchema.virtual('duration').get(function() {
  if (this.completedAt && this.createdAt) {
    const diff = this.completedAt - this.createdAt;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Method: Add service used
tripSchema.methods.addService = async function(service) {
  if (!this.servicesUsed.includes(service)) {
    this.servicesUsed.push(service);
  }
  return this.save();
};

// Method: Complete trip
tripSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method: Cancel trip
tripSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.completedAt = new Date();
  return this.save();
};

// Method: Add feedback
tripSchema.methods.addFeedback = async function(rating, comment) {
  this.feedback = {
    rating,
    comment,
    submittedAt: new Date(),
  };
  return this.save();
};

// Static: Get user trips
tripSchema.statics.getUserTrips = async function(userPhoneHash, options = {}) {
  const {
    status,
    limit = 20,
    skip = 0,
    sort = { createdAt: -1 },
  } = options;

  const query = { userPhoneHash };
  if (status) query.status = status;

  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static: Get popular destinations
tripSchema.statics.getPopularDestinations = async function(days = 30, limit = 10) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        status: { $ne: 'cancelled' },
      }
    },
    {
      $group: {
        _id: '$destination',
        count: { $sum: 1 },
        avgBudget: { $avg: '$budget' },
        avgDays: { $avg: '$days' },
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    },
    {
      $project: {
        name: '$_id',
        count: 1,
        avgBudget: { $round: ['$avgBudget', 0] },
        avgDays: { $round: ['$avgDays', 0] },
      }
    }
  ]).lean();
};

// Static: Get trip statistics
tripSchema.statics.getTripStats = async function(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
      }
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
};

// Static: Get most used services
tripSchema.statics.getPopularServices = async function(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const trips = await this.find({
    createdAt: { $gte: since },
    status: { $ne: 'cancelled' },
  }).select('servicesUsed').lean();

  const serviceCount = {};

  for (const trip of trips) {
    for (const service of trip.servicesUsed) {
      serviceCount[service] = (serviceCount[service] || 0) + 1;
    }
  }

  return Object.entries(serviceCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

// Create model
const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;

// Analytics Model
// Daily aggregated statistics for monitoring and reporting

const mongoose = require('mongoose');

// Analytics schema
const analyticsSchema = new mongoose.Schema({
  // Date (one document per day)
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true,
  },
  
  // Message metrics
  totalMessages: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // User metrics
  totalUsers: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  newUsers: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Trip metrics
  totalTrips: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  completedTrips: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Popular destinations
  popularDestinations: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    count: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  
  // Popular services
  popularServices: [{
    name: {
      type: String,
      required: true,
      enum: ['hotels', 'transport', 'itinerary', 'budget', 'weather', 'food'],
    },
    count: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  
  // Performance metrics
  avgResponseTime: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Error tracking
  errorCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Revenue (if applicable)
  revenue: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for date queries
analyticsSchema.index({ date: -1 });

// Method: Increment message count
analyticsSchema.methods.incrementMessages = async function(count = 1) {
  this.totalMessages += count;
  this.lastUpdated = new Date();
  return this.save();
};

// Method: Increment trip count
analyticsSchema.methods.incrementTrips = async function() {
  this.totalTrips += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Method: Add destination to popular list
analyticsSchema.methods.addDestination = async function(destination) {
  const dest = destination.toLowerCase().trim();
  
  const existing = this.popularDestinations.find(d => d.name === dest);
  
  if (existing) {
    existing.count += 1;
  } else {
    this.popularDestinations.push({ name: dest, count: 1 });
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method: Add service usage
analyticsSchema.methods.addServiceUsage = async function(service) {
  const existing = this.popularServices.find(s => s.name === service);
  
  if (existing) {
    existing.count += 1;
  } else {
    this.popularServices.push({ name: service, count: 1 });
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

// Method: Record error
analyticsSchema.methods.recordError = async function() {
  this.errorCount += 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Method: Update response time (running average)
analyticsSchema.methods.updateResponseTime = async function(responseTime) {
  if (this.avgResponseTime === 0) {
    this.avgResponseTime = responseTime;
  } else {
    // Running average
    this.avgResponseTime = Math.round((this.avgResponseTime + responseTime) / 2);
  }
  this.lastUpdated = new Date();
  return this.save();
};

// Static: Get or create today's analytics
analyticsSchema.statics.getToday = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let analytics = await this.findOne({ date: today }).lean();
  
  if (!analytics) {
    analytics = await this.create({ date: today });
    analytics = analytics.toObject();
  }
  
  return analytics;
};

// Static: Get analytics for specific date
analyticsSchema.statics.getByDate = async function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return this.findOne({ date: targetDate }).lean();
};

// Static: Get analytics for date range
analyticsSchema.statics.getByDateRange = async function(startDate, endDate) {
  return this.find({
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    }
  })
  .sort({ date: -1 })
  .lean();
};

// Static: Get summary for last N days
analyticsSchema.statics.getSummary = async function(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  
  const analytics = await this.find({
    date: { $gte: since }
  })
  .sort({ date: -1 })
  .lean();
  
  // Aggregate
  const summary = {
    totalMessages: 0,
    totalUsers: 0,
    newUsers: 0,
    totalTrips: 0,
    completedTrips: 0,
    errorCount: 0,
    revenue: 0,
    avgResponseTime: 0,
    popularDestinations: [],
    popularServices: [],
  };
  
  for (const day of analytics) {
    summary.totalMessages += day.totalMessages || 0;
    summary.totalUsers += day.totalUsers || 0;
    summary.newUsers += day.newUsers || 0;
    summary.totalTrips += day.totalTrips || 0;
    summary.completedTrips += day.completedTrips || 0;
    summary.errorCount += day.errorCount || 0;
    summary.revenue += day.revenue || 0;
    summary.avgResponseTime += day.avgResponseTime || 0;
    
    // Merge destinations
    for (const dest of day.popularDestinations || []) {
      const existing = summary.popularDestinations.find(d => d.name === dest.name);
      if (existing) {
        existing.count += dest.count;
      } else {
        summary.popularDestinations.push({ ...dest });
      }
    }
    
    // Merge services
    for (const service of day.popularServices || []) {
      const existing = summary.popularServices.find(s => s.name === service.name);
      if (existing) {
        existing.count += service.count;
      } else {
        summary.popularServices.push({ ...service });
      }
    }
  }
  
  // Average response time
  if (analytics.length > 0) {
    summary.avgResponseTime = Math.round(summary.avgResponseTime / analytics.length);
  }
  
  // Sort destinations and services
  summary.popularDestinations.sort((a, b) => b.count - a.count);
  summary.popularServices.sort((a, b) => b.count - a.count);
  
  return summary;
};

// Create model
const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;

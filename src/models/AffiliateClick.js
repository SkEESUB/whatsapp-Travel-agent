// Affiliate Click Model
// Track affiliate link clicks for analytics

const mongoose = require('mongoose');

const affiliateClickSchema = new mongoose.Schema({
  userPhoneHash: {
    type: String,
    required: true,
    index: true,
  },
  platform: {
    type: String,
    required: true,
    enum: ['makemytrip', 'goibibo', 'booking', 'irctc', 'redbus'],
    index: true,
  },
  linkType: {
    type: String,
    required: true,
    enum: ['flight', 'hotel', 'train', 'bus'],
    index: true,
  },
  destination: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  source: {
    type: String,
    lowercase: true,
    trim: true,
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    index: true,
  },
  clickedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  metadata: {
    userAgent: String,
    referrer: String,
    sessionId: String,
  },
}, {
  timestamps: true,
});

// Compound indexes for analytics
affiliateClickSchema.index({ platform: 1, clickedAt: -1 });
affiliateClickSchema.index({ destination: 1, platform: 1 });
affiliateClickSchema.index({ userPhoneHash: 1, clickedAt: -1 });

/**
 * Static: Track a click
 */
affiliateClickSchema.statics.trackClick = async function(clickData) {
  const { userPhoneHash, platform, linkType, destination, source, tripId, metadata } = clickData;

  return this.create({
    userPhoneHash,
    platform,
    linkType,
    destination,
    source,
    tripId,
    metadata,
  });
};

/**
 * Static: Get platform statistics
 */
affiliateClickSchema.statics.getPlatformStats = async function(startDate, endDate) {
  const match = {};
  
  if (startDate || endDate) {
    match.clickedAt = {};
    if (startDate) match.clickedAt.$gte = new Date(startDate);
    if (endDate) match.clickedAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$platform',
        totalClicks: { $sum: 1 },
        uniqueDestinations: { $addToSet: '$destination' },
        lastClick: { $max: '$clickedAt' },
      }
    },
    {
      $project: {
        platform: '$_id',
        totalClicks: 1,
        uniqueDestinations: { $size: '$uniqueDestinations' },
        lastClick: 1,
        _id: 0,
      }
    },
    { $sort: { totalClicks: -1 } },
  ]);

  return stats;
};

/**
 * Static: Get destination statistics
 */
affiliateClickSchema.statics.getDestinationStats = async function(limit = 10) {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$destination',
        totalClicks: { $sum: 1 },
        platforms: { $addToSet: '$platform' },
        linkTypes: { $addToSet: '$linkType' },
      }
    },
    {
      $project: {
        destination: '$_id',
        totalClicks: 1,
        platformCount: { $size: '$platforms' },
        linkTypeCount: { $size: '$linkTypes' },
        _id: 0,
      }
    },
    { $sort: { totalClicks: -1 } },
    { $limit: limit },
  ]);

  return stats;
};

/**
 * Static: Get daily click trends
 */
affiliateClickSchema.statics.getDailyTrends = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const trends = await this.aggregate([
    {
      $match: {
        clickedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
          platform: '$platform',
        },
        clicks: { $sum: 1 },
      }
    },
    {
      $group: {
        _id: '$_id.date',
        platforms: {
          $push: {
            platform: '$_id.platform',
            clicks: '$clicks',
          }
        },
        totalClicks: { $sum: '$clicks' },
      }
    },
    {
      $project: {
        date: '$_id',
        platforms: 1,
        totalClicks: 1,
        _id: 0,
      }
    },
    { $sort: { date: 1 } },
  ]);

  return trends;
};

/**
 * Static: Get user's click history
 */
affiliateClickSchema.statics.getUserClickHistory = async function(userPhoneHash, limit = 20) {
  const clicks = await this.find({ userPhoneHash })
    .sort({ clickedAt: -1 })
    .limit(limit)
    .lean();

  return clicks;
};

/**
 * Static: Get conversion rate by platform
 */
affiliateClickSchema.statics.getPlatformConversionRate = async function(startDate, endDate) {
  const match = {};
  
  if (startDate || endDate) {
    match.clickedAt = {};
    if (startDate) match.clickedAt.$gte = new Date(startDate);
    if (endDate) match.clickedAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$platform',
        totalClicks: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userPhoneHash' },
      }
    },
    {
      $project: {
        platform: '$_id',
        totalClicks: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        _id: 0,
      }
    },
    { $sort: { totalClicks: -1 } },
  ]);

  return stats;
};

const AffiliateClick = mongoose.model('AffiliateClick', affiliateClickSchema);

module.exports = AffiliateClick;

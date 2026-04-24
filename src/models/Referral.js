// Referral Model
// Track referrals, rewards, and bonuses

const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  // Referrer (person who shared the code)
  referrerPhoneHash: {
    type: String,
    required: true,
    index: true,
  },

  // Referred person (new user)
  referredPhoneHash: {
    type: String,
    required: true,
    index: true,
  },

  // Referral code used
  referralCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'abuse_detected'],
    default: 'pending',
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

  // Bonus tracking
  bonusApplied: {
    type: Boolean,
    default: false,
  },

  bonusTripsGiven: {
    type: Number,
    default: 0,
  },

  // Abuse detection
  abuseFlags: {
    type: Number,
    default: 0,
  },

  abuseReason: {
    type: String,
    trim: true,
  },

  // Metadata
  metadata: {
    deviceHash: String,
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Compound indexes
referralSchema.index({ referrerPhoneHash: 1, status: 1 });
referralSchema.index({ referredPhoneHash: 1, status: 1 });
referralSchema.index({ referralCode: 1, status: 1 });
referralSchema.index({ createdAt: -1 });

/**
 * Static: Generate unique referral code
 */
referralSchema.statics.generateUniqueCode = async function() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existing = await this.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
};

/**
 * Static: Get referral statistics for a user
 */
referralSchema.statics.getReferralStats = async function(referrerPhoneHash) {
  const stats = await this.aggregate([
    {
      $match: {
        referrerPhoneHash,
        status: { $ne: 'abuse_detected' },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    totalReferred: 0,
    pendingReferred: 0,
    completedReferred: 0,
    bonusTripsEarned: 0,
  };

  stats.forEach(stat => {
    if (stat._id === 'pending') {
      result.pendingReferred = stat.count;
    } else if (stat._id === 'completed') {
      result.completedReferred = stat.count;
      result.bonusTripsEarned = stat.count * 2; // 2 bonus trips per referral
    }
  });

  result.totalReferred = result.pendingReferred + result.completedReferred;

  return result;
};

/**
 * Static: Get monthly referral count
 */
referralSchema.statics.getMonthlyReferralCount = async function(referrerPhoneHash) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await this.countDocuments({
    referrerPhoneHash,
    status: 'completed',
    createdAt: { $gte: startOfMonth },
  });

  return count;
};

/**
 * Static: Get top referrers leaderboard
 */
referralSchema.statics.getLeaderboard = async function(limit = 10) {
  const leaderboard = await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
      },
    },
    {
      $group: {
        _id: '$referrerPhoneHash',
        totalReferrals: { $sum: 1 },
        bonusTrips: { $sum: 2 },
      },
    },
    {
      $project: {
        phoneHash: '$_id',
        totalReferrals: 1,
        bonusTrips: 1,
        _id: 0,
      },
    },
    { $sort: { totalReferrals: -1 } },
    { $limit: limit },
  ]);

  return leaderboard;
};

/**
 * Static: Check for potential abuse
 */
referralSchema.statics.checkForAbuse = async function(referrerPhoneHash, referredPhoneHash, metadata = {}) {
  const abuseFlags = [];

  // Check 1: Self-referral
  if (referrerPhoneHash === referredPhoneHash) {
    abuseFlags.push('self_referral');
  }

  // Check 2: Same device (if metadata available)
  if (metadata.deviceHash) {
    const sameDeviceReferrals = await this.countDocuments({
      referrerPhoneHash,
      'metadata.deviceHash': metadata.deviceHash,
    });

    if (sameDeviceReferrals > 0) {
      abuseFlags.push('same_device');
    }
  }

  // Check 3: Too many referrals in short time
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentReferrals = await this.countDocuments({
    referrerPhoneHash,
    createdAt: { $gte: last24Hours },
  });

  if (recentReferrals > 10) {
    abuseFlags.push('too_many_referrals');
  }

  // Check 4: Same IP address (if available)
  if (metadata.ipAddress) {
    const sameIPReferrals = await this.countDocuments({
      referrerPhoneHash,
      'metadata.ipAddress': metadata.ipAddress,
    });

    if (sameIPReferrals > 5) {
      abuseFlags.push('same_ip');
    }
  }

  return {
    isAbuse: abuseFlags.length > 0,
    flags: abuseFlags,
  };
};

const Referral = mongoose.model('Referral', referralSchema);

module.exports = Referral;

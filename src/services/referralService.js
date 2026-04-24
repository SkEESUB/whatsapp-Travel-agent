// Referral Service - Viral Growth Engine
// Manages referral codes, rewards, and gamification

const crypto = require('crypto');
const Referral = require('../models/Referral');
const User = require('../models/User');
const logger = require('../config/logger');

// Configuration
const REFERRAL_CONFIG = {
  // Rewards
  referrerBonus: 2,           // Bonus trips for referrer per successful referral
  newUserBonus: 3,            // Bonus trips for new user (instead of standard 5)
  maxBonusPerMonth: 20,       // Max bonus trips from referrals per month
  
  // Code generation
  codeLength: 6,
  codeCharacters: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Removed confusing chars
  
  // WhatsApp
  whatsappBaseUrl: 'https://wa.me',
  whatsappMessageTemplate: 'START REF_{code}',
  
  // Abuse prevention
  maxReferralsPerDay: 10,
  maxReferralsPerMonth: 50,
};

/**
 * Generate unique referral code for user
 */
async function generateReferralCode(phoneNumber) {
  try {
    const { hashPhoneNumber } = require('../utils/security');
    const phoneHash = hashPhoneNumber(phoneNumber);

    // Check if user already has a referral code
    const user = await User.findOne({ phoneHash });
    
    if (user?.referral?.code) {
      logger.info('User already has referral code', {
        phoneNumber,
        code: user.referral.code,
      });
      
      return {
        success: true,
        code: user.referral.code,
        existing: true,
      };
    }

    // Generate unique code
    const code = await Referral.generateUniqueCode();

    // Save to user profile
    const updatedUser = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: {
          'referral.code': code,
          'referral.referralCount': 0,
        },
      },
      { upsert: true, new: true, lean: true }
    );

    logger.info('Referral code generated', {
      phoneNumber,
      code,
    });

    return {
      success: true,
      code,
      existing: false,
    };

  } catch (error) {
    logger.error('Failed to generate referral code', {
      error: error.message,
      phoneNumber,
    });

    return {
      success: false,
      error: 'Failed to generate referral code',
    };
  }
}

/**
 * Apply referral code for new user
 */
async function applyReferralCode(newUserPhone, referralCode, metadata = {}) {
  try {
    const { hashPhoneNumber } = require('../utils/security');
    const referredPhoneHash = hashPhoneNumber(newUserPhone);

    // Find referrer by code
    const referrer = await User.findOne({ 'referral.code': referralCode.toUpperCase() });

    if (!referrer) {
      return {
        success: false,
        error: 'Invalid referral code',
        code: referralCode,
      };
    }

    const referrerPhoneHash = referrer.phoneHash;

    // Check for self-referral
    if (referrerPhoneHash === referredPhoneHash) {
      logger.warn('Self-referral attempt blocked', {
        phoneNumber: newUserPhone,
        code: referralCode,
      });

      return {
        success: false,
        error: 'Cannot use your own referral code',
        selfReferral: true,
      };
    }

    // Check if already referred
    const existingReferral = await Referral.findOne({
      referredPhoneHash,
      status: { $in: ['pending', 'completed'] },
    });

    if (existingReferral) {
      return {
        success: false,
        error: 'Referral code already applied',
        alreadyReferred: true,
      };
    }

    // Check for abuse
    const abuseCheck = await Referral.checkForAbuse(
      referrerPhoneHash,
      referredPhoneHash,
      metadata
    );

    if (abuseCheck.isAbuse) {
      logger.warn('Referral abuse detected', {
        referrerPhoneHash,
        referredPhoneHash,
        flags: abuseCheck.flags,
      });

      // Create referral with abuse flag
      await Referral.create({
        referrerPhoneHash,
        referredPhoneHash,
        referralCode: referralCode.toUpperCase(),
        status: 'abuse_detected',
        abuseFlags: abuseCheck.flags.length,
        abuseReason: abuseCheck.flags.join(', '),
        metadata,
      });

      return {
        success: false,
        error: 'Referral abuse detected',
        abuse: true,
        flags: abuseCheck.flags,
      };
    }

    // Create pending referral
    const referral = await Referral.create({
      referrerPhoneHash,
      referredPhoneHash,
      referralCode: referralCode.toUpperCase(),
      status: 'pending',
      metadata,
    });

    // Give new user bonus trips
    await User.findOneAndUpdate(
      { phoneHash: referredPhoneHash },
      {
        $set: {
          'subscription.plan': 'free',
          'subscription.tripsRemaining': REFERRAL_CONFIG.newUserBonus,
          'referral.referredBy': referrerPhoneHash,
        },
      },
      { upsert: true }
    );

    logger.info('Referral code applied successfully', {
      referrerPhoneHash,
      referredPhoneHash,
      code: referralCode,
    });

    return {
      success: true,
      referral,
      referrerPhoneHash,
      newUserBonus: REFERRAL_CONFIG.newUserBonus,
    };

  } catch (error) {
    logger.error('Failed to apply referral code', {
      error: error.message,
      referralCode,
    });

    return {
      success: false,
      error: 'Failed to apply referral code',
    };
  }
}

/**
 * Complete referral (when new user completes first trip)
 */
async function completeReferral(newUserPhone) {
  try {
    const { hashPhoneNumber } = require('../utils/security');
    const referredPhoneHash = hashPhoneNumber(newUserPhone);

    // Find pending referral
    const referral = await Referral.findOne({
      referredPhoneHash,
      status: 'pending',
    });

    if (!referral) {
      return {
        success: false,
        error: 'No pending referral found',
      };
    }

    // Check monthly bonus limit
    const monthlyCount = await Referral.getMonthlyReferralCount(referral.referrerPhoneHash);
    
    if (monthlyCount * REFERRAL_CONFIG.referrerBonus >= REFERRAL_CONFIG.maxBonusPerMonth) {
      logger.warn('Referrer reached monthly bonus limit', {
        referrerPhoneHash: referral.referrerPhoneHash,
        monthlyCount,
      });

      // Still mark as completed but don't give bonus
      await Referral.findByIdAndUpdate(referral._id, {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          bonusApplied: false,
        },
      });

      return {
        success: true,
        bonusApplied: false,
        reason: 'Monthly bonus limit reached',
      };
    }

    // Update referral to completed
    await Referral.findByIdAndUpdate(referral._id, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        bonusApplied: true,
        bonusTripsGiven: REFERRAL_CONFIG.referrerBonus,
      },
    });

    // Give referrer bonus trips
    await User.findOneAndUpdate(
      { phoneHash: referral.referrerPhoneHash },
      {
        $inc: {
          'subscription.tripsRemaining': REFERRAL_CONFIG.referrerBonus,
          'referral.referralCount': 1,
        },
      }
    );

    logger.info('Referral completed and bonus awarded', {
      referralId: referral._id,
      referrerPhoneHash: referral.referrerPhoneHash,
      bonusTrips: REFERRAL_CONFIG.referrerBonus,
    });

    return {
      success: true,
      bonusApplied: true,
      bonusTrips: REFERRAL_CONFIG.referrerBonus,
    };

  } catch (error) {
    logger.error('Failed to complete referral', {
      error: error.message,
      newUserPhone,
    });

    return {
      success: false,
      error: 'Failed to complete referral',
    };
  }
}

/**
 * Get referral statistics for user
 */
async function getReferralStats(phoneNumber) {
  try {
    const { hashPhoneNumber } = require('../utils/security');
    const phoneHash = hashPhoneNumber(phoneNumber);

    const stats = await Referral.getReferralStats(phoneHash);

    // Get user's referral code
    const user = await User.findOne({ phoneHash }).lean();
    const referralCode = user?.referral?.code;

    return {
      success: true,
      stats: {
        totalReferred: stats.totalReferred,
        pendingReferred: stats.pendingReferred,
        completedReferred: stats.completedReferred,
        bonusTripsEarned: stats.bonusTripsEarned,
        referralCode,
      },
    };

  } catch (error) {
    logger.error('Failed to get referral stats', {
      error: error.message,
      phoneNumber,
    });

    return {
      success: false,
      error: 'Failed to get referral stats',
    };
  }
}

/**
 * Generate referral link for WhatsApp
 */
function generateReferralLink(phoneNumber, referralCode) {
  // Remove country code if present
  const cleanPhone = phoneNumber.replace('+', '').replace(/\D/g, '');
  
  const message = REFERRAL_CONFIG.whatsappMessageTemplate.replace('{code}', referralCode);
  const encodedMessage = encodeURIComponent(message);
  
  return `${REFERRAL_CONFIG.whatsappBaseUrl}/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Format referral message for sharing
 */
function formatReferralMessage(phoneNumber, referralCode, stats) {
  const link = generateReferralLink(phoneNumber, referralCode);
  
  let message = `🎉 *Share & Earn FREE Trips!*\n\n`;
  message += `Share your referral link and get *2 FREE trips* for each friend who joins!\n\n`;
  message += `🔗 *Your Referral Link:*\n${link}\n\n`;
  message += `📊 *Your Stats:*\n`;
  message += `👥 Friends referred: ${stats.totalReferred}\n`;
  message += `✅ Completed referrals: ${stats.completedReferred}\n`;
  message += `⏳ Pending referrals: ${stats.pendingReferred}\n`;
  message += `🎁 Bonus trips earned: ${stats.bonusTripsEarned}\n\n`;
  
  // Add milestone message
  const nextMilestone = getNextMilestone(stats.completedReferred);
  if (nextMilestone) {
    message += `${nextMilestone}\n\n`;
  }
  
  message += `💡 *How it works:*\n`;
  message += `1️⃣ Share your link with friends\n`;
  message += `2️⃣ Friend signs up using your link\n`;
  message += `3️⃣ Friend completes their first trip\n`;
  message += `4️⃣ You get 2 bonus trips! 🎊`;

  return message;
}

/**
 * Get next milestone message
 */
function getNextMilestone(completedReferrals) {
  const milestones = [
    { count: 3, message: "🌟 You're 3 referrals away from *Premium status*! (6 more trips)" },
    { count: 5, message: "🔥 Just 5 referrals to unlock *VIP perks*!" },
    { count: 10, message: "🏆 10 referrals = *Travel Influencer* badge!" },
  ];

  for (const milestone of milestones) {
    if (completedReferrals < milestone.count) {
      const remaining = milestone.count - completedReferrals;
      return `🎯 You're *${remaining} referral${remaining > 1 ? 's' : ''}* away: ${milestone.message.split(':')[1]}`;
    }
  }

  return null;
}

/**
 * Get leaderboard
 */
async function getLeaderboard(limit = 10) {
  try {
    const leaderboard = await Referral.getLeaderboard(limit);

    // Mask phone numbers
    const { maskPhoneNumber } = require('../middleware/adminAuth');
    const maskedLeaderboard = leaderboard.map(entry => ({
      ...entry,
      phone: maskPhoneNumber(entry.phoneHash),
      phoneHash: undefined,
    }));

    return {
      success: true,
      leaderboard: maskedLeaderboard,
    };

  } catch (error) {
    logger.error('Failed to get leaderboard', {
      error: error.message,
    });

    return {
      success: false,
      error: 'Failed to get leaderboard',
    };
  }
}

/**
 * Format leaderboard message
 */
function formatLeaderboardMessage(leaderboard) {
  let message = `🏆 *TOP REFERRERS THIS MONTH*\n\n`;

  const medals = ['🥇', '🥈', '🥉'];

  leaderboard.forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : `${index + 1}.`;
    message += `${medal} ${entry.phone}: ${entry.totalReferrals} referrals (${entry.bonusTrips} bonus trips)\n`;
  });

  message += `\n💡 Share your referral link to climb the leaderboard!`;

  return message;
}

/**
 * Extract referral code from message
 */
function extractReferralCode(message) {
  const patterns = [
    /REF_([A-Z0-9]{6})/i,
    /ref_([A-Z0-9]{6})/i,
    /([A-Z0-9]{6})/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Check if message is referral request
 */
function isReferralRequest(message) {
  const lower = message.toLowerCase();
  return ['refer', 'share', 'referral', 'invite', 'earn'].some(word => lower.includes(word));
}

module.exports = {
  generateReferralCode,
  applyReferralCode,
  completeReferral,
  getReferralStats,
  generateReferralLink,
  formatReferralMessage,
  getLeaderboard,
  formatLeaderboardMessage,
  extractReferralCode,
  isReferralRequest,
  getNextMilestone,
  REFERRAL_CONFIG,
};

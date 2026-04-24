// Payment Service - Razorpay Integration
// Handle subscriptions, payments, and webhook verification

const crypto = require('crypto');
const axios = require('axios');
const logger = require('../config/logger');
const userService = require('./userService');

// Razorpay configuration
const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  baseUrl: 'https://api.razorpay.com/v1',
};

// Subscription plans
const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    price: 0,
    tripsPerMonth: 5,
    features: [
      '5 trips per month',
      'Basic recommendations',
      'Standard response time',
      'Email support',
    ],
  },
  basic: {
    name: 'Basic',
    price: 99, // INR
    tripsPerMonth: 30,
    features: [
      '30 trips per month',
      'All features',
      'Priority response',
      'WhatsApp support',
      'Weather updates',
      'Food guide',
    ],
  },
  premium: {
    name: 'Premium',
    price: 249, // INR
    tripsPerMonth: -1, // unlimited
    features: [
      'Unlimited trips',
      'All features',
      'Fastest response',
      '24/7 WhatsApp support',
      'Exclusive deals',
      'Priority customer service',
      'Custom itineraries',
      'Early access to new features',
    ],
  },
};

/**
 * Create Razorpay payment link
 */
async function createPaymentLink(phoneNumber, plan, options = {}) {
  try {
    const {
      description = `TravelBot ${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
      notes = {},
    } = options;

    const planConfig = SUBSCRIPTION_PLANS[plan];
    
    if (!planConfig || planConfig.price === 0) {
      throw new Error(`Invalid plan or free plan: ${plan}`);
    }

    // Create payment link via Razorpay API
    const amount = planConfig.price * 100; // Convert to paise

    const paymentData = {
      amount,
      currency: 'INR',
      description,
      customer: {
        name: `TravelBot User`,
        contact: phoneNumber,
      },
      notify: {
        sms: true,
        email: false,
      },
      reminder_enable: true,
      notes: {
        phoneNumber,
        plan,
        ...notes,
      },
    };

    const response = await axios.post(
      `${RAZORPAY_CONFIG.baseUrl}/payment_links`,
      paymentData,
      {
        auth: {
          username: RAZORPAY_CONFIG.keyId,
          password: RAZORPAY_CONFIG.keySecret,
        },
      }
    );

    const paymentLink = response.data;

    logger.info('Payment link created', {
      phoneNumber,
      plan,
      amount,
      paymentLinkId: paymentLink.id,
    });

    return {
      success: true,
      paymentLink: paymentLink.short_url,
      paymentId: paymentLink.id,
      amount: amount / 100,
      plan: planConfig,
    };

  } catch (error) {
    logger.error('Failed to create payment link', {
      error: error.message,
      phoneNumber,
      plan,
    });

    return {
      success: false,
      error: 'Failed to create payment link. Please try again later.',
    };
  }
}

/**
 * Verify payment
 */
async function verifyPayment(paymentId) {
  try {
    const response = await axios.get(
      `${RAZORPAY_CONFIG.baseUrl}/payments/${paymentId}`,
      {
        auth: {
          username: RAZORPAY_CONFIG.keyId,
          password: RAZORPAY_CONFIG.keySecret,
        },
      }
    );

    const payment = response.data;

    // Check if payment is captured
    if (payment.status === 'captured') {
      logger.info('Payment verified', {
        paymentId,
        amount: payment.amount / 100,
      });

      return {
        success: true,
        payment,
        amount: payment.amount / 100,
        currency: payment.currency,
      };
    }

    return {
      success: false,
      error: 'Payment not completed',
    };

  } catch (error) {
    logger.error('Payment verification failed', {
      error: error.message,
      paymentId,
    });

    return {
      success: false,
      error: 'Payment verification failed',
    };
  }
}

/**
 * Activate subscription after successful payment
 */
async function activateSubscription(phoneNumber, plan, paymentId) {
  try {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    
    if (!planConfig) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    // Calculate expiry date
    let expiresAt;
    if (plan === 'free') {
      expiresAt = null; // Free doesn't expire
    } else {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription
    }

    // Update user in database
    const updatedUser = await userService.updateUserSubscription(phoneNumber, {
      plan,
      expiresAt,
      tripsRemaining: planConfig.tripsPerMonth,
      paymentId,
    });

    logger.info('Subscription activated', {
      phoneNumber,
      plan,
      expiresAt,
      tripsRemaining: planConfig.tripsPerMonth,
    });

    return {
      success: true,
      user: updatedUser,
      plan: planConfig,
    };

  } catch (error) {
    logger.error('Failed to activate subscription', {
      error: error.message,
      phoneNumber,
      plan,
    });

    return {
      success: false,
      error: 'Failed to activate subscription',
    };
  }
}

/**
 * Check user subscription status
 */
async function checkSubscription(phoneNumber) {
  try {
    const user = await userService.getUserByPhone(phoneNumber);

    if (!user) {
      // User doesn't exist, create with free plan
      const newUser = await userService.createUser(phoneNumber, {
        subscription: {
          plan: 'free',
          expiresAt: null,
          tripsRemaining: SUBSCRIPTION_PLANS.free.tripsPerMonth,
        },
      });

      return {
        plan: 'free',
        isActive: true,
        tripsRemaining: SUBSCRIPTION_PLANS.free.tripsPerMonth,
        user: newUser,
      };
    }

    const subscription = user.subscription || { plan: 'free', tripsRemaining: 5 };

    // Check if subscription expired
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      // Subscription expired, downgrade to free
      await userService.updateUserSubscription(phoneNumber, {
        plan: 'free',
        expiresAt: null,
        tripsRemaining: SUBSCRIPTION_PLANS.free.tripsPerMonth,
      });

      return {
        plan: 'free',
        isActive: true,
        expired: true,
        tripsRemaining: SUBSCRIPTION_PLANS.free.tripsPerMonth,
      };
    }

    return {
      plan: subscription.plan,
      isActive: true,
      expired: false,
      tripsRemaining: subscription.tripsRemaining,
      expiresAt: subscription.expiresAt,
      user,
    };

  } catch (error) {
    logger.error('Failed to check subscription', {
      error: error.message,
      phoneNumber,
    });

    // Return free plan on error
    return {
      plan: 'free',
      isActive: true,
      tripsRemaining: SUBSCRIPTION_PLANS.free.tripsPerMonth,
    };
  }
}

/**
 * Handle Razorpay webhook
 */
async function handleWebhook(event) {
  try {
    const { event: eventType, payload } = event;

    logger.info('Razorpay webhook received', {
      eventType,
      paymentId: payload.payment?.entity?.id,
    });

    switch (eventType) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;

      case 'payment_link.paid':
        await handlePaymentLinkPaid(payload);
        break;

      default:
        logger.debug('Unhandled webhook event', { eventType });
    }

    return { success: true };

  } catch (error) {
    logger.error('Webhook handling failed', {
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Handle payment captured event
 */
async function handlePaymentCaptured(payload) {
  try {
    const payment = payload.payment.entity;
    const { phoneNumber, plan } = payment.notes;

    logger.info('Payment captured', {
      paymentId: payment.id,
      phoneNumber,
      plan,
      amount: payment.amount / 100,
    });

    // Activate subscription
    await activateSubscription(phoneNumber, plan, payment.id);

    // Send confirmation message to user (via queue)
    // This will be handled by the message worker

  } catch (error) {
    logger.error('Failed to handle payment captured', {
      error: error.message,
    });
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(payload) {
  try {
    const payment = payload.payment.entity;
    const { phoneNumber, plan } = payment.notes;

    logger.warn('Payment failed', {
      paymentId: payment.id,
      phoneNumber,
      plan,
      reason: payment.error_description,
    });

    // Could notify user about failed payment

  } catch (error) {
    logger.error('Failed to handle payment failed', {
      error: error.message,
    });
  }
}

/**
 * Handle payment link paid event
 */
async function handlePaymentLinkPaid(payload) {
  try {
    const payment = payload.payment_link.payments[0].entity;
    const { phoneNumber, plan } = payment.notes;

    logger.info('Payment link paid', {
      paymentId: payment.id,
      phoneNumber,
      plan,
    });

    await activateSubscription(phoneNumber, plan, payment.id);

  } catch (error) {
    logger.error('Failed to handle payment link paid', {
      error: error.message,
    });
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(body, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_CONFIG.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  } catch (error) {
    logger.error('Webhook signature verification failed', {
      error: error.message,
    });
    return false;
  }
}

/**
 * Generate upgrade message
 */
function generateUpgradeMessage(phoneNumber) {
  try {
    const basicPlan = SUBSCRIPTION_PLANS.basic;
    const premiumPlan = SUBSCRIPTION_PLANS.premium;

    let message = `🌟 *UPGRADE YOUR PLAN*\n\n`;
    message += `You've used all your free trips this month!\n\n`;
    message += `*Basic Plan - ₹${basicPlan.price}/month*\n`;
    message += `✅ ${basicPlan.tripsPerMonth} trips\n`;
    message += `✅ All features\n`;
    message += `✅ Priority response\n\n`;
    message += `*Premium Plan - ₹${premiumPlan.price}/month*\n`;
    message += `✅ Unlimited trips\n`;
    message += `✅ All features\n`;
    message += `✅ Exclusive deals\n`;
    message += `✅ 24/7 support\n\n`;
    message += `Reply:\n`;
    message += `• "basic" for Basic plan\n`;
    message += `• "premium" for Premium plan`;

    return message;

  } catch (error) {
    logger.error('Failed to generate upgrade message', {
      error: error.message,
    });
    return '🌟 Upgrade to Premium for unlimited trips! Reply "upgrade"';
  }
}

/**
 * Generate payment success message
 */
function generatePaymentSuccessMessage(plan) {
  try {
    const planConfig = SUBSCRIPTION_PLANS[plan];

    let message = `✅ *SUBSCRIPTION ACTIVATED!*\n\n`;
    message += `Plan: ${planConfig.name}\n`;
    message += `Price: ₹${planConfig.price}/month\n\n`;
    message += `Features:\n`;
    planConfig.features.forEach(feature => {
      message += `✓ ${feature}\n`;
    });
    message += `\n`;
    message += `🎉 Enjoy your enhanced travel planning experience!`;

    return message;

  } catch (error) {
    logger.error('Failed to generate payment success message', {
      error: error.message,
    });
    return '✅ Subscription activated! Enjoy your trip planning.';
  }
}

/**
 * Get all subscription plans
 */
function getSubscriptionPlans() {
  return SUBSCRIPTION_PLANS;
}

module.exports = {
  createPaymentLink,
  verifyPayment,
  activateSubscription,
  checkSubscription,
  handleWebhook,
  verifyWebhookSignature,
  generateUpgradeMessage,
  generatePaymentSuccessMessage,
  getSubscriptionPlans,
  SUBSCRIPTION_PLANS,
};

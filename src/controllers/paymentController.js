// Payment Controller
// Handle plan listings, payment links generation, and Razorpay webhook events

const logger = require('../config/logger');
const paymentService = require('../services/paymentService');
const Transaction = require('../models/Transaction');
const { hashPhoneNumber } = require('../utils/security');

/**
 * GET /payment/plans
 * List all available subscription plans
 */
async function getPlans(req, res) {
  try {
    const plans = paymentService.getSubscriptionPlans();
    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    logger.error('Failed to get plans in controller', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}

/**
 * POST /payment/create-link
 * Generate a Razorpay payment link for user subscription
 */
async function createPaymentLink(req, res) {
  try {
    const { phoneNumber, plan } = req.body;

    if (!phoneNumber || !plan) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and plan are required',
      });
    }

    const plans = paymentService.getSubscriptionPlans();
    if (!plans || !plans[plan] || plan === 'free') {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan selected. Choose "basic" or "premium".',
      });
    }

    const result = await paymentService.createPaymentLink(phoneNumber, plan);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Save pending transaction in MongoDB
    const phoneHash = hashPhoneNumber(phoneNumber);
    await Transaction.create({
      userPhoneHash: phoneHash,
      razorpayPaymentLinkId: result.paymentId,
      plan,
      amount: result.amount * 100, // Store in paise
      status: 'pending',
    });

    logger.info('Pending transaction recorded', {
      phoneNumber: phoneHash.substring(0, 10) + '...',
      plan,
      paymentLinkId: result.paymentId,
    });

    return res.status(201).json({
      success: true,
      data: {
        paymentLink: result.paymentLink,
        paymentLinkId: result.paymentId,
        amount: result.amount,
        plan: result.plan.name,
      },
    });
  } catch (error) {
    logger.error('Error generating payment link', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
}

/**
 * POST /payment/webhook
 * Receive events from Razorpay (captured, failed, refund)
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    if (!signature) {
      logger.warn('Razorpay webhook missing signature header');
      return res.status(400).json({ success: false, error: 'Missing signature' });
    }

    // Verify signature
    const isValid = paymentService.verifyWebhookSignature(req.body, signature);
    if (!isValid) {
      logger.warn('Razorpay webhook signature verification failed');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    logger.info(`Razorpay webhook verified: ${event}`);

    // Call service to process business logic (updates user sub, etc.)
    await paymentService.handleWebhook(req.body);

    // Update Transaction model
    let paymentEntity = null;
    if (payload.payment) {
      paymentEntity = payload.payment.entity;
    } else if (payload.payment_link && payload.payment_link.entity) {
      // In payment_link.paid, the payments details might be nested
      const payments = payload.payment_link.entity.payments || [];
      if (payments.length > 0) {
        paymentEntity = payments[0];
      }
    }

    if (paymentEntity) {
      const paymentLinkId = paymentEntity.payment_link_id || payload.payment_link?.entity?.id;
      const paymentId = paymentEntity.id;
      const status = paymentEntity.status; // 'captured', 'failed', 'refunded', etc.
      
      const updateFields = {
        razorpayPaymentId: paymentId,
        completedAt: new Date(),
      };

      if (status === 'captured' || status === 'confirmed') {
        updateFields.status = 'captured';
      } else if (status === 'failed') {
        updateFields.status = 'failed';
      } else if (status === 'refunded') {
        updateFields.status = 'refunded';
      }

      if (paymentLinkId) {
        const updatedTx = await Transaction.findOneAndUpdate(
          { razorpayPaymentLinkId: paymentLinkId },
          { $set: updateFields },
          { new: true }
        );

        if (updatedTx) {
          logger.info('Transaction updated from webhook', {
            txId: updatedTx._id,
            status: updatedTx.status,
          });
        } else {
          logger.warn('Transaction record not found for link ID', { paymentLinkId });
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error handling Razorpay webhook', { error: error.message });
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

module.exports = {
  getPlans,
  createPaymentLink,
  handleWebhook,
};

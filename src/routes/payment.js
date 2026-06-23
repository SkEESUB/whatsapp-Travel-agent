// Payment Routes
// Endpoints for subscription plans, link creation, and payment callbacks

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

/**
 * @route GET /payment/plans
 * @desc Get available subscription plans
 * @access Public
 */
router.get('/plans', paymentController.getPlans);

/**
 * @route POST /payment/create-link
 * @desc Generate Razorpay payment link for a user
 * @access Public (or authenticated client)
 */
router.post('/create-link', paymentController.createPaymentLink);

/**
 * @route POST /payment/webhook
 * @desc Handle Razorpay webhook notifications
 * @access Razorpay
 */
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;

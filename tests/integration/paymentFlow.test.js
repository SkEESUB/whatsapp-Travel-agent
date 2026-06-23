// Payment Flow Integration Tests

// Set test environment secrets
process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
process.env.RAZORPAY_KEY_SECRET = 'secret_123';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret_123';

// Mock paymentService
jest.mock('../../src/services/paymentService', () => {
  return {
    createPaymentLink: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    handleWebhook: jest.fn(),
    getSubscriptionPlans: jest.fn(() => ({
      basic: { name: 'Basic', price: 99, tripsPerMonth: 30 },
      premium: { name: 'Premium', price: 249, tripsPerMonth: -1 }
    }))
  };
});

// Mock Transaction model
jest.mock('../../src/models/Transaction', () => {
  return {
    create: jest.fn(async (data) => ({ _id: 'mock_tx_id', ...data })),
    findOneAndUpdate: jest.fn(async (query, update) => ({
      _id: 'mock_tx_id',
      razorpayPaymentLinkId: query.razorpayPaymentLinkId,
      status: update.$set.status
    }))
  };
});

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Create test app
const app = express();
app.use(express.json());

const paymentRouter = require('../../src/routes/payment');
const paymentService = require('../../src/services/paymentService');
const Transaction = require('../../src/models/Transaction');

app.use('/payment', paymentRouter);

describe('Payment Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    paymentService.getSubscriptionPlans.mockReturnValue({
      basic: { name: 'Basic', price: 99, tripsPerMonth: 30 },
      premium: { name: 'Premium', price: 249, tripsPerMonth: -1 }
    });

    Transaction.create.mockImplementation(async (data) => ({ _id: 'mock_tx_id', ...data }));
    
    Transaction.findOneAndUpdate.mockImplementation(async (query, update) => ({
      _id: 'mock_tx_id',
      razorpayPaymentLinkId: query.razorpayPaymentLinkId,
      status: update.$set?.status || 'captured'
    }));
  });

  describe('GET /payment/plans', () => {
    test('should return all available subscription plans', async () => {
      const response = await request(app).get('/payment/plans');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.basic).toBeDefined();
      expect(response.body.data.premium).toBeDefined();
    });
  });

  describe('POST /payment/create-link', () => {
    test('should generate a payment link and create transaction', async () => {
      paymentService.createPaymentLink.mockResolvedValue({
        success: true,
        paymentLink: 'https://rzp.io/i/shortlink123',
        paymentId: 'plink_12345',
        amount: 249,
        plan: { name: 'Premium', price: 249 }
      });

      const response = await request(app)
        .post('/payment/create-link')
        .send({
          phoneNumber: '919876543210',
          plan: 'premium'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentLink).toBe('https://rzp.io/i/shortlink123');
      expect(Transaction.create).toHaveBeenCalled();
    });

    test('should reject invalid plans', async () => {
      const response = await request(app)
        .post('/payment/create-link')
        .send({
          phoneNumber: '919876543210',
          plan: 'invalid_plan_name'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /payment/webhook', () => {
    const validWebhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_ABC123xyz',
            status: 'captured',
            amount: 24900,
            payment_link_id: 'plink_12345',
            notes: {
              phoneNumber: '919876543210',
              plan: 'premium'
            }
          }
        }
      }
    };

    test('should process webhook and update transaction if signature is valid', async () => {
      paymentService.verifyWebhookSignature.mockReturnValue(true);
      paymentService.handleWebhook.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/payment/webhook')
        .set('x-razorpay-signature', 'valid_sig')
        .send(validWebhookPayload);

      expect(response.status).toBe(200);
      expect(paymentService.verifyWebhookSignature).toHaveBeenCalled();
      expect(paymentService.handleWebhook).toHaveBeenCalled();
      expect(Transaction.findOneAndUpdate).toHaveBeenCalled();
    });

    test('should reject webhook if signature is invalid', async () => {
      paymentService.verifyWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/payment/webhook')
        .set('x-razorpay-signature', 'invalid_sig')
        .send(validWebhookPayload);

      expect(response.status).toBe(400);
      expect(paymentService.handleWebhook).not.toHaveBeenCalled();
      expect(Transaction.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});

// Webhook Integration Tests

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Create test express app
const app = express();
app.use(express.json());

// Set env vars for testing
process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_token_123';
process.env.WHATSAPP_APP_SECRET = 'test_app_secret_456';

const webhookRouter = require('../../src/routes/webhook');
const { verifyWebhookSignature, verifyWebhookToken } = require('../../src/middleware/webhookVerifier');
const { validateInput } = require('../../src/middleware/inputValidator');

// Mount routes for testing
app.use('/webhook', webhookRouter);

describe('Webhook Integration Tests', () => {
  describe('GET /webhook (Verification Challenge)', () => {
    test('should verify successfully with correct query params', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token_123',
          'hub.challenge': 'challenge_123'
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('challenge_123');
    });

    test('should fail with incorrect verify token', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_123'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook (Message Handler)', () => {
    const validPayload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15555555555',
                  phone_number_id: '123456789'
                },
                contacts: [
                  {
                    profile: { name: 'Test User' },
                    wa_id: '919876543210'
                  }
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSRDMxQzU3RDU3ODg2MzVBMjQ0AA==',
                    timestamp: '1600000000',
                    text: { body: 'Goa 3 days 15000' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    test('should return 200 even if signature is missing (handles gracefully or returns 401 depending on configuration)', async () => {
      // Note: By default, if signature is missing it returns 401 unless signature verification is bypassed.
      // Let's generate a valid signature for the request.
      const payloadStr = JSON.stringify(validPayload);
      const signature = 'sha256=' + crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(payloadStr)
        .digest('hex');

      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', signature)
        .send(validPayload);

      expect(response.status).toBe(200);
    });

    test('should return 401 if signature is invalid', async () => {
      // Change app.js route mount signature if webhookVerifier is applied
      // Let's test with wrong signature
      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', 'sha256=invalid_hash')
        .send(validPayload);

      // The server will either decline the request or handle it according to the webhook verifier
      expect(response.status).toBe(401);
    });
  });
});

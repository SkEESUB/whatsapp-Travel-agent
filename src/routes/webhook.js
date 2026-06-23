const express = require("express");
const webhookController = require("../controllers/webhookController");
const { verifyWebhookSignature } = require("../middleware/webhookVerifier");
const { validateInput } = require("../middleware/inputValidator");
const { rateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Verify webhook (GET challenge)
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive messages (POST webhook)
// Apply signature verifier, input validator, and rate limiter
router.post(
  "/",
  verifyWebhookSignature,
  validateInput,
  rateLimiter,
  async (req, res) => {
    try {
      // Always respond to WhatsApp immediately to prevent retries
      res.sendStatus(200);
      
      // Handle the validated message in the background
      await webhookController.handleMessage(req, res, sendMessage);
    } catch (err) {
      console.error('❌ [Webhook Route] Error in handleMessage:', err);
      // Still send 200 to WhatsApp to prevent retries
      if (!res.headersSent) {
        res.sendStatus(200);
      }
    }
  }
);

// Fallback message sender for WhatsApp API communication
const axios = require("axios");
async function sendMessage(to, text) {
  try {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
      console.error('❌ [SendMessage] Missing WhatsApp credentials');
      return;
    }

    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`📤 [SendMessage] Success to ${to}`);
  } catch (err) {
    console.error(
      `❌ [SendMessage] Failed to send message to ${to}:`,
      err.response?.data || err.message
    );
  }
}

module.exports = router;

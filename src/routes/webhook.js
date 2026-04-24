const express = require("express");
const axios = require("axios");
const webhookController = require("../controllers/webhookController");

const router = express.Router();

// Verify webhook
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive messages
router.post("/", async (req, res) => {
  try {
    // Always respond to WhatsApp immediately to prevent retries
    res.sendStatus(200);
    
    // Process message in background
    await webhookController.handleMessage(req, res, sendMessage);
  } catch (err) {
    console.error('❌ [Webhook Route] Error:', err);
    // Still send 200 to WhatsApp to prevent retries
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

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

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
  res.sendStatus(200);
  await webhookController.handleMessage(req, res, sendMessage);
});

async function sendMessage(to, text) {
  try {
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
    console.log(`📤 Message sent to ${to}`);
  } catch (err) {
    console.error(
      "❌ Failed to send message:",
      err.response?.data || err.message
    );
  }
}

module.exports = router;

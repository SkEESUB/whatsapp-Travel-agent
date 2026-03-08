// =====================
// LOAD ENV (MUST BE FIRST)
// =====================
require("dotenv").config();

// =====================
// APP SETUP
// =====================
const express = require("express");
const app = express();

app.use(express.json());

// =====================
// DEBUG (ONCE)
// =====================
console.log("VERIFY TOKEN FROM ENV:", process.env.WHATSAPP_VERIFY_TOKEN);

// =====================
// ROUTES
// =====================
const webhookRoutes = require("./routes/webhook");
app.use("/webhook", webhookRoutes);

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

require("dotenv").config();
const axios = require("axios");

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const res = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );

    console.log("Available models:\n");

    res.data.models.forEach((model) => {
      console.log(model.name);
    });

  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

listModels();
# 🚀 Quick Start Guide - WhatsApp Travel Agent

## Installation (5 minutes)

### Step 1: Install Dependencies
```bash
npm install @google/generative-ai
```

### Step 2: Configure Environment
Edit `.env` file with your credentials:
```env
GEMINI_API_KEY=AIzaSyBr-6Gpmw8LBvyPzKSECNtSE1vHmgv_U_I
GEMINI_MODEL=gemini-1.5-flash
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
```

### Step 3: Start Server
```bash
npm start
```

Expected output:
```
✅ Gemini AI initialized successfully
🚀 Server running on port 3000
```

---

## Testing via WhatsApp (2 minutes)

### Test 1: Greeting
**Send:** `Hi`

**Expected Response:**
```
👋 Hello! Welcome to TravelBot ✈️

Send trip details like:
Delhi 3 days 10000 2 people

Or reply:
1️⃣ Plan Trip
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
6️⃣ Help
```

### Test 2: Save Trip
**Send:** `Goa 3 days 15000 2 people`

**Expected Response:**
```
✅ Trip Saved!

📍 Goa
📅 3 days
💰 ₹15000
👥 2 people
💵 Per person: ₹7500

Reply:
2️⃣ Transport
3️⃣ Hotels
4️⃣ Itinerary
5️⃣ Budget
```

### Test 3: Transport Flow
**Send:** `Transport` or `2`

**Expected Response:**
```
📍 Traveling from which city?
```

**Send:** `Hyderabad`

**Expected Response:**
```
🚍 Choose transport mode:

Bus
Train
Flight
```

**Send:** `train`

**Expected Response:**
```
🚆 Train Options
Hyderabad → Goa

1️⃣ 12779 Vasco Da Gama Express
Depart: 15:40
Arrive: 07:15
Duration: 15h 35m
Classes: SL / 3A / 2A
Price: ₹520–₹1450

2️⃣ 17320 Hyderabad Express
...

[Exactly 4 options]
```

### Test 4: Hotels
**Send:** `hotels` or `3`

**Expected Response:**
```
🏨 Hotels in Goa

💰 Budget: ₹6000
📅 2 night(s)

*Budget Hotels*
• Hotel Blue Moon – ₹1800 – Calangute

• Sea Breeze – ₹2200 – Baga

*Mid-Range*
• Goan Paradise – ₹3500 – Candolim

• Beach Resort – ₹4200 – Anjuna

*Premium*
• Grand Goa – ₹7500 – Panjim
```

### Test 5: Tourist Places
**Send:** `places`

**Expected Response:**
```
🎯 Top Places in Goa

*Must Visit*

1️⃣ Baga Beach
Famous beach with water sports
Best: Evening

2️⃣ Fort Aguada
Historical Portuguese fort
Best: Morning

3️⃣ Dudhsagar Falls
Spectacular waterfall
Best: Monsoon

[6 places total]
```

### Test 6: Itinerary
**Send:** `itinerary` or `4`

**Expected Response:**
```
📅 3-Day Itinerary: Goa

*Day 1*
🌅 Morning: Baga Beach visit
🍽️ Afternoon: Seafood lunch at Brittos
🌆 Evening: Sunset cruise

*Day 2*
🌅 Morning: Fort Aguada
🍽️ Afternoon: Local market
🌆 Evening: Anjuna flea market

*Day 3*
🌅 Morning: Dudhsagar Falls
🍽️ Afternoon: Spice plantation tour
🌆 Evening: Departure
```

### Test 7: Budget
**Send:** `budget` or `5`

**Expected Response:**
```
💰 Budget Plan: Goa

Total: ₹15000 (2 people, 3 days)

*Breakdown*

🚍 Transport: ₹4500
🏨 Hotel: ₹6000
🍽️ Food: ₹3000
🛺 Local Travel: ₹750
🚨 Emergency: ₹750
```

---

## Common Issues & Solutions

### Issue 1: "GEMINI_API_KEY is NOT loaded"
**Solution:** Check `.env` file has correct key format

### Issue 2: Server won't start
**Solution:** Run `npm install` to ensure all dependencies are installed

### Issue 3: Webhook not receiving messages
**Solution:** Verify webhook URL is correctly set in Facebook Developer Console

### Issue 4: "Flights are not available" for all routes
**Solution:** This is correct behavior for short distances (<200km)

---

## Feature Reference Card

| Command | Keyword | What it does |
|---------|---------|--------------|
| **Greeting** | `hi`, `hello`, `hey` | Shows main menu |
| **Plan Trip** | `1`, `plan trip` | Instructions for trip input |
| **Transport** | `2`, `transport` | Starts transport booking flow |
| **Hotels** | `3`, `hotels` | Shows hotel recommendations |
| **Itinerary** | `4`, `itinerary` | Generates day-by-day plan |
| **Budget** | `5`, `budget` | Shows budget breakdown |
| **Help** | `6`, `help` | Shows all commands |
| **Places** | `places` | Shows tourist attractions |

---

## Distance-Based Transport Rules

The bot automatically applies Indian travel logic:

### Short Distance (<200km)
- ✅ Bus: Recommended
- ⚠️ Train: Optional
- ❌ Flight: Not available

**Example:** Mumbai → Pune (150km)

### Medium Distance (200-800km)
- ✅ Train: Recommended
- ⚠️ Bus: Optional
- ⚠️ Flight: Available

**Example:** Hyderabad → Bangalore (575km)

### Long Distance (>800km)
- ⚠️ Bus: Discouraged
- ✅ Train: Optional
- ✅ Flight: Recommended

**Example:** Delhi → Mumbai (1420km)

---

## Session Behavior

### Automatic Reset
Every time you type "Transport", the session resets:
- Previous origin city cleared
- Awaiting origin flag set
- Ready for new journey

### Input Validation
When entering origin city:
- ✅ Accepts: `Hyderabad`
- ❌ Rejects: `Hyderabad 2days 10000`

### Output Formatting
All responses follow strict rules:
- Maximum 4 transport options
- No long paragraphs
- Clean WhatsApp formatting
- Clear spacing between options

---

## Next Steps

Once basic testing works:

1. **Test real routes** - Try different city pairs
2. **Verify distance logic** - Test short/medium/long distances
3. **Check error handling** - Turn off internet temporarily
4. **Review code** - Read `ARCHITECTURE.md` for details
5. **Customize prompts** - Adjust Gemini prompts in services

---

## Support Files

- **ARCHITECTURE.md** - Complete system design
- **MIGRATION_GUIDE.md** - Code changes explained
- **UPGRADE_SUMMARY.md** - Full upgrade documentation

---

**Happy Testing! 🎉**

Questions? Check the documentation files or review inline code comments.

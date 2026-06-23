// Trip Flow Integration Tests

const travelEngine = require('../../src/engine/travelEngine');
const transportService = require('../../src/services/transportService');
const hotelService = require('../../src/services/hotelService');
const itineraryService = require('../../src/services/itineraryService');
const budgetService = require('../../src/services/budgetService');
const weatherService = require('../../src/services/weatherService');
const geminiService = require('../../src/services/geminiService');

// Mock all underlying services
jest.mock('../../src/services/transportService');
jest.mock('../../src/services/hotelService');
jest.mock('../../src/services/itineraryService');
jest.mock('../../src/services/budgetService');
jest.mock('../../src/services/weatherService');
jest.mock('../../src/services/geminiService');

describe('Trip Flow Integration Tests (TravelEngine Orchestration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should retrieve transport options correctly', async () => {
    transportService.getBusOptions.mockResolvedValue('🚌 Bus 1: Hyderabad -> Goa (12h) - Rs 1000\n🚌 Bus 2: AC Sleeper - Rs 1800');
    
    const result = await travelEngine.getTransport('Hyderabad', 'Goa', 'bus', 15000, 2);
    
    expect(result.success).toBe(true);
    expect(result.data).toContain('Bus 1');
    expect(transportService.getBusOptions).toHaveBeenCalledWith('Hyderabad', 'Goa', 15000, 2);
  });

  test('should handle unavailable transport modes based on distance rules', async () => {
    // Flight shouldn't be recommended or might be unavailable for extremely short distances (e.g. Hyderabad to Secunderabad)
    const result = await travelEngine.getTransport('Hyderabad', 'Secunderabad', 'flight', 5000, 1);
    
    // According to distanceRules, this may fail or fall back depending on configuration
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  test('should retrieve hotel recommendations correctly', async () => {
    hotelService.getHotels.mockResolvedValue('🏨 Hotel Budget: Zostel Goa - Rs 800/night\n🏨 Hotel Value: ibis Goa - Rs 3500/night');

    const result = await travelEngine.getHotels('Goa', 15000, 3);

    expect(result.success).toBe(true);
    expect(result.data).toContain('Zostel Goa');
    expect(hotelService.getHotels).toHaveBeenCalledWith('Goa', 15000, 3);
  });

  test('should retrieve itineraries correctly', async () => {
    itineraryService.getItinerary.mockResolvedValue('🌅 Day 1: Beach Visit\n🌞 Day 2: Fort Aguada');

    const result = await travelEngine.getItinerary('Goa', 2, 2, 10000);

    expect(result.success).toBe(true);
    expect(result.data).toContain('Fort Aguada');
    expect(itineraryService.getItinerary).toHaveBeenCalledWith('Goa', 2, 2, 10000);
  });

  test('should retrieve budget calculations correctly', async () => {
    budgetService.getBudgetPlan.mockResolvedValue('🚗 Transport: Rs 2000\n🏨 Accommodation: Rs 4500');

    const result = await travelEngine.getBudget('Goa', 10000, 2, 3);

    expect(result.success).toBe(true);
    expect(result.data).toContain('Accommodation');
    expect(budgetService.getBudgetPlan).toHaveBeenCalledWith('Goa', 10000, 2, 3);
  });

  test('should retrieve weather forecasts correctly', async () => {
    weatherService.getWeather.mockResolvedValue({
      city: 'Goa',
      temperature: 30,
      condition: 'Sunny ☀️',
      windSpeed: 12
    });

    const result = await travelEngine.getWeather('Goa');

    expect(result.success).toBe(true);
    expect(result.data).toContain('Sunny');
    expect(result.data).toContain('30°C');
  });

  test('should generate local food guide using Gemini with fallback', async () => {
    geminiService.generateAIResponse.mockResolvedValue('🍛 *Famous Dishes*\n• Fish Curry Rice\n• Pork Vindaloo');

    const result = await travelEngine.getFoodGuide('Goa');

    expect(result.success).toBe(true);
    expect(result.data).toContain('Fish Curry Rice');
  });
});

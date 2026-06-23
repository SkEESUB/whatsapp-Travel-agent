// Session Service Unit Tests

// Mock Redis config
jest.mock('../../src/config/redis');

const sessionService = require('../../src/services/sessionService');
const redis = require('../../src/config/redis');

describe('Session Service Unit Tests', () => {
  const store = {};

  beforeEach(() => {
    // Clear local store
    for (const key in store) {
      delete store[key];
    }
    jest.clearAllMocks();
    
    // Default mock implementations
    redis.isRedisConnected.mockReturnValue(true);
    redis.executeCommand.mockImplementation(async (command, ...args) => {
      if (command === 'get') {
        const key = args[0];
        return store[key] || null;
      }
      if (command === 'set' || command === 'setex') {
        const key = args[0];
        const val = command === 'setex' ? args[2] : args[1];
        store[key] = val;
        return 'OK';
      }
      if (command === 'del') {
        const key = args[0];
        delete store[key];
        return 1;
      }
      return null;
    });
  });

  test('should create and retrieve a default session if none exists', async () => {
    const phone = '919876543210';
    const session = await sessionService.getSession(phone);

    expect(session).toBeDefined();
    expect(session.phoneNumber).toBe(phone);
    expect(session.state).toBe('MENU');
    expect(session.tripData).toBeDefined();
    expect(redis.executeCommand).toHaveBeenCalledWith('get', `session:${phone}`);
  });

  test('should save and retrieve session from Redis when connected', async () => {
    const phone = '919876543210';
    const originalSession = await sessionService.getSession(phone);
    originalSession.state = 'COLLECTING_DESTINATION';
    originalSession.tripData.destination = 'Goa';

    await sessionService.saveSession(phone, originalSession);

    // Retrieve again
    const retrievedSession = await sessionService.getSession(phone);
    expect(retrievedSession.state).toBe('COLLECTING_DESTINATION');
    expect(retrievedSession.tripData.destination).toBe('Goa');
  });

  test('should fall back to in-memory store when Redis is disconnected', async () => {
    redis.isRedisConnected.mockReturnValue(false);
    const phone = '919876543210';
    
    // Create new session via memory
    const session = await sessionService.getSession(phone);
    session.state = 'MENU';
    session.tripData.destination = 'Manali';
    
    await sessionService.saveSession(phone, session);

    // Retrieve again from memory
    const retrieved = await sessionService.getSession(phone);
    expect(retrieved.tripData.destination).toBe('Manali');
  });
});

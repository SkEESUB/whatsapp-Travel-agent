// Cache Manager Unit Tests

// Mock Redis config
jest.mock('../../src/config/redis');

const cacheManager = require('../../src/cache/cacheManager');
const redis = require('../../src/config/redis');

describe('Cache Manager Unit Tests', () => {
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

    redis.getRedisClient.mockReturnValue({
      keys: jest.fn(async (pattern) => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Object.keys(store).filter(key => regex.test(key));
      })
    });
  });

  describe('normalizeBudgetRange', () => {
    test('should classify budget levels correctly', () => {
      expect(cacheManager.normalizeBudgetRange(4000)).toBe('budget');
      expect(cacheManager.normalizeBudgetRange(12000)).toBe('mid');
      expect(cacheManager.normalizeBudgetRange(25000)).toBe('premium');
      expect(cacheManager.normalizeBudgetRange(50000)).toBe('luxury');
      expect(cacheManager.normalizeBudgetRange(-10)).toBe('unknown');
    });
  });

  describe('Key Generators', () => {
    test('should generate hotel key correctly', () => {
      const key = cacheManager.generateHotelKey('Goa', 12000, 2);
      expect(key).toBe('hotels:goa:mid:2');
    });

    test('should generate itinerary key correctly', () => {
      const key = cacheManager.generateItineraryKey('Manali', 4, 'adventure');
      expect(key).toBe('itinerary:manali:4:adventure');
    });
  });

  describe('Operations', () => {
    test('should set and get values from cache', async () => {
      const key = 'test:key';
      const data = { hello: 'world' };

      await cacheManager.setCache(key, data, 100);
      const retrieved = await cacheManager.getFromCache(key);

      expect(retrieved).toEqual(data);
      expect(redis.executeCommand).toHaveBeenCalledWith('setex', key, 100, JSON.stringify(data));
      expect(redis.executeCommand).toHaveBeenCalledWith('get', key);
    });

    test('should handle cache misses', async () => {
      const key = 'missing:key';
      const retrieved = await cacheManager.getFromCache(key);
      expect(retrieved).toBeNull();
    });

    test('should skip cache if Redis is disconnected', async () => {
      redis.isRedisConnected.mockReturnValue(false);
      const key = 'test:key';
      const data = { hello: 'world' };

      const setSuccess = await cacheManager.setCache(key, data, 100);
      const retrieved = await cacheManager.getFromCache(key);

      expect(setSuccess).toBe(false);
      expect(retrieved).toBeNull();
    });
  });

  describe('cachedCall', () => {
    test('should call fetchFunction on miss and cache result', async () => {
      const key = 'cached:call:key';
      const fetchFn = jest.fn(async () => ({ success: true, value: 'api_data' }));

      const result = await cacheManager.cachedCall(key, 60, fetchFn);

      expect(result.data).toEqual({ success: true, value: 'api_data' });
      expect(result.fromCache).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Call again - should hit cache
      const secondResult = await cacheManager.cachedCall(key, 60, fetchFn);
      expect(secondResult.data).toEqual({ success: true, value: 'api_data' });
      expect(secondResult.fromCache).toBe(true);
      expect(fetchFn).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});

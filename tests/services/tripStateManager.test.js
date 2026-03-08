/**
 * Trip State Manager Tests
 */

const tripStateManager = require('../../src/services/tripStateManager');

describe('Trip State Manager', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    // Clear state before each test
    tripStateManager.clearUserState(testUserId);
  });

  afterAll(() => {
    // Cleanup
    tripStateManager.clearUserState(testUserId);
  });

  describe('getUserState', () => {
    test('should return empty state for new user', () => {
      const state = tripStateManager.getUserState(testUserId);
      
      expect(state.from).toBeNull();
      expect(state.to).toBeNull();
      expect(state.days).toBeNull();
      expect(state.budget).toBeNull();
      expect(state.transportPreference).toBeNull();
    });

    test('should throw error for invalid userId', () => {
      expect(() => tripStateManager.getUserState('')).toThrow('Invalid userId');
      expect(() => tripStateManager.getUserState(null)).toThrow('Invalid userId');
    });
  });

  describe('updateUserState', () => {
    test('should update user state fields', () => {
      const updated = tripStateManager.updateUserState(testUserId, {
        from: 'Delhi',
        to: 'Mumbai',
        days: 5
      });

      expect(updated.from).toBe('Delhi');
      expect(updated.to).toBe('Mumbai');
      expect(updated.days).toBe(5);
    });

    test('should merge with existing state', () => {
      tripStateManager.updateUserState(testUserId, { from: 'Delhi' });
      const updated = tripStateManager.updateUserState(testUserId, { to: 'Mumbai' });

      expect(updated.from).toBe('Delhi');
      expect(updated.to).toBe('Mumbai');
    });

    test('should trim string values', () => {
      const updated = tripStateManager.updateUserState(testUserId, {
        from: '  Delhi  ',
        to: '  Mumbai  '
      });

      expect(updated.from).toBe('Delhi');
      expect(updated.to).toBe('Mumbai');
    });

    test('should convert numeric strings to numbers', () => {
      const updated = tripStateManager.updateUserState(testUserId, {
        days: '7',
        budget: '50000'
      });

      expect(updated.days).toBe(7);
      expect(updated.budget).toBe(50000);
    });
  });

  describe('isTripComplete', () => {
    test('should return false for empty state', () => {
      const state = tripStateManager.getUserState(testUserId);
      expect(tripStateManager.isTripComplete(state)).toBe(false);
    });

    test('should return true when all required fields are filled', () => {
      tripStateManager.updateUserState(testUserId, {
        from: 'Delhi',
        to: 'Mumbai',
        days: 5,
        budget: 50000,
        transportPreference: 'flight'
      });

      const state = tripStateManager.getUserState(testUserId);
      expect(tripStateManager.isTripComplete(state)).toBe(true);
    });

    test('should return false when any required field is missing', () => {
      tripStateManager.updateUserState(testUserId, {
        from: 'Delhi',
        to: 'Mumbai',
        days: 5,
        budget: 50000
        // transportPreference missing
      });

      const state = tripStateManager.getUserState(testUserId);
      expect(tripStateManager.isTripComplete(state)).toBe(false);
    });
  });

  describe('clearUserState', () => {
    test('should clear user state', () => {
      tripStateManager.updateUserState(testUserId, { from: 'Delhi' });
      tripStateManager.clearUserState(testUserId);
      
      const state = tripStateManager.getUserState(testUserId);
      expect(state.from).toBeNull();
    });
  });
});

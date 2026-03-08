/**
 * Validators Tests
 */

const validators = require('../../src/utils/validators');

describe('Validators', () => {
  describe('isValidLocation', () => {
    test('should return true for valid city names', () => {
      expect(validators.isValidLocation('Delhi')).toBe(true);
      expect(validators.isValidLocation('New York')).toBe(true);
      expect(validators.isValidLocation('Mumbai')).toBe(true);
    });

    test('should return false for invalid inputs', () => {
      expect(validators.isValidLocation('')).toBe(false);
      expect(validators.isValidLocation('A')).toBe(false);
      expect(validators.isValidLocation(null)).toBe(false);
      expect(validators.isValidLocation(123)).toBe(false);
    });
  });

  describe('isValidDays', () => {
    test('should return true for valid day counts', () => {
      expect(validators.isValidDays(1)).toBe(true);
      expect(validators.isValidDays(7)).toBe(true);
      expect(validators.isValidDays(30)).toBe(true);
    });

    test('should return false for invalid day counts', () => {
      expect(validators.isValidDays(0)).toBe(false);
      expect(validators.isValidDays(31)).toBe(false);
      expect(validators.isValidDays(-1)).toBe(false);
      expect(validators.isValidDays(3.5)).toBe(false);
    });
  });

  describe('isValidBudget', () => {
    test('should return true for valid budgets', () => {
      expect(validators.isValidBudget(1000)).toBe(true);
      expect(validators.isValidBudget(50000)).toBe(true);
      expect(validators.isValidBudget(10000000)).toBe(true);
    });

    test('should return false for invalid budgets', () => {
      expect(validators.isValidBudget(0)).toBe(false);
      expect(validators.isValidBudget(-1000)).toBe(false);
      expect(validators.isValidBudget(10000001)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    test('should format numbers as Indian Rupees', () => {
      expect(validators.formatCurrency(1000)).toBe('₹1,000');
      expect(validators.formatCurrency(50000)).toBe('₹50,000');
      expect(validators.formatCurrency(100000)).toBe('₹1,00,000');
    });

    test('should handle invalid inputs', () => {
      expect(validators.formatCurrency(null)).toBe('₹0');
      expect(validators.formatCurrency('invalid')).toBe('₹0');
    });
  });
});

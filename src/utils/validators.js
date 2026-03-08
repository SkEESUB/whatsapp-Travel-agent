/**
 * Validation Utilities
 * Common validation functions for travel agent inputs
 */

/**
 * Validates a city/location name
 * @param {string} location - Location to validate
 * @returns {boolean} True if valid
 */
function isValidLocation(location) {
  if (!location || typeof location !== 'string') {
    return false;
  }

  const trimmed = location.trim();

  // Minimum length
  if (trimmed.length < 2) {
    return false;
  }

  // Maximum length
  if (trimmed.length > 100) {
    return false;
  }

  // Should contain mostly letters and spaces
  const validPattern = /^[a-zA-Z\s\-\.',]+$/;
  if (!validPattern.test(trimmed)) {
    return false;
  }

  // Should have at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validates number of days
 * @param {number} days - Days to validate
 * @returns {boolean} True if valid
 */
function isValidDays(days) {
  if (typeof days !== 'number') {
    return false;
  }

  if (!Number.isInteger(days)) {
    return false;
  }

  // Reasonable trip duration: 1 day to 30 days
  if (days < 1 || days > 30) {
    return false;
  }

  return true;
}

/**
 * Validates budget amount
 * @param {number} budget - Budget to validate
 * @returns {boolean} True if valid
 */
function isValidBudget(budget) {
  if (typeof budget !== 'number') {
    return false;
  }

  if (isNaN(budget) || budget <= 0) {
    return false;
  }

  // Maximum reasonable budget (1 crore)
  if (budget > 10000000) {
    return false;
  }

  return true;
}

/**
 * Validates transport preference
 * @param {string} transport - Transport type to validate
 * @returns {boolean} True if valid
 */
function isValidTransportPreference(transport) {
  if (!transport || typeof transport !== 'string') {
    return false;
  }

  const validTypes = ['train', 'bus', 'flight', 'any'];
  return validTypes.includes(transport.toLowerCase());
}

/**
 * Validates WhatsApp phone number ID
 * @param {string} phoneNumberId - Phone number ID to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumberId(phoneNumberId) {
  if (!phoneNumberId || typeof phoneNumberId !== 'string') {
    return false;
  }

  // WhatsApp phone number IDs are numeric strings
  return /^\d{10,20}$/.test(phoneNumberId);
}

/**
 * Validates date string (basic validation)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid format
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Sanitizes user input to prevent injection
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .substring(0, 1000); // Limit length
}

/**
 * Formats a number as Indian Rupees
 * @param {number} amount - Amount to format
 * @returns {string} Formatted string
 */
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '₹0';
  }

  // Format with Indian numbering system
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  return formatter.format(amount);
}

/**
 * Formats a number with commas (Indian format)
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  return num.toLocaleString('en-IN');
}

module.exports = {
  isValidLocation,
  isValidDays,
  isValidBudget,
  isValidTransportPreference,
  isValidPhoneNumberId,
  isValidDate,
  sanitizeInput,
  formatCurrency,
  formatNumber
};

// Intent Detector Unit Tests

const intentDetector = require('../../src/engine/intentDetector');

describe('Intent Detector Unit Tests', () => {
  describe('detectIntent', () => {
    test('should classify GREETING intent', () => {
      const result = intentDetector.detectIntent('hello');
      expect(result.intent).toBe(intentDetector.INTENTS.GREETING);
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should classify GOODBYE intent', () => {
      const result = intentDetector.detectIntent('bye');
      expect(result.intent).toBe(intentDetector.INTENTS.GOODBYE);
    });

    test('should classify HELP intent', () => {
      const result = intentDetector.detectIntent('help me');
      expect(result.intent).toBe(intentDetector.INTENTS.HELP);
    });

    test('should classify SELECT_OPTION intent for numeric selection', () => {
      const result = intentDetector.detectIntent('7');
      expect(result.intent).toBe(intentDetector.INTENTS.SELECT_OPTION);
    });

    test('should classify SELECT_OPTION intent for keyword selection', () => {
      const result = intentDetector.detectIntent('hotel');
      expect(result.intent).toBe(intentDetector.INTENTS.SELECT_OPTION);
    });

    test('should classify NEW_TRIP intent', () => {
      const result = intentDetector.detectIntent('plan a trip to Goa');
      expect(result.intent).toBe(intentDetector.INTENTS.NEW_TRIP);
    });

    test('should return UNKNOWN for arbitrary text', () => {
      const result = intentDetector.detectIntent('random text gibberish');
      expect(result.intent).toBe(intentDetector.INTENTS.UNKNOWN);
    });
  });
});

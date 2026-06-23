// NLP Parser Unit Tests

const nlpParser = require('../../src/engine/nlpParser');

describe('NLP Parser Unit Tests', () => {
  describe('parseIndianNumber', () => {
    test('should parse simple numbers', () => {
      expect(nlpParser.parseIndianNumber('5000')).toBe(5000);
    });

    test('should parse k suffix case-insensitively', () => {
      expect(nlpParser.parseIndianNumber('10k')).toBe(10000);
      expect(nlpParser.parseIndianNumber('12.5K')).toBe(12500);
    });

    test('should parse l/lakh suffix case-insensitively', () => {
      expect(nlpParser.parseIndianNumber('1l')).toBe(100000);
      expect(nlpParser.parseIndianNumber('1.5L')).toBe(150000);
      expect(nlpParser.parseIndianNumber('2.25 lakhs')).toBe(225000);
    });

    test('should parse cr/crore suffix case-insensitively', () => {
      expect(nlpParser.parseIndianNumber('1cr')).toBe(10000000);
      expect(nlpParser.parseIndianNumber('1.2Cr')).toBe(12000000);
    });

    test('should return null for invalid formats', () => {
      expect(nlpParser.parseIndianNumber('abc')).toBeNull();
    });
  });

  describe('extractNumbers', () => {
    test('should extract numbers from a string', () => {
      expect(nlpParser.extractNumbers('budget is 10k for 2 people')).toEqual([10000, 2]);
    });

    test('should handle comma separation in numbers', () => {
      expect(nlpParser.extractNumbers('10,000 budget')).toEqual([10000]);
    });
  });

  describe('findCity', () => {
    test('should identify known cities directly', () => {
      expect(nlpParser.findCity('Goa is my destination')).toBe('goa');
    });

    test('should identify cities by alias', () => {
      expect(nlpParser.findCity('Let\'s go to Bombay')).toBe('mumbai');
      expect(nlpParser.findCity('Visiting Bangalore next week')).toBe('bangalore');
    });

    test('should return null if no known city is mentioned', () => {
      expect(nlpParser.findCity('Let\'s go somewhere nice')).toBeNull();
    });
  });

  describe('extractDays', () => {
    test('should extract day duration from patterns', () => {
      expect(nlpParser.extractDays('3 days trip')).toBe(3);
      expect(nlpParser.extractDays('planning for 5 nights')).toBe(6);
      expect(nlpParser.extractDays('weekend getaway')).toBe(2);
      expect(nlpParser.extractDays('a week in manali')).toBe(7);
    });

    test('should return null if no duration is found', () => {
      expect(nlpParser.extractDays('trip to Leh')).toBeNull();
    });
  });

  describe('extractBudget', () => {
    test('should extract budget when keyword is present', () => {
      expect(nlpParser.extractBudget('budget of 15k')).toBe(15000);
      expect(nlpParser.extractBudget('within 20000 rs')).toBe(20000);
      expect(nlpParser.extractBudget('cost under 5000')).toBe(5000);
    });

    test('should extract budget using heuristic if multiple numbers present', () => {
      expect(nlpParser.extractBudget('15k budget for 2 people')).toBe(15000);
    });
  });

  describe('extractPeople', () => {
    test('should extract number of travelers', () => {
      expect(nlpParser.extractPeople('trip for 2 people')).toBe(2);
      expect(nlpParser.extractPeople('family of 4')).toBe(4);
      expect(nlpParser.extractPeople('going solo')).toBe(1);
    });

    test('should return null if not specified', () => {
      expect(nlpParser.extractPeople('trip to Munnar')).toBeNull();
    });
  });

  describe('parseTripDetails', () => {
    test('should parse complete queries correctly', () => {
      const result = nlpParser.parseTripDetails('Goa 3 days 10000 budget 2 people');
      expect(result).toEqual({
        source: null,
        destination: 'goa',
        days: 3,
        budget: 10000,
        people: 2,
        preferences: null,
        missing: [],
        confidence: 100
      });
    });

    test('should parse partial queries', () => {
      const result = nlpParser.parseTripDetails('Manali for 4 days');
      expect(result).toEqual({
        source: null,
        destination: 'manali',
        days: 4,
        budget: 4,
        people: 1,
        preferences: null,
        missing: [],
        confidence: 100
      });
    });
  });
});

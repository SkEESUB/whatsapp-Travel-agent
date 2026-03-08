/**
 * Budget Estimation Service
 * Allocates total budget across different expense categories
 * Uses percentage-based allocation to stay within budget
 */

/**
 * Default budget allocation percentages
 * These percentages ensure the total stays under 100% to provide buffer
 */
const DEFAULT_ALLOCATION = {
  transport: 0.30,      // 30% for transport
  stay: 0.25,           // 25% for accommodation
  food: 0.20,           // 20% for food
  localTravel: 0.10,    // 10% for local transport
  buffer: 0.15          // 15% buffer for unexpected expenses
};

/**
 * Minimum daily costs per category (in ₹) for reference
 * Used to validate if budget is realistic
 */
const MINIMUM_DAILY_COSTS = {
  stay: 800,        // Budget hotel per night
  food: 500,        // Basic meals per day
  localTravel: 200  // Local transport per day
};

/**
 * Generates budget breakdown based on transport cost, days, and total budget
 * @param {number} transportCost - Cost of transport (one-way or round-trip)
 * @param {number} days - Number of days for the trip
 * @param {number} budget - Total budget available
 * @returns {Object} Budget breakdown with allocations
 */
function estimateBudget(transportCost, days, budget) {
  // Validate inputs
  if (typeof transportCost !== 'number' || transportCost < 0) {
    throw new Error('Invalid transportCost: must be a non-negative number');
  }

  if (typeof days !== 'number' || days <= 0 || !Number.isInteger(days)) {
    throw new Error('Invalid days: must be a positive integer');
  }

  if (typeof budget !== 'number' || budget <= 0) {
    throw new Error('Invalid budget: must be a positive number');
  }

  // Ensure transport cost doesn't exceed budget
  if (transportCost >= budget) {
    return {
      isValid: false,
      error: 'Transport cost exceeds total budget',
      transport: transportCost,
      days,
      totalBudget: budget,
      remainingBudget: budget - transportCost,
      breakdown: null
    };
  }

  // Calculate remaining budget after transport
  const remainingBudget = budget - transportCost;

  // Calculate allocations based on remaining budget
  const breakdown = calculateBreakdown(remainingBudget, days);

  // Check if budget is realistic for the number of days
  const minimumRequired = calculateMinimumRequired(days);
  const isRealistic = remainingBudget >= minimumRequired;

  return {
    isValid: true,
    isRealistic,
    transport: Math.round(transportCost),
    days,
    totalBudget: Math.round(budget),
    remainingBudget: Math.round(remainingBudget),
    minimumRequired: Math.round(minimumRequired),
    breakdown: {
      transport: {
        amount: Math.round(transportCost),
        percentage: Math.round((transportCost / budget) * 100),
        note: 'Round-trip transport cost'
      },
      stay: {
        amount: Math.round(breakdown.stay.total),
        daily: Math.round(breakdown.stay.daily),
        percentage: Math.round((breakdown.stay.total / budget) * 100),
        note: `Accommodation for ${days} nights`
      },
      food: {
        amount: Math.round(breakdown.food.total),
        daily: Math.round(breakdown.food.daily),
        percentage: Math.round((breakdown.food.total / budget) * 100),
        note: `Meals for ${days} days`
      },
      localTravel: {
        amount: Math.round(breakdown.localTravel.total),
        daily: Math.round(breakdown.localTravel.daily),
        percentage: Math.round((breakdown.localTravel.total / budget) * 100),
        note: 'Local transport, taxis, auto-rickshaws'
      },
      buffer: {
        amount: Math.round(breakdown.buffer.total),
        percentage: Math.round((breakdown.buffer.total / budget) * 100),
        note: 'Emergency fund, shopping, entry fees'
      }
    },
    summary: {
      allocated: Math.round(transportCost + breakdown.stay.total + breakdown.food.total + breakdown.localTravel.total + breakdown.buffer.total),
      unallocated: Math.round(budget - (transportCost + breakdown.stay.total + breakdown.food.total + breakdown.localTravel.total + breakdown.buffer.total)),
      dailyAverage: Math.round(budget / days)
    },
    disclaimer: 'These are estimates. Actual costs may vary based on location, season, and personal preferences.'
  };
}

/**
 * Calculates breakdown of remaining budget across categories
 * @param {number} remainingBudget - Budget after transport
 * @param {number} days - Number of days
 * @returns {Object} Breakdown by category
 */
function calculateBreakdown(remainingBudget, days) {
  // Adjust allocation percentages if needed
  // For longer trips, reduce daily buffer slightly
  let allocation = { ...DEFAULT_ALLOCATION };
  
  if (days > 7) {
    // For longer trips, slightly reduce buffer to increase daily allowances
    allocation.buffer = 0.12;
    allocation.stay = 0.28;
    allocation.food = 0.22;
  }

  // Normalize to ensure total is 1.0
  const totalRatio = allocation.stay + allocation.food + allocation.localTravel + allocation.buffer;
  const normalizedFactor = 1 / totalRatio;

  const stayShare = remainingBudget * allocation.stay * normalizedFactor;
  const foodShare = remainingBudget * allocation.food * normalizedFactor;
  const localTravelShare = remainingBudget * allocation.localTravel * normalizedFactor;
  const bufferShare = remainingBudget * allocation.buffer * normalizedFactor;

  return {
    stay: {
      total: stayShare,
      daily: stayShare / days
    },
    food: {
      total: foodShare,
      daily: foodShare / days
    },
    localTravel: {
      total: localTravelShare,
      daily: localTravelShare / days
    },
    buffer: {
      total: bufferShare
    }
  };
}

/**
 * Calculates minimum required budget for the trip
 * @param {number} days - Number of days
 * @returns {number} Minimum required amount
 */
function calculateMinimumRequired(days) {
  return (
    MINIMUM_DAILY_COSTS.stay * days +
    MINIMUM_DAILY_COSTS.food * days +
    MINIMUM_DAILY_COSTS.localTravel * days
  );
}

/**
 * Gets suggested budget range for a trip
 * @param {number} days - Number of days
 * @param {string} comfortLevel - 'budget', 'standard', or 'luxury'
 * @returns {Object} Suggested budget range
 */
function getSuggestedBudget(days, comfortLevel = 'standard') {
  if (typeof days !== 'number' || days <= 0) {
    throw new Error('Invalid days: must be a positive number');
  }

  const multipliers = {
    budget: 1500,      // ₹1500 per day
    standard: 3000,    // ₹3000 per day
    luxury: 8000       // ₹8000 per day
  };

  const multiplier = multipliers[comfortLevel] || multipliers.standard;
  const baseAmount = days * multiplier;

  // Add transport estimate (assuming average ₹2000 for budget, ₹5000 for standard, ₹15000 for luxury)
  const transportEstimates = {
    budget: 2000,
    standard: 5000,
    luxury: 15000
  };

  const transportEstimate = transportEstimates[comfortLevel] || transportEstimates.standard;

  return {
    comfortLevel,
    days,
    suggestedMin: Math.round(baseAmount + transportEstimate * 0.7),
    suggestedMax: Math.round(baseAmount + transportEstimate * 1.3),
    dailyEstimate: multiplier,
    transportEstimate,
    note: 'Estimates are for planning purposes. Actual costs vary by destination and season.'
  };
}

module.exports = {
  estimateBudget,
  getSuggestedBudget,
  calculateMinimumRequired,
  DEFAULT_ALLOCATION
};

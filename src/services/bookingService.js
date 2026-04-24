// Booking Service - Affiliate Link Generation
// Generate booking links for MakeMyTrip, Goibibo, Booking.com, IRCTC, RedBus

const logger = require('../config/logger');

// Affiliate configuration
const AFFILIATE_CONFIG = {
  makemytrip: {
    baseUrl: 'https://www.makemytrip.com',
    trackingParam: '?utm_source=wabot&utm_medium=affiliate&utm_campaign=travelbot',
    affiliateId: process.env.MMT_AFFILIATE_ID || '',
  },
  goibibo: {
    baseUrl: 'https://www.goibibo.com',
    trackingParam: '?utm_source=wabot&utm_medium=affiliate',
    affiliateId: process.env.GOIBIBO_AFFILIATE_ID || '',
  },
  booking: {
    baseUrl: 'https://www.booking.com',
    trackingParam: '?aid=wabot&affiliate_id=travelbot',
    affiliateId: process.env.BOOKING_AFFILIATE_ID || '',
  },
  irctc: {
    baseUrl: 'https://www.irctc.co.in',
    // IRCTC doesn't have affiliate program, just direct links
  },
  redbus: {
    baseUrl: 'https://www.redbus.in',
    trackingParam: '?affiliate_id=wabot',
    affiliateId: process.env.REDBUS_AFFILIATE_ID || '',
  },
};

/**
 * Generate MakeMyTrip flight search link
 */
function generateMMTFlightLink(source, dest, date, options = {}) {
  try {
    const { affiliateId = AFFILIATE_CONFIG.makemytrip.affiliateId } = options;
    
    // Format: from city code, to city code, date (DD-MM-YYYY)
    const fromDate = formatDate(date, 'DD-MM-YYYY');
    
    const url = `${AFFILIATE_CONFIG.makemytrip.baseUrl}/flights/?` +
      `from=${encodeURIComponent(source)}&` +
      `to=${encodeURIComponent(dest)}&` +
      `departDate=${fromDate}&` +
      `class=E&` +
      `adults=1&` +
      `children=0&` +
      `infants=0` +
      `&utm_source=wabot&ref=${affiliateId}`;

    logger.debug('Generated MMT flight link', { source, dest, date });
    return url;

  } catch (error) {
    logger.error('Failed to generate MMT flight link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate MakeMyTrip hotel search link
 */
function generateMMTHotelLink(dest, checkin, checkout, options = {}) {
  try {
    const { affiliateId = AFFILIATE_CONFIG.makemytrip.affiliateId } = options;
    
    const checkinDate = formatDate(checkin, 'DD-MM-YYYY');
    const checkoutDate = formatDate(checkout, 'DD-MM-YYYY');

    const url = `${AFFILIATE_CONFIG.makemytrip.baseUrl}/hotels/?` +
      `checkin=${checkinDate}&` +
      `checkout=${checkoutDate}&` +
      `city=${encodeURIComponent(dest)}&` +
      `room=1&` +
      `adults=2` +
      `&utm_source=wabot&ref=${affiliateId}`;

    logger.debug('Generated MMT hotel link', { dest, checkin, checkout });
    return url;

  } catch (error) {
    logger.error('Failed to generate MMT hotel link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate Goibibo flight search link
 */
function generateGoibiboFlightLink(source, dest, date, options = {}) {
  try {
    const { affiliateId = AFFILIATE_CONFIG.goibibo.affiliateId } = options;
    
    const fromDate = formatDate(date, 'YYYY-MM-DD');

    const url = `${AFFILIATE_CONFIG.goibibo.baseUrl}/flights/?` +
      `from=${encodeURIComponent(source)}&` +
      `to=${encodeURIComponent(dest)}&` +
      `date=${fromDate}&` +
      `adults=1` +
      `&utm_source=wabot&ref=${affiliateId}`;

    logger.debug('Generated Goibibo flight link', { source, dest, date });
    return url;

  } catch (error) {
    logger.error('Failed to generate Goibibo flight link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate Booking.com hotel search link
 */
function generateBookingComLink(dest, checkin, checkout, options = {}) {
  try {
    const { affiliateId = AFFILIATE_CONFIG.booking.affiliateId } = options;
    
    const checkinDate = formatDate(checkin, 'YYYY-MM-DD');
    const checkoutDate = formatDate(checkout, 'YYYY-MM-DD');

    const url = `${AFFILIATE_CONFIG.booking.baseUrl}/search.html?` +
      `ss=${encodeURIComponent(dest)}&` +
      `checkin=${checkinDate}&` +
      `checkout=${checkoutDate}&` +
      `group_adults=2&` +
      `no_rooms=1` +
      `&aid=wabot&affiliate_id=${affiliateId}`;

    logger.debug('Generated Booking.com link', { dest, checkin, checkout });
    return url;

  } catch (error) {
    logger.error('Failed to generate Booking.com link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate IRCTC train search link
 */
function generateIRCTCLink(source, dest, date, options = {}) {
  try {
    // IRCTC doesn't support deep linking with affiliate tracking
    // Direct to search page with parameters
    
    const url = `${AFFILIATE_CONFIG.irctc.baseUrl}/ctbs/train/trainsearch.aspx?` +
      `fromStationCode=${encodeURIComponent(source)}&` +
      `toStationCode=${encodeURIComponent(dest)}&` +
      `date=${formatDate(date, 'DD/MM/YYYY')}`;

    logger.debug('Generated IRCTC train link', { source, dest, date });
    return url;

  } catch (error) {
    logger.error('Failed to generate IRCTC link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate RedBus bus search link
 */
function generateRedBusLink(source, dest, date, options = {}) {
  try {
    const { affiliateId = AFFILIATE_CONFIG.redbus.affiliateId } = options;
    
    const searchDate = formatDate(date, 'YYYY-MM-DD');

    const url = `${AFFILIATE_CONFIG.redbus.baseUrl}/bus-tickets/` +
      `${encodeURIComponent(source.toLowerCase())}-to-${encodeURIComponent(dest.toLowerCase())}` +
      `?date=${searchDate}` +
      `&affiliate_id=${affiliateId}`;

    logger.debug('Generated RedBus link', { source, dest, date });
    return url;

  } catch (error) {
    logger.error('Failed to generate RedBus link', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Generate all booking links for a trip
 */
function generateAllLinks(tripData) {
  try {
    const {
      destination,
      source = 'Delhi',
      days = 3,
      date = new Date(),
      checkin,
      checkout,
    } = tripData;

    // Calculate dates
    const checkinDate = checkin || date;
    const checkoutDate = checkout || addDays(checkinDate, days);

    const links = {
      flights: {
        makemytrip: generateMMTFlightLink(source, destination, checkinDate),
        goibibo: generateGoibiboFlightLink(source, destination, checkinDate),
      },
      hotels: {
        makemytrip: generateMMTHotelLink(destination, checkinDate, checkoutDate),
        bookingcom: generateBookingComLink(destination, checkinDate, checkoutDate),
      },
      trains: {
        irctc: generateIRCTCLink(source, destination, checkinDate),
      },
      buses: {
        redbus: generateRedBusLink(source, destination, checkinDate),
      },
    };

    logger.info('Generated all booking links', { destination });
    return links;

  } catch (error) {
    logger.error('Failed to generate all booking links', {
      error: error.message,
    });
    return {};
  }
}

/**
 * Format booking message with all links
 */
function formatBookingMessage(tripData, links) {
  try {
    const { destination, source = 'Delhi' } = tripData;

    let message = `🔗 *BOOK YOUR TRIP TO ${destination.toUpperCase()}*\n\n`;

    // Flights
    if (links.flights) {
      message += `✈️ *Flights:*\n`;
      if (links.flights.makemytrip) {
        message += `• MakeMyTrip: ${links.flights.makemytrip}\n`;
      }
      if (links.flights.goibibo) {
        message += `• Goibibo: ${links.flights.goibibo}\n`;
      }
      message += `\n`;
    }

    // Hotels
    if (links.hotels) {
      message += `🏨 *Hotels:*\n`;
      if (links.hotels.makemytrip) {
        message += `• MakeMyTrip: ${links.hotels.makemytrip}\n`;
      }
      if (links.hotels.bookingcom) {
        message += `• Booking.com: ${links.hotels.bookingcom}\n`;
      }
      message += `\n`;
    }

    // Trains
    if (links.trains?.irctc) {
      message += `🚂 *Trains:*\n`;
      message += `• IRCTC: ${links.trains.irctc}\n\n`;
    }

    // Buses
    if (links.buses?.redbus) {
      message += `🚌 *Buses:*\n`;
      message += `• RedBus: ${links.buses.redbus}\n\n`;
    }

    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💡 Book through these links to support us!`;

    return message;

  } catch (error) {
    logger.error('Failed to format booking message', {
      error: error.message,
    });
    return '🔗 Booking links will be available soon!';
  }
}

/**
 * Helper: Format date
 */
function formatDate(date, format) {
  try {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) {
      // If invalid date, return today
      const today = new Date();
      return format.replace('DD', String(today.getDate()).padStart(2, '0'))
                   .replace('MM', String(today.getMonth() + 1).padStart(2, '0'))
                   .replace('YYYY', today.getFullYear());
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);

  } catch (error) {
    logger.error('Date formatting error', { error: error.message });
    return '01-01-2025';
  }
}

/**
 * Helper: Add days to date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

module.exports = {
  generateMMTFlightLink,
  generateMMTHotelLink,
  generateGoibiboFlightLink,
  generateBookingComLink,
  generateIRCTCLink,
  generateRedBusLink,
  generateAllLinks,
  formatBookingMessage,
  AFFILIATE_CONFIG,
};

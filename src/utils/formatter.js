// Formatter Utility - Clean WhatsApp formatting helper functions
// Ensures responses are readable on mobile devices

class Formatter {
  /**
   * Format text for WhatsApp (bold, italic, monospace)
   * @param {string} text - Text to format
   * @param {string} style - bold, italic, monospace, strikethrough
   * @returns {string} - Formatted text
   */
  static format(text, style = 'normal') {
    if (!text) return '';
    
    switch (style) {
      case 'bold':
        return `*${text}*`;
      case 'italic':
        return `_${text}_`;
      case 'monospace':
        return `\`\`\`${text}\`\`\``;
      case 'strikethrough':
        return `~${text}~`;
      default:
        return text;
    }
  }

  /**
   * Create header for sections
   * @param {string} title - Section title
   * @param {string} emoji - Emoji prefix
   * @returns {string} - Formatted header
   */
  static header(title, emoji = '') {
    return `${emoji} *${title.toUpperCase()}*\n\n`;
  }

  /**
   * Create separator line
   * @param {number} length - Length of separator
   * @returns {string} - Separator string
   */
  static separator(length = 40) {
    return '─'.repeat(length);
  }

  /**
   * Format table row for WhatsApp
   * @param {array} columns - Array of column values
   * @param {number} maxWidth - Maximum width per column
   * @returns {string} - Formatted row
   */
  static tableRow(columns, maxWidth = 15) {
    return columns.map(col => {
      const str = String(col);
      return str.length > maxWidth ? str.substring(0, maxWidth) + '...' : str.padEnd(maxWidth);
    }).join(' | ');
  }

  /**
   * Add bullet point to line
   * @param {string} text - Text content
   * @param {string} symbol - Bullet symbol
   * @returns {string} - Bulleted text
   */
  static bullet(text, symbol = '•') {
    return `${symbol} ${text}\n`;
  }

  /**
   * Add number to line
   * @param {number} num - Number
   * @param {string} text - Text content
   * @returns {string} - Numbered text
   */
  static numbered(num, text) {
    return `${num}. ${text}\n`;
  }

  /**
   * Format price in INR
   * @param {number} amount - Amount in rupees
   * @returns {string} - Formatted price
   */
  static price(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Format time duration
   * @param {number} hours - Hours
   * @param {number} minutes - Minutes
   * @returns {string} - Formatted duration
   */
  static duration(hours, minutes = 0) {
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '0m';
  }

  /**
   * Truncate long text for mobile
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} - Truncated text
   */
  static truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Add spacing between sections
   * @param {number} lines - Number of blank lines
   * @returns {string} - Spacing string
   */
  static spacing(lines = 1) {
    return '\n'.repeat(lines);
  }

  /**
   * Format rating with stars
   * @param {number} rating - Rating out of 5
   * @returns {string} - Star rating
   */
  static rating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return '⭐'.repeat(fullStars) + (hasHalfStar ? '½' : '');
  }

  /**
   * Create info line with label and value
   * @param {string} label - Label text
   * @param {string} value - Value text
   * @param {string} emoji - Optional emoji
   * @returns {string} - Formatted info line
   */
  static info(label, value, emoji = '') {
    return `${emoji} *${label}:* ${value}\n`;
  }

  // ===== Travel Engine Formatters (Added for Transport / Hotel / Itinerary) =====

  /**
   * Format transport results from Gemini
   * @param {string} response - Raw response from Gemini
   * @returns {string} - Formatted or fallback message
   */
  static formatTransportOptions(response) {
    if (!response || typeof response !== 'string' || response.trim() === '') {
      return "⚠️ Travel information temporarily unavailable. Please try again later.";
    }
    return response;
  }

  /**
   * Format hotel results from Gemini
   * @param {string} response - Raw response from Gemini
   * @returns {string} - Formatted or fallback message
   */
static formatHotelOptions(response) {

  if (!response || typeof response !== "string" || response.trim() === "") {
    return "⚠️ Hotel information temporarily unavailable.";
  }

  const lines = response.split("\n").filter(l => l.trim());

  let formatted = "🏨 HOTEL OPTIONS\n\n";

  lines.slice(0,5).forEach((line, i) => {
    const parts = line.split("–").map(p => p.trim());

    if (parts.length >= 3) {
      formatted += `🏨 ${i + 1}. ${parts[0]}\n`;
      formatted += `💰 Price: ${parts[1]}\n`;
      formatted += `📍 Location: ${parts[2]}\n`;
      formatted += `──────────────\n`;
    }
  });

  formatted += "\n💡 Booking Tips\n";
  formatted += "• Choose hotels near city center\n";
  formatted += "• Compare ratings before booking\n";

  return formatted;
}

  /**
   * Format itinerary results from Gemini
   * @param {string} response - Raw response from Gemini
   * @returns {string} - Formatted or fallback message
   */
static formatItinerary(response) {

  if (!response || typeof response !== "string" || response.trim() === "") {
    return "⚠️ Itinerary generation failed.";
  }

  const days = response.split("Day").filter(d => d.trim());

  let formatted = "🗺 TRAVEL ITINERARY\n\n";

  days.slice(0,5).forEach((day, i) => {

    const parts = day.trim().split("\n").filter(l => l.trim());

    formatted += `📅 Day ${i+1}\n`;

    parts.forEach(line => {

      if (line.toLowerCase().includes("morning"))
        formatted += `🌅 ${line}\n`;

      else if (line.toLowerCase().includes("afternoon"))
        formatted += `🍽 ${line}\n`;

      else if (line.toLowerCase().includes("evening"))
        formatted += `🌆 ${line}\n`;

      else
        formatted += `${line}\n`;

    });

    formatted += `──────────────\n`;
  });

  formatted += "\n💡 Travel Tips\n";
  formatted += "• Start early to avoid crowds\n";
  formatted += "• Use local transport for faster travel\n";

  return formatted;
}
}

module.exports = Formatter;

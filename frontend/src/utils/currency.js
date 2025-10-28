/**
 * Utility functions for PHP peso currency formatting
 */

/**
 * Format amount as PHP peso currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted PHP peso string
 */
export const formatPHPCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'PHP 0.00';
  }
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format amount as compact PHP peso currency (for display in tight spaces)
 * @param {number} amount - The amount to format
 * @returns {string} Formatted PHP peso string without decimals if whole number
 */
export const formatPHPCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'PHP 0';
  }
  
  const isWholeNumber = amount % 1 === 0;
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Get PHP peso symbol
 * @returns {string} PHP peso symbol
 */
export const getPHPSymbol = () => '₱';

/**
 * Get PHP currency code
 * @returns {string} PHP currency code
 */
export const getPHPCurrencyCode = () => 'PHP';

/**
 * Calculate the number of working days between two dates (excluding weekends)
 * @param startDate - Start date string (YYYY-MM-DD format)
 * @param endDate - End date string (YYYY-MM-DD format)
 * @returns Number of working days (Monday-Friday only)
 */
export const calculateWorkingDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // If end date is before start date, return 0
  if (end < start) return 0;

  let workingDays = 0;
  const current = new Date(start);

  // Iterate through each day from start to end (inclusive)
  while (current <= end) {
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = current.getDay();

    // Count only weekdays (Monday = 1 to Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays++;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

/**
 * Calculate total calendar days between two dates (for reference)
 * @param startDate - Start date string (YYYY-MM-DD format)
 * @param endDate - End date string (YYYY-MM-DD format)
 * @returns Number of total days including weekends
 */
export const calculateTotalDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
};
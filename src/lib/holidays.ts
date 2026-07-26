// College Holidays Configuration List
// Add any specific college holiday dates in 'YYYY-MM-DD' format here.
export const COLLEGE_HOLIDAYS = [
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  // Add other holidays here
];

/**
 * Returns true if the given YYYY-MM-DD date string is in the holiday list.
 */
export function isHoliday(dateStr: string): boolean {
  return COLLEGE_HOLIDAYS.includes(dateStr);
}

/**
 * Returns true if the given YYYY-MM-DD string is a Sunday (day index 0)
 */
export function isSundayDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0; // 0 = Sunday
}

/**
 * Returns true if the given YYYY-MM-DD string is a Saturday (day index 6)
 */
export function isSaturdayDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.getDay() === 6; // 6 = Saturday
}

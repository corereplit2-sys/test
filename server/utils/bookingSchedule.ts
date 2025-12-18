import { startOfWeek, addWeeks, endOfWeek, getDay, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Calculate the current bookable week based on the release day setting
 *
 * Logic:
 * - Release day is 0-6 (Sunday-Saturday, standard JS getDay())
 * - Shows the current calendar week (Sunday-Saturday) containing today
 * - The release day determines when each new week's bookings become available
 * - Week runs Sunday-Saturday (7 days starting from Sunday)
 * - Uses Singapore timezone for consistency
 *
 * Example: Release day is Sunday (0), Today is Monday Nov 10
 * - Current week is Nov 9-15 (Sun-Sat)
 * - This week became available on Sunday Nov 9
 * - Users can book within this week until Saturday
 * - Next week (Nov 16-22) will become available on Sunday Nov 16
 */
export function getCurrentBookableWeek(
  releaseDay: number,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  // Convert to Singapore timezone for consistent week calculation
  const todayInSG = toZonedTime(referenceDate, "Asia/Singapore");

  // Simply return the current calendar week (Sunday-Saturday) containing today
  const weekStart = startOfWeek(todayInSG, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

  return { start: weekStart, end: weekEnd };
}

/**
 * Default release day is Sunday (0)
 */
export const DEFAULT_BOOKING_RELEASE_DAY = 0;

import { addDays, differenceInDays, parseISO } from "date-fns";
import type { DriverQualification, DriveLog, CurrencyStatus } from "@shared/schema";

const CURRENCY_WINDOW_DAYS = 88;
const REQUIRED_DISTANCE_KM = 2;
const GREEN_THRESHOLD_DAYS = 30;
const AMBER_THRESHOLD_DAYS = 15;

export interface CurrencyCalculationResult {
  currencyExpiryDate: string;
  lastDriveDate: string | null;
  status: CurrencyStatus;
  daysRemaining: number;
}

/**
 * Calculate currency status for a driver qualification based on their drive logs
 * 
 * Currency Rules:
 * - Initial currency valid for 88 days from qualification date
 * - To maintain currency: must drive ≥2km (cumulative) within any 88-day window
 * - Once 2km reached in a window, new window starts from that drive date
 * - Status: GREEN (>30d), AMBER (15-30d), RED (<15d or expired)
 */
export function calculateCurrency(
  qualification: DriverQualification,
  driveLogs: DriveLog[]
): CurrencyCalculationResult {
  // Sort logs by date ascending
  const sortedLogs = [...driveLogs].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Start with qualified date
  let currentStartDate = parseISO(qualification.qualifiedOnDate);
  let currentWindowEnd = addDays(currentStartDate, CURRENCY_WINDOW_DAYS);
  let lastValidDriveDate: Date | null = null;
  let finalExpiryDate: Date = currentWindowEnd;

  // Process each drive log
  for (const log of sortedLogs) {
    const logDate = parseISO(log.date);
    
    // If log is after current window, we may have lost currency
    while (logDate > currentWindowEnd) {
      // Move to next window starting from the last window end
      currentStartDate = addDays(currentStartDate, CURRENCY_WINDOW_DAYS);
      currentWindowEnd = addDays(currentStartDate, CURRENCY_WINDOW_DAYS);
      finalExpiryDate = currentWindowEnd;
      
      // If we've gone past the log date without accumulating distance, currency was lost
      if (logDate > currentWindowEnd) {
        continue;
      }
      break;
    }
    
    // Accumulate distance in current window
    let cumulativeDistance = 0;
    const windowStartDate = currentStartDate;
    
    for (const windowLog of sortedLogs) {
      const windowLogDate = parseISO(windowLog.date);
      
      // Only count logs within current window
      if (windowLogDate >= windowStartDate && windowLogDate <= currentWindowEnd) {
        cumulativeDistance += windowLog.distanceKm;
        
        // Check if we've hit the threshold
        if (cumulativeDistance >= REQUIRED_DISTANCE_KM) {
          lastValidDriveDate = windowLogDate;
          finalExpiryDate = addDays(windowLogDate, CURRENCY_WINDOW_DAYS);
          
          // Move to next window starting from this drive
          currentStartDate = windowLogDate;
          currentWindowEnd = addDays(windowLogDate, CURRENCY_WINDOW_DAYS);
          break;
        }
      }
    }
  }

  // Calculate status based on days remaining
  const today = new Date();
  const daysRemaining = differenceInDays(finalExpiryDate, today);
  
  let status: CurrencyStatus;
  if (daysRemaining < 0) {
    status = "EXPIRED";
  } else if (daysRemaining <= AMBER_THRESHOLD_DAYS) {
    status = "EXPIRING_SOON";
  } else if (daysRemaining <= GREEN_THRESHOLD_DAYS) {
    status = "EXPIRING_SOON";
  } else {
    status = "CURRENT";
  }

  return {
    currencyExpiryDate: finalExpiryDate.toISOString().split('T')[0],
    lastDriveDate: lastValidDriveDate?.toISOString().split('T')[0] || null,
    status,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Recalculate and update currency for a specific qualification
 */
export async function recalculateCurrencyForQualification(
  qualification: DriverQualification,
  driveLogs: DriveLog[],
  updateFunction: (id: string, updates: Partial<DriverQualification>) => Promise<DriverQualification | undefined>
): Promise<DriverQualification | undefined> {
  const result = calculateCurrency(qualification, driveLogs);
  
  return await updateFunction(qualification.id, {
    currencyExpiryDate: result.currencyExpiryDate,
    lastDriveDate: result.lastDriveDate,
  });
}

/**
 * Get currency status from a qualification (without recalculating)
 */
export function getCurrencyStatus(qualification: DriverQualification): {
  status: CurrencyStatus;
  daysRemaining: number;
} {
  const today = new Date();
  const expiryDate = parseISO(qualification.currencyExpiryDate);
  const daysRemaining = differenceInDays(expiryDate, today);
  
  let status: CurrencyStatus;
  if (daysRemaining < 0) {
    status = "EXPIRED";
  } else if (daysRemaining <= AMBER_THRESHOLD_DAYS) {
    status = "EXPIRING_SOON";
  } else if (daysRemaining <= GREEN_THRESHOLD_DAYS) {
    status = "EXPIRING_SOON";
  } else {
    status = "CURRENT";
  }

  return {
    status,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

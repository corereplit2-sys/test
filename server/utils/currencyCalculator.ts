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
 */
export function calculateCurrency(
  qualification: DriverQualification,
  driveLogs: DriveLog[]
): CurrencyCalculationResult {
  // Sort logs by date ascending
  const sortedLogs = [...driveLogs].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Initial currency: 88 days from qualification date
  const qualifiedDate = parseISO(qualification.qualifiedOnDate);
  let finalExpiryDate = addDays(qualifiedDate, CURRENCY_WINDOW_DAYS);
  let lastValidDriveDate: Date | null = null;

  // Sliding 88‑day window over drive logs
  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const logDate = parseISO(log.date);

    // Define this window as the 88 days counting back from this log (inclusive)
    const windowStart = addDays(logDate, -CURRENCY_WINDOW_DAYS);

    let cumulativeDistance = 0;
    for (let j = 0; j <= i; j++) {
      const windowLog = sortedLogs[j];
      const windowLogDate = parseISO(windowLog.date);

      if (windowLogDate >= windowStart && windowLogDate <= logDate) {
        cumulativeDistance += windowLog.distanceKm;
      }
    }

    // If the 2km requirement is met within this 88‑day window, currency renews
    if (cumulativeDistance >= REQUIRED_DISTANCE_KM) {
      lastValidDriveDate = logDate;
      finalExpiryDate = addDays(logDate, CURRENCY_WINDOW_DAYS);
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
    currencyExpiryDate: finalExpiryDate.toISOString().split("T")[0],
    lastDriveDate: lastValidDriveDate?.toISOString().split("T")[0] || null,
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

/**
 * IPPT Constants
 * Centralized configuration and constants for IPPT tracking
 */

// Azure Document Intelligence Configuration
export const AZURE_CONFIG = {
  ENDPOINT: "https://ipptocr.cognitiveservices.azure.com/",
  API_KEY: import.meta.env.VITE_AZURE_API_KEY,
} as const;

// IPPT Score Thresholds
export const IPPT_THRESHOLDS = {
  GOLD: 90,
  SILVER: 75,
  PASS: 61,
} as const;

// IPPT Result Types
export const IPPT_RESULTS = {
  GOLD: "Gold",
  SILVER: "Silver",
  PASS: "Pass",
  FAIL: "Fail",
} as const;

// Maximum values for IPPT stations
export const IPPT_MAX_VALUES = {
  SIT_UPS: 100,
  PUSH_UPS: 100,
  RUN_TIME_SECONDS: 1800, // 30 minutes
} as const;

// IPPT Station Names
export const IPPT_STATIONS = {
  SIT_UPS: "Sit-Ups",
  PUSH_UPS: "Push-Ups",
  RUN: "2.4km Run",
} as const;

// Age Groups for IPPT Scoring
export const IPPT_AGE_GROUPS = [
  "18-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60+",
] as const;

// Helper to get result badge color
export const getResultColor = (result: string): string => {
  switch (result) {
    case IPPT_RESULTS.GOLD:
      return "bg-yellow-500";
    case IPPT_RESULTS.SILVER:
      return "bg-gray-400";
    case IPPT_RESULTS.PASS:
      return "bg-green-500";
    case IPPT_RESULTS.FAIL:
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

// Helper to get result text color
export const getResultTextColor = (result: string): string => {
  switch (result) {
    case IPPT_RESULTS.GOLD:
      return "text-yellow-600";
    case IPPT_RESULTS.SILVER:
      return "text-gray-600";
    case IPPT_RESULTS.PASS:
      return "text-green-600";
    case IPPT_RESULTS.FAIL:
      return "text-red-600";
    default:
      return "text-gray-600";
  }
};

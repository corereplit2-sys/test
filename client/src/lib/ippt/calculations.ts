/**
 * IPPT Calculation Utilities
 * Extracted from IpptTracker.tsx for better organization and reusability
 */

/**
 * Calculate age from date of birth
 * @param dob - Date of birth
 * @returns Age as a string
 */
export const getAge = (dob: Date): string => {
  const age = Math.floor(
    (new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return age.toString();
};

/**
 * Convert run time string to seconds
 * @param runTime - Run time as string (MM:SS format), number, or undefined
 * @returns Run time in seconds
 */
export const parseRunTimeToSeconds = (runTime: string | number | undefined | null): number => {
  if (!runTime) return 0;
  if (typeof runTime === "number") return runTime;
  if (typeof runTime === "string" && runTime.includes(":")) {
    const [minutes, seconds] = runTime.split(":").map(Number);
    return minutes * 60 + seconds;
  }
  return 0;
};

/**
 * Convert seconds to MM:SS format
 * @param seconds - Time in seconds
 * @returns Formatted time string (MM:SS)
 */
export const formatRunTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Calculate IPPT score using database scoring matrix
 * @param situps - Number of sit-ups
 * @param pushups - Number of push-ups
 * @param runTime - Run time in seconds
 * @param dob - Date of birth
 * @returns Object containing scores and result
 */
export const calculateIpptScore = async (
  situps: number,
  pushups: number,
  runTime: number,
  dob: Date
): Promise<{
  totalScore: number;
  result: string;
  situpScore: number;
  pushupScore: number;
  runScore: number;
}> => {
  try {
    const age = getAge(dob);
    console.log("Fetching scoring data for age:", age);

    const response = await fetch(`/api/ippt/scoring/${age}`, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Failed to get scoring data. Status:", response.status);
      throw new Error(`Failed to get scoring data: ${response.status}`);
    }

    const scoringData = await response.json();
    console.log("Received scoring data:", scoringData);

    // Validate scoring data structure
    if (
      !scoringData ||
      !scoringData.situpMatrix ||
      !scoringData.pushupMatrix ||
      !scoringData.runMatrix
    ) {
      console.error("Invalid scoring data structure:", scoringData);
      throw new Error("Invalid scoring data received from server");
    }

    // Find scores for each station
    const situpScore = scoringData.situpMatrix[situps] || 0;
    const pushupScore = scoringData.pushupMatrix[pushups] || 0;
    const runScore = scoringData.runMatrix[runTime] || 0;

    console.log("Individual scores:", { situpScore, pushupScore, runScore });

    const totalScore = situpScore + pushupScore + runScore;

    // Determine result
    let result = "Fail";
    if (totalScore >= 90) result = "Gold";
    else if (totalScore >= 75) result = "Silver";
    else if (totalScore >= 61) result = "Pass";

    console.log("Final calculation:", { totalScore, result });

    return {
      totalScore,
      result,
      situpScore,
      pushupScore,
      runScore,
    };
  } catch (error) {
    console.error("Error calculating IPPT score:", error);
    throw error;
  }
};

/**
 * Validate IPPT attempt values
 * @param situps - Number of sit-ups
 * @param pushups - Number of push-ups
 * @param runTime - Run time in seconds
 * @returns Object with isValid flag and error message if invalid
 */
export const validateIpptAttempt = (
  situps: number,
  pushups: number,
  runTime: number
): { isValid: boolean; error?: string } => {
  if (situps < 0 || situps > 100) {
    return { isValid: false, error: "Sit-ups must be between 0 and 100" };
  }
  if (pushups < 0 || pushups > 100) {
    return { isValid: false, error: "Push-ups must be between 0 and 100" };
  }
  if (runTime < 0 || runTime > 1800) {
    // 30 minutes max
    return { isValid: false, error: "Run time must be between 0 and 30 minutes" };
  }
  return { isValid: true };
};

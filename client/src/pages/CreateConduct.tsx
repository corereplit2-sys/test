import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users, Scan, Plus, Edit, Save, X, Camera, Wifi, WifiOff, Smartphone, Monitor } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeUser } from "@shared/schema";
import { useConductSync, type ConductParticipant as SyncParticipant } from "@/hooks/use-conduct-sync";

// Point type for document detection
interface Point {
  x: number;
  y: number;
}

// Load OpenCV.js
const loadOpenCV = async () => {
  return new Promise((resolve, reject) => {
    // Check if OpenCV is already loaded
    if ((window as any).cv && (window as any).cv.Mat) {
      resolve((window as any).cv);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="opencv.js"]')) {
      return new Promise((resolve) => {
        const checkCV = () => {
          if ((window as any).cv && (window as any).cv.Mat) {
            resolve((window as any).cv);
          } else {
            setTimeout(checkCV, 100);
          }
        };
        checkCV();
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://docs.opencv.org/4.5.0/opencv.js";
      script.async = true;
      script.onload = () => {
        // Wait for OpenCV to be ready
        const checkCV = () => {
          if ((window as any).cv && (window as any).cv.Mat) {
            resolve((window as any).cv);
          } else {
            setTimeout(checkCV, 100);
          }
        };
        checkCV();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  });
};

// Utility functions from the Python code
const biggestContour = (cv: any, contours: any) => {
  let biggest = new cv.Mat();
  let maxArea = 0;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area > 5000) {
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (area > maxArea && approx.rows === 4) {
        biggest.delete();
        biggest = approx;
        maxArea = area;
      } else {
        approx.delete();
      }
    }
    contour.delete();
  }

  return { biggest, maxArea };
};

const reorder = (cv: any, points: any) => {
  const reshaped = points.reshape(4, 2);
  const newPoints = new cv.Mat(4, 1, cv.CV_32SC2);

  const sum = [];
  for (let i = 0; i < reshaped.rows; i++) {
    sum.push(reshaped.data32S[i * 2] + reshaped.data32S[i * 2 + 1]);
  }

  // Top-left (min sum)
  const minSumIdx = sum.indexOf(Math.min(...sum));
  // Bottom-right (max sum)
  const maxSumIdx = sum.indexOf(Math.max(...sum));

  const diff = [];
  for (let i = 0; i < reshaped.rows; i++) {
    diff.push(reshaped.data32S[i * 2] - reshaped.data32S[i * 2 + 1]);
  }

  // Top-right (min diff)
  const minDiffIdx = diff.indexOf(Math.min(...diff));
  // Bottom-left (max diff)
  const maxDiffIdx = diff.indexOf(Math.max(...diff));

  // Set reordered points
  newPoints.data32S[0] = reshaped.data32S[minSumIdx * 2];
  newPoints.data32S[1] = reshaped.data32S[minSumIdx * 2 + 1];
  newPoints.data32S[2] = reshaped.data32S[minDiffIdx * 2];
  newPoints.data32S[3] = reshaped.data32S[minDiffIdx * 2 + 1];
  newPoints.data32S[4] = reshaped.data32S[maxDiffIdx * 2];
  newPoints.data32S[5] = reshaped.data32S[maxDiffIdx * 2 + 1];
  newPoints.data32S[6] = reshaped.data32S[maxSumIdx * 2];
  newPoints.data32S[7] = reshaped.data32S[maxSumIdx * 2 + 1];

  return newPoints;
};

const drawRectangle = (cv: any, img: any, biggest: any, thickness: number) => {
  // Draw rectangle around detected document
  cv.line(
    img,
    new cv.Point(biggest.data32S[0], biggest.data32S[1]),
    new cv.Point(biggest.data32S[2], biggest.data32S[3]),
    new cv.Scalar(0, 255, 0),
    thickness
  );
  cv.line(
    img,
    new cv.Point(biggest.data32S[0], biggest.data32S[1]),
    new cv.Point(biggest.data32S[4], biggest.data32S[5]),
    new cv.Scalar(0, 255, 0),
    thickness
  );
  cv.line(
    img,
    new cv.Point(biggest.data32S[6], biggest.data32S[7]),
    new cv.Point(biggest.data32S[4], biggest.data32S[5]),
    new cv.Scalar(0, 255, 0),
    thickness
  );
  cv.line(
    img,
    new cv.Point(biggest.data32S[6], biggest.data32S[7]),
    new cv.Point(biggest.data32S[2], biggest.data32S[3]),
    new cv.Scalar(0, 255, 0),
    thickness
  );

  return img;
};

// Highlight paper function using the proven Python approach
const highlightPaper = (
  cv: any,
  src: any,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  try {
    const imgGray = new cv.Mat();
    const imgBlur = new cv.Mat();
    const imgThreshold = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const imgDial = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, imgGray, cv.COLOR_RGBA2GRAY);

    // Gaussian blur
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(5, 5), 1);

    // Canny edge detection
    cv.Canny(imgBlur, imgThreshold, 200, 200);

    // Dilate and erode
    cv.dilate(imgThreshold, imgDial, kernel, new cv.Point(-1, -1), 2);
    cv.erode(imgDial, imgThreshold, kernel, new cv.Point(-1, -1), 1);

    // Find contours
    cv.findContours(imgThreshold, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find biggest contour
    const { biggest, maxArea } = biggestContour(cv, contours);

    // Clear canvas and draw results
    ctx.clearRect(0, 0, width, height);

    if (biggest.rows > 0 && maxArea > 5000) {
      // Reorder points
      const reordered = reorder(cv, biggest);

      // Draw rectangle
      const imgBigContour = src.clone();
      drawRectangle(cv, imgBigContour, reordered, 20);

      // Convert back to canvas
      const imageData = new ImageData(
        new Uint8ClampedArray(imgBigContour.data),
        imgBigContour.cols,
        imgBigContour.rows
      );
      ctx.putImageData(imageData, 0, 0);

      // Cleanup
      imgGray.delete();
      imgBlur.delete();
      imgThreshold.delete();
      kernel.delete();
      imgDial.delete();
      contours.delete();
      hierarchy.delete();
      biggest.delete();
      reordered.delete();
      imgBigContour.delete();

      return true;
    }

    // Cleanup
    imgGray.delete();
    imgBlur.delete();
    imgThreshold.delete();
    kernel.delete();
    imgDial.delete();
    contours.delete();
    hierarchy.delete();
    biggest.delete();

    return false;
  } catch (error) {
    console.error("Error in highlightPaper:", error);
    return false;
  }
};

// Extract paper function using the proven Python approach
const extractPaper = (cv: any, src: any, targetWidth: number, targetHeight: number) => {
  try {
    const imgGray = new cv.Mat();
    const imgBlur = new cv.Mat();
    const imgThreshold = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    const imgDial = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    // Convert to grayscale
    cv.cvtColor(src, imgGray, cv.COLOR_RGBA2GRAY);

    // Gaussian blur
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(5, 5), 1);

    // Canny edge detection
    cv.Canny(imgBlur, imgThreshold, 200, 200);

    // Dilate and erode
    cv.dilate(imgThreshold, imgDial, kernel, new cv.Point(-1, -1), 2);
    cv.erode(imgDial, imgThreshold, kernel, new cv.Point(-1, -1), 1);

    // Find contours
    cv.findContours(imgThreshold, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find biggest contour
    const { biggest, maxArea } = biggestContour(cv, contours);

    if (biggest.rows > 0 && maxArea > 5000) {
      // Reorder points
      const reordered = reorder(cv, biggest);

      // Prepare points for warp
      const pts1 = new cv.Mat(4, 2, cv.CV_32FC2);
      const pts2 = new cv.Mat(4, 2, cv.CV_32FC2);

      // Set source points
      for (let i = 0; i < 4; i++) {
        pts1.data32F[i * 2] = reordered.data32S[i * 2];
        pts1.data32F[i * 2 + 1] = reordered.data32S[i * 2 + 1];
      }

      // Set destination points
      pts2.data32F[0] = 0;
      pts2.data32F[1] = 0;
      pts2.data32F[2] = targetWidth;
      pts2.data32F[3] = 0;
      pts2.data32F[4] = 0;
      pts2.data32F[5] = targetHeight;
      pts2.data32F[6] = targetWidth;
      pts2.data32F[7] = targetHeight;

      // Get perspective transform matrix
      const matrix = cv.getPerspectiveTransform(pts1, pts2);

      // Warp perspective
      const imgWarpColored = new cv.Mat();
      cv.warpPerspective(src, imgWarpColored, matrix, new cv.Size(targetWidth, targetHeight));

      // Remove 20 pixels from each side
      const cropped = new cv.Mat();
      const roi = new cv.Rect(20, 20, targetWidth - 40, targetHeight - 40);
      imgWarpColored.roi = roi;
      imgWarpColored.copyTo(cropped);
      imgWarpColored.roi = new cv.Rect(0, 0, imgWarpColored.cols, imgWarpColored.rows);

      // Resize back to target size
      const finalImg = new cv.Mat();
      cv.resize(cropped, finalImg, new cv.Size(targetWidth, targetHeight));

      // Cleanup
      imgGray.delete();
      imgBlur.delete();
      imgThreshold.delete();
      kernel.delete();
      imgDial.delete();
      contours.delete();
      hierarchy.delete();
      biggest.delete();
      reordered.delete();
      pts1.delete();
      pts2.delete();
      matrix.delete();
      imgWarpColored.delete();
      cropped.delete();

      return finalImg;
    }

    // Cleanup
    imgGray.delete();
    imgBlur.delete();
    imgThreshold.delete();
    kernel.delete();
    imgDial.delete();
    contours.delete();
    hierarchy.delete();
    biggest.delete();

    return null;
  } catch (error) {
    console.error("Error in extractPaper:", error);
    return null;
  }
};

// Azure Document Intelligence credentials
const AZURE_ENDPOINT = "https://ipptocr.cognitiveservices.azure.com/";
const AZURE_API_KEY = import.meta.env.VITE_AZURE_API_KEY;

// Helper function to convert run time string to seconds
const parseRunTimeToSeconds = (runTime: string | number | undefined | null): number => {
  if (runTime === null || runTime === undefined) return 0;
  if (typeof runTime === "number") {
    return Number.isFinite(runTime) ? runTime : 0;
  }
  if (typeof runTime === "string") {
    const trimmed = runTime.trim();
    if (!trimmed) return 0;
    if (trimmed.includes(":")) {
      const [minutes, seconds] = trimmed.split(":").map((val) => Number(val));
      if (Number.isNaN(minutes) || Number.isNaN(seconds)) return 0;
      return minutes * 60 + seconds;
    }
    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? 0 : numeric;
  }
  return 0;
};

const getSingaporeDateParts = (dateInput: Date | string) => {
  const date =
    typeof dateInput === "string"
      ? new Date(dateInput.includes("T") ? dateInput : `${dateInput}T00:00:00Z`)
      : dateInput;

  const formatter = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
};

const calculateFinancialYearAge = (dob: Date | string, conductDate: string) => {
  const dobParts = getSingaporeDateParts(dob);
  const conductParts = getSingaporeDateParts(conductDate);

  const financialYearStartYear = conductParts.month >= 4 ? conductParts.year : conductParts.year - 1;
  const financialYearStart = { year: financialYearStartYear, month: 4, day: 1 };

  let age = financialYearStart.year - dobParts.year;
  const birthOccursAfterFYStart =
    financialYearStart.month < dobParts.month ||
    (financialYearStart.month === dobParts.month && financialYearStart.day < dobParts.day);

  if (birthOccursAfterFYStart) {
    age -= 1;
  }

  return age;
};

// Helper function to calculate IPPT score using database scoring matrix
const calculateIpptScore = async (
  situps: number,
  pushups: number,
  runTime: number,
  conductDate?: string,
  dob?: Date
): Promise<{
  totalScore: number;
  result: string;
  situpScore: number;
  pushupScore: number;
  runScore: number;
  age?: number;
}> => {
  try {
    // Don't calculate scores if all values are 0 or invalid
    if (situps === 0 && pushups === 0 && runTime === 0) {
      return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0 };
    }

    // Don't calculate if no conduct date provided
    if (!conductDate) {
      console.log("No conduct date provided, returning default scores");
      return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0 };
    }

    if (!dob) {
      return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0 };
    }

    const age = calculateFinancialYearAge(dob, conductDate);

    // Don't calculate if age is invalid (less than 16 or greater than 60)
    if (age < 16 || age > 60) {
      console.log("Invalid age calculated:", age, "returning default scores");
      return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0, age };
    }

    console.log(
      "Calculating IPPT score with age:",
      age,
      "as of Singapore conduct date:",
      conductDate
    );

    const response = await fetch(`/api/ippt/scoring/${age}`, {
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Failed to get scoring data. Status:", response.status);
      return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0, age };
    }

    const scoringData = await response.json();

    // Find the appropriate scores for each exercise
    const situpScore = findExerciseScore(scoringData, "situp", situps);
    const pushupScore = findExerciseScore(scoringData, "pushup", pushups);
    const runScore = findExerciseScore(scoringData, "run", runTime);

    const totalScore = situpScore + pushupScore + runScore;
    let result = "Fail";
    if (totalScore >= 85) {
      result = "Gold";
    } else if (totalScore >= 75) {
      result = "Silver";
    } else if (totalScore >= 61) {
      result = "Pass";
    }

    return { totalScore, result, situpScore, pushupScore, runScore, age };
  } catch (error) {
    console.error("Error calculating IPPT score:", error);
    return { totalScore: 0, result: "Fail", situpScore: 0, pushupScore: 0, runScore: 0 };
  }
};

// Helper function to find exercise score from scoring data
const findExerciseScore = (scoringData: any, exercise: string, value: number): number => {
  // API returns situps_scoring, pushups_scoring, run_scoring (plural for situps/pushups)
  const scoringKey =
    exercise === "situp" ? "situps_scoring" : exercise === "pushup" ? "pushups_scoring" : "run_scoring";
  const scoringArray = scoringData[scoringKey];

  if (!scoringArray || !Array.isArray(scoringArray)) {
    return 0;
  }

  const comparator = exercise === "run" ? (val: number, threshold: number) => val <= threshold : (val: number, threshold: number) => val >= threshold;

  for (const [threshold, score] of scoringArray) {
    if (comparator(value, threshold)) {
      return score;
    }
  }

  return 0;
};

interface ConductParticipant {
  id?: string;
  scannedName?: string;
  name: string;
  rank: string;
  platoon: string;
  situpReps: number;
  pushupReps: number;
  runTime: number | string;
  situpScore?: number;
  pushupScore?: number;
  runScore?: number;
  totalScore?: number;
  result?: string;
  isEditing?: boolean;
  matchPercentage?: number;
  matchedUser?: SafeUser | null;
  age?: number | string;
}

// Find best name match using fuzzy matching
const findBestNameMatch = (
  scannedName: string,
  users: SafeUser[]
): { user: SafeUser | null; score: number; percentage: number } => {
  if (!users || users.length === 0) return { user: null, score: 0, percentage: 0 };

  const scannedLower = scannedName?.toLowerCase()?.trim() || "";

  // First try exact match
  const exactMatch = users.find(
    (user: SafeUser) => user?.fullName?.toLowerCase()?.trim() === scannedLower
  );

  if (exactMatch) {
    return { user: exactMatch, score: 100, percentage: 100 };
  }

  // Try word matching
  const scannedWords = scannedLower.split(" ").filter((word) => word.length > 0);
  let bestMatch = null;
  let bestScore = 0;

  users.forEach((user) => {
    if (!user?.fullName) return; // Skip users without fullName

    const userWords = user.fullName
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 0);
    let matchScore = 0;

    scannedWords.forEach((scannedWord: string) => {
      userWords.forEach((userWord: string) => {
        if (scannedWord === userWord) {
          matchScore += 2;
        } else if (scannedWord.includes(userWord) || userWord.includes(scannedWord)) {
          matchScore += 1;
        }
      });
    });

    if (matchScore > bestScore && matchScore >= 2) {
      bestScore = matchScore;
      bestMatch = user;
    }
  });

  // Calculate percentage based on possible max score
  const maxPossibleScore = scannedWords.length * 2; // Each word can match with max 2 points
  const percentage =
    maxPossibleScore > 0 ? Math.min(100, Math.round((bestScore / maxPossibleScore) * 100)) : 0;

  return { user: bestMatch, score: bestScore, percentage };
};

// Helper function to format run time
const formatRunTime = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    if (value.trim() === "") return "";
    if (value.includes(":")) return value;
    const numericSeconds = Number(value);
    if (Number.isNaN(numericSeconds)) return value;
    const minutes = Math.floor(numericSeconds / 60);
    const remainingSeconds = numericSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Fallback text-based parser for when table extraction fails
const parseTextBasedResults = async (content: string, conductDate?: string): Promise<any[]> => {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const entries: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for serial number pattern (numbers at start)
    const serialMatch = line.match(/^(\d+)\s+(.+)$/);
    if (serialMatch) {
      const serialNum = serialMatch[1];
      const rest = serialMatch[2];

      // Try to extract soldier data from this and following lines
      let name = "";
      let nric = "";
      let age = "";
      let training = "";
      let tag = "";
      let situpReps = 0;
      let pushupReps = 0;
      let runTimeStr = "";

      // Look ahead in next few lines for data
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const currentLine = lines[j];

        // Extract name (usually after serial)
        const nameMatch = currentLine.match(/^[A-Z][A-Z\s]+$/);
        if (nameMatch && !name) {
          name = currentLine.trim();
          continue;
        }

        // Extract NRIC (pattern like S1234567D)
        const nricMatch = currentLine.match(/^[ST]\d{7}[A-Z]$/i);
        if (nricMatch) {
          nric = currentLine.trim();
          continue;
        }

        // Extract age (pattern like "25Y" or just "25")
        const ageMatch = currentLine.match(/^(\d+)(Y?)$/);
        if (ageMatch) {
          age = ageMatch[1];
          continue;
        }

        // Extract training type
        if (currentLine.includes("RESERVIST") || currentLine.includes("NS")) {
          training = currentLine.trim();
          continue;
        }

        // Extract tag
        const tagMatch = currentLine.match(/^[A-Z]{2,}$/);
        if (tagMatch && !tag) {
          tag = currentLine.trim();
          continue;
        }

        // Extract sit-up data (only reps, ignore points)
        const situpMatch = currentLine.match(/(\d+)\s+(\d+)/);
        if (situpMatch && situpReps === 0) {
          situpReps = parseInt(situpMatch[1]);
          // Don't extract situpPts - we'll calculate it
          continue;
        }

        // Extract push-up data (only reps, ignore points)
        const pushupMatch = currentLine.match(/(\d+)\s+(\d+)/);
        if (pushupMatch && pushupReps === 0 && situpReps > 0) {
          pushupReps = parseInt(pushupMatch[1]);
          // Don't extract pushupPts - we'll calculate it
          continue;
        }

        // Extract run time (only time, ignore points)
        const runMatch = currentLine.match(/(\d{1,2}:\d{2})\s+(\d+)/);
        if (runMatch) {
          runTimeStr = runMatch[1];
          // Don't extract runPts - we'll calculate it
          break; // Found all data, stop looking ahead
        }
      }

      // Only add entry if we have at least a name
      if (name) {
        // Calculate scores using database instead of OCR points
        const runTimeSeconds = parseRunTimeToSeconds(runTimeStr) ?? 0;
        const runTimeDisplay = runTimeStr || formatRunTime(runTimeSeconds);
        const scoreResult = await calculateIpptScore(
          situpReps,
          pushupReps,
          runTimeSeconds,
          conductDate
        );

        entries.push({
          serial: serialNum,
          name,
          nric,
          age,
          training,
          tag,
          situpReps,
          situpScore: scoreResult.situpScore,
          pushupReps,
          pushupScore: scoreResult.pushupScore,
          runTime: runTimeDisplay,
          runScore: scoreResult.runScore,
          totalScore: scoreResult.totalScore,
          result: scoreResult.result,
        });
      }
    }
  }

  return entries;
};

// Parse IPPT results from Azure Document Intelligence table structure
const parseIpptResults = async (
  result: any,
  allUsers: SafeUser[],
  conductDate?: string
): Promise<
  Array<{
    name: string;
    rank?: string;
    platoon?: string;
    situpReps: number;
    situpScore: number;
    pushupReps: number;
    pushupScore: number;
    runTime: number;
    runScore: number;
    totalScore: number;
    result: string;
    age?: string;
    matchPercentage?: number;
    matchedUser?: SafeUser | null;
    isEditing: boolean;
  }>
> => {
  const entries: Array<{
    name: string;
    rank?: string;
    platoon?: string;
    situpReps: number;
    situpScore: number;
    pushupReps: number;
    pushupScore: number;
    runTime: number;
    runScore: number;
    totalScore: number;
    result: string;
    matchPercentage?: number;
    matchedUser?: SafeUser | null;
    isEditing: boolean;
  }> = [];

  if (!result.tables || result.tables.length === 0) {
    return entries;
  }

  const table = result.tables[0];

  // Find header row indices and column mappings
  const headerCells = table.cells.filter((cell: any) => cell.kind === "columnHeader");

  // Create column mapping
  const columnMap: { [key: string]: number } = {};

  // First pass: find only essential headers for OCR
  headerCells.forEach((cell: any) => {
    const content = cell.content.toLowerCase();
    if (content.includes("s/n")) columnMap["serial"] = cell.columnIndex;
    else if (content.includes("name")) columnMap["name"] = cell.columnIndex;
    else if (content.includes("sit-up")) columnMap["sitUpHeader"] = cell.columnIndex;
    else if (content.includes("push-up")) columnMap["pushUpHeader"] = cell.columnIndex;
    else if (content.includes("2.4km run")) columnMap["runTime"] = cell.columnIndex;
  });

  // Second pass: find "Reps" and "Pts" columns under Sit-Up and Push-Up headers
  headerCells.forEach((cell: any) => {
    const content = cell.content.toLowerCase();
    if (content.includes("reps")) {
      // Check if this "Reps" column is under Sit-Up or Push-Up header
      if (columnMap["sitUpHeader"] !== undefined && cell.columnIndex === columnMap["sitUpHeader"]) {
        columnMap["situpReps"] = cell.columnIndex;
      }
      if (
        columnMap["pushUpHeader"] !== undefined &&
        cell.columnIndex === columnMap["pushUpHeader"]
      ) {
        columnMap["pushupReps"] = cell.columnIndex;
      }
    }
    if (content.includes("pts")) {
      // Similar logic for "Pts" columns
      if (
        columnMap["sitUpHeader"] !== undefined &&
        cell.columnIndex === columnMap["sitUpHeader"] + 1
      ) {
        columnMap["situpPts"] = cell.columnIndex;
      }
      if (
        columnMap["pushUpHeader"] !== undefined &&
        cell.columnIndex === columnMap["pushUpHeader"] + 1
      ) {
        columnMap["pushupPts"] = cell.columnIndex;
      }
    }
    if (content.includes("2.4km run")) columnMap["runTime"] = cell.columnIndex;
    else if (content.includes("pts") && cell.rowIndex === 1 && cell.columnIndex === 12)
      columnMap["runPts"] = cell.columnIndex;
  });

  // Process data rows (skip header rows)
  const dataRows = table.cells.filter((cell: any) => cell.kind === "content" && cell.rowIndex >= 2);

  // Group cells by row
  const rowsByIndex: { [key: number]: any[] } = {};
  dataRows.forEach((cell: any) => {
    if (!rowsByIndex[cell.rowIndex]) {
      rowsByIndex[cell.rowIndex] = [];
    }
    rowsByIndex[cell.rowIndex][cell.columnIndex] = cell;
  });

  // Process each row
  for (const rowIndex of Object.keys(rowsByIndex)) {
    const rowCells = rowsByIndex[parseInt(rowIndex)];
    const serialCell = rowCells[columnMap["serial"]];

    // Process every row that has a name (no serial number restrictions)
    const nameCell = rowCells[columnMap["name"]];
    const hasName = nameCell && nameCell.content.trim().length > 0;

    if (hasName) {
      // Get cells for essential OCR data only
      const situpRepsCell = rowCells[columnMap["situpReps"]];
      const pushupRepsCell = rowCells[columnMap["pushupReps"]];
      const runTimeCell = rowCells[columnMap["runTime"]];

      // Extract only essential OCR data
      const name = nameCell?.content || "Unknown";
      let situpReps = parseInt(situpRepsCell?.content) || 0;
      let pushupReps = parseInt(pushupRepsCell?.content) || 0;
      const runTimeStr = runTimeCell?.content || "";

      // Fallback: use dynamically detected columns if primary mapping fails
      if (!pushupReps || pushupReps === 0) {
        if (columnMap["pushupReps"] !== undefined) {
          const fallbackCell = rowCells[columnMap["pushupReps"]];
          if (fallbackCell?.content) {
            const reps = parseInt(fallbackCell.content);
            if (reps > 0) {
              pushupReps = reps;
            }
          }
        }
      }

      // Fallback for sit-ups
      if (!situpReps || situpReps === 0) {
        if (columnMap["situpReps"] !== undefined) {
          const fallbackCell = rowCells[columnMap["situpReps"]];
          if (fallbackCell?.content) {
            const reps = parseInt(fallbackCell.content);
            if (reps > 0) {
              situpReps = reps;
            }
          }
        }
      }

      // Parse run time
      const runTimeSeconds = parseRunTimeToSeconds(runTimeStr) ?? 0;
      const runTimeDisplay = runTimeStr || formatRunTime(runTimeSeconds);

      // Find matching user to get their details
      const nameMatch = findBestNameMatch(name, allUsers);
      const matchedUser = nameMatch.user;

      // Get user details or use defaults
      const userDob = matchedUser?.dob || new Date();
      const userRank = matchedUser?.rank || "";
      const userPlatoon = matchedUser?.mspId || "";
      const finalName = matchedUser?.fullName || name;

      // Use database scoring with conduct date and user DOB
      const scoreResult = await calculateIpptScore(
        situpReps,
        pushupReps,
        runTimeSeconds,
        conductDate,
        new Date(userDob)
      );

      // Use calculated scores from database
      const finalSitupScore = scoreResult.situpScore;
      const finalPushupScore = scoreResult.pushupScore;
      const finalRunScore = scoreResult.runScore;
      const finalTotalScore = scoreResult.totalScore;
      const finalResult = scoreResult.result;
      entries.push({
        name: finalName,
        rank: userRank,
        platoon: userPlatoon,
        situpReps,
        situpScore: finalSitupScore,
        pushupReps,
        pushupScore: finalPushupScore,
        runTime: runTimeDisplay,
        runScore: finalRunScore,
        totalScore: finalTotalScore,
        result: finalResult,
        matchPercentage: nameMatch.percentage,
        matchedUser: matchedUser,
        isEditing: false,
      });
    }
  }

  return entries;
};

export default function CreateConduct() {
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: user } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
  });

  // Get all users for name matching
  const { data: allUsers } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user,
    retry: 2,
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  const [conductName, setConductName] = useState("");
  const [conductDate, setConductDate] = useState("");
  const [participants, setParticipants] = useState<ConductParticipant[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [userSuggestions, setUserSuggestions] = useState<{ [key: number]: SafeUser[] }>({});
  const [duplicateError, setDuplicateError] = useState<string>("");
  const [conflictDialog, setConflictDialog] = useState<{
    isOpen: boolean;
    conflicts: Array<{ name: string; existingIndex: number; newParticipant: ConductParticipant }>;
  }>({ isOpen: false, conflicts: [] });

  // Generate a unique conduct ID based on user + conduct name + date
  const conductId = user?.id && conductName && conductDate 
    ? `${user.id}-${conductName}-${conductDate}`.replace(/\s+/g, '-').toLowerCase()
    : undefined;

  // Sync hook callbacks - handle incoming updates from other devices
  const handleRemoteParticipantAdd = useCallback((participant: SyncParticipant) => {
    console.log("[Sync] Remote participant add:", participant);

    const normalized = (() => {
      if (typeof participant.name === "object" && participant.name) {
        return {
          ...participant,
          name: participant.name.fullName,
          matchedUser: participant.name,
        } as ConductParticipant;
      }
      return {
        ...participant,
        name: typeof participant.name === "string" ? participant.name : "",
      } as ConductParticipant;
    })();

    setParticipants((prev) => {
      const nameToCheck = typeof normalized.name === "string" ? normalized.name.trim().toLowerCase() : "";
      const hasName = nameToCheck.length > 0;
      const exists = hasName
        ? prev.some((p) => {
            const pName = typeof p.name === "string" ? p.name.trim().toLowerCase() : "";
            return pName === nameToCheck;
          })
        : false;
      if (exists) return prev;
      
      const newIndex = prev.length;
      const newList = [...prev, normalized];
      
      // Recalculate scores for the added participant
      if (conductDate && normalized.matchedUser?.dob) {
        const runTimeSeconds = parseRunTimeToSeconds(normalized.runTime);
        calculateIpptScore(
          normalized.situpReps || 0,
          normalized.pushupReps || 0,
          runTimeSeconds,
          conductDate,
          new Date(normalized.matchedUser.dob)
        ).then((scoreResult) => {
          setParticipants((current) =>
            current.map((p, i) =>
              i === newIndex
                ? {
                    ...p,
                    situpScore: scoreResult.situpScore,
                    pushupScore: scoreResult.pushupScore,
                    runScore: scoreResult.runScore,
                    totalScore: scoreResult.totalScore,
                    result: scoreResult.result,
                  }
                : p
            )
          );
        });
      }
      
      return newList;
    });
  }, [conductDate]);

  const handleRemoteParticipantUpdate = useCallback((index: number, updates: Partial<SyncParticipant>) => {
    console.log("[Sync] Remote participant update:", index, updates);

    const normalizedUpdates: Partial<ConductParticipant> = (() => {
      if (typeof updates.name === "object" && updates.name) {
        return {
          ...updates,
          name: updates.name.fullName,
          matchedUser: updates.name,
        } as Partial<ConductParticipant>;
      }
      return {
        ...updates,
        name: typeof updates.name === "string" ? updates.name : undefined,
      } as Partial<ConductParticipant>;
    })();

    setParticipants((prev) => {
      const updated = prev.map((p, i) => (i === index ? { ...p, ...normalizedUpdates } : p));
      
      // Recalculate scores for the updated participant
      const participant = updated[index];
      if (participant && conductDate) {
        const runTimeSeconds = parseRunTimeToSeconds(participant.runTime);
        calculateIpptScore(
          participant.situpReps || 0,
          participant.pushupReps || 0,
          runTimeSeconds,
          conductDate,
          participant.matchedUser?.dob ? new Date(participant.matchedUser.dob) : undefined
        ).then((scoreResult) => {
          setParticipants((current) =>
            current.map((p, i) =>
              i === index
                ? {
                    ...p,
                    situpScore: scoreResult.situpScore,
                    pushupScore: scoreResult.pushupScore,
                    runScore: scoreResult.runScore,
                    totalScore: scoreResult.totalScore,
                    result: scoreResult.result,
                  }
                : p
            )
          );
        });
      }
      
      return updated;
    });
  }, [conductDate]);

  const handleRemoteParticipantRemove = useCallback((index: number) => {
    console.log("[Sync] Remote participant remove:", index);
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoteParticipantsSync = useCallback(async (remoteParticipants: SyncParticipant[]) => {
    console.log("[Sync] Remote participants sync:", remoteParticipants.length, "participants");
    
    // Normalize and recalculate scores for all participants
    const normalizedParticipants: ConductParticipant[] = remoteParticipants.map((p) => {
      if (typeof p.name === "object" && p.name) {
        return { ...p, name: p.name.fullName, matchedUser: p.name } as ConductParticipant;
      }
      return { ...p, name: typeof p.name === "string" ? p.name : "" } as ConductParticipant;
    });
    
    setParticipants(normalizedParticipants);
    
    // Recalculate scores for all participants with valid data
    if (conductDate) {
      for (let i = 0; i < normalizedParticipants.length; i++) {
        const participant = normalizedParticipants[i];
        if (participant.matchedUser?.dob) {
          const runTimeSeconds = parseRunTimeToSeconds(participant.runTime);
          const scoreResult = await calculateIpptScore(
            participant.situpReps || 0,
            participant.pushupReps || 0,
            runTimeSeconds,
            conductDate,
            new Date(participant.matchedUser.dob)
          );
          setParticipants((current) =>
            current.map((p, idx) =>
              idx === i
                ? {
                    ...p,
                    situpScore: scoreResult.situpScore,
                    pushupScore: scoreResult.pushupScore,
                    runScore: scoreResult.runScore,
                    totalScore: scoreResult.totalScore,
                    result: scoreResult.result,
                  }
                : p
            )
          );
        }
      }
    }
  }, [conductDate]);

  // State for sync status warnings
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{ time: number; from: string } | null>(null);

  // Initialize conduct sync hook
  const {
    isConnected,
    isSyncing,
    isReconnecting,
    lastSyncTime,
    lastSyncFromDevice,
    presence,
    otherDevices,
    deviceType,
    broadcastParticipantAdd,
    broadcastParticipantUpdate,
    broadcastParticipantRemove,
    broadcastParticipantsSync,
    requestSync,
  } = useConductSync({
    userId: user?.id || "",
    conductId,
    onParticipantAdd: handleRemoteParticipantAdd,
    onParticipantUpdate: handleRemoteParticipantUpdate,
    onParticipantRemove: handleRemoteParticipantRemove,
    onParticipantsSync: (remoteParticipants, fromDevice) => {
      handleRemoteParticipantsSync(remoteParticipants);
      setLastSyncInfo({ time: Date.now(), from: fromDevice || "unknown" });
      setSyncWarning(null); // Clear warning after successful sync
    },
    onReconnect: () => {
      // Show warning that we may be out of sync after reconnect
      if (isSyncing) {
        setSyncWarning("Reconnected - data may be out of sync");
      }
    },
    onDeviceJoin: (joinedDeviceType) => {
      console.log(`[Sync] Device joined: ${joinedDeviceType}`);
      // Automatically send our data to the newly joined device
      if (participants.length > 0) {
        setTimeout(() => {
          broadcastParticipantsSync(participants as unknown as SyncParticipant[]);
        }, 500);
      }
    },
    onDeviceLeave: (leftDeviceType) => {
      console.log(`[Sync] Device left: ${leftDeviceType}`);
      setSyncWarning(`${leftDeviceType === "mobile" ? "Phone" : "Laptop"} disconnected`);
    },
    onSyncRequested: (fromDevice) => {
      console.log(`[Sync] Sync requested by: ${fromDevice}`);
      // Automatically respond with our current data
      if (participants.length > 0) {
        broadcastParticipantsSync(participants as unknown as SyncParticipant[]);
      }
    },
  });

  // Recalculate all scores when conduct date changes
  useEffect(() => {
    if (conductDate && participants.length > 0) {
      console.log("Conduct date changed, recalculating all scores...");

      const recalculateScores = async () => {
        for (let index = 0; index < participants.length; index++) {
          const participant = participants[index];
          const runTimeSeconds = parseRunTimeToSeconds(participant.runTime);
          if ((participant.situpReps || 0) > 0 || (participant.pushupReps || 0) > 0 || runTimeSeconds > 0) {
            const scoreResult = await calculateIpptScore(
              participant.situpReps || 0,
              participant.pushupReps || 0,
              runTimeSeconds,
              conductDate,
              participant.matchedUser?.dob ? new Date(participant.matchedUser.dob) : undefined
            );

            // Only update if scores actually changed
            const scoresChanged =
              participant.situpScore !== scoreResult.situpScore ||
              participant.pushupScore !== scoreResult.pushupScore ||
              participant.runScore !== scoreResult.runScore ||
              participant.totalScore !== scoreResult.totalScore ||
              participant.result !== scoreResult.result;

            if (scoresChanged) {
              setParticipants((current: ConductParticipant[]) =>
                current.map((p: ConductParticipant, i: number) => {
                  if (i === index) {
                    return {
                      ...p,
                      situpScore: scoreResult.situpScore,
                      pushupScore: scoreResult.pushupScore,
                      runScore: scoreResult.runScore,
                      totalScore: scoreResult.totalScore,
                      result: scoreResult.result,
                    };
                  }
                  return p;
                })
              );
            }
          }
        }
      };

      recalculateScores();
    }
  }, [conductDate]); // Only depend on conductDate, not participants

  // Function to check for conflicts between scanned and existing participants
  const checkConflicts = (
    scannedParticipants: ConductParticipant[],
    existingParticipants: ConductParticipant[]
  ): Array<{ name: string; existingIndex: number; newParticipant: ConductParticipant }> => {
    const conflicts: Array<{
      name: string;
      existingIndex: number;
      newParticipant: ConductParticipant;
    }> = [];

    scannedParticipants.forEach((newParticipant, newIndex) => {
      const normalizedName =
        typeof newParticipant.name === "string" ? newParticipant.name.toLowerCase().trim() : "";

      // Check if this participant already exists in the current table
      existingParticipants.forEach((existingParticipant, existingIndex) => {
        const existingNormalizedName =
          typeof existingParticipant.name === "string"
            ? existingParticipant.name.toLowerCase().trim()
            : "";

        if (normalizedName === existingNormalizedName && normalizedName !== "") {
          conflicts.push({
            name: newParticipant.name,
            existingIndex,
            newParticipant,
          });
        }
      });
    });

    return conflicts;
  };

  // Function to check for duplicate participants
  const checkDuplicates = (participantList: ConductParticipant[]): string | null => {
    const nameMap = new Map<string, number>();

    for (let i = 0; i < participantList.length; i++) {
      const participant = participantList[i];
      const normalizedName =
        typeof participant.name === "string" ? participant.name.toLowerCase().trim() : "";

      if (!normalizedName) continue; // Skip empty names

      if (nameMap.has(normalizedName)) {
        const originalIndex = nameMap.get(normalizedName)!;
        return `Duplicate participant found: "${participant.name}" (rows ${originalIndex + 1} and ${i + 1})`;
      }

      nameMap.set(normalizedName, i);
    }

    return null;
  };

  // Function to handle conflict resolution
  const handleConflictResolution = (
    action: "overwrite" | "skip",
    scannedParticipants: ConductParticipant[]
  ) => {
    const { conflicts } = conflictDialog;

    if (action === "overwrite") {
      // Overwrite existing participants with scanned data
      const updatedParticipants = [...participants];

      conflicts.forEach((conflict) => {
        updatedParticipants[conflict.existingIndex] = {
          ...conflict.newParticipant,
          isEditing: false,
        };
      });

      setParticipants(updatedParticipants);
    }

    // Add non-conflicting scanned participants
    const conflictingNames = new Set(conflicts.map((c) => c.name.toLowerCase().trim()));
    const nonConflictingParticipants = scannedParticipants.filter(
      (p) => !conflictingNames.has(p.name.toLowerCase().trim())
    );

    if (nonConflictingParticipants.length > 0) {
      setParticipants((prev) => [...prev, ...nonConflictingParticipants]);
    }

    // Close dialog and reset scanning state
    setConflictDialog({ isOpen: false, conflicts: [] });
    setIsScanning(false);
    setScanProgress(0);
  };

  // Validation function to check if conduct can be created
  const canCreateConduct = () => {
    // Basic requirements
    if (!conductName || !conductDate || participants.length === 0) {
      return false;
    }

    // Check for duplicate errors
    if (duplicateError) {
      return false;
    }

    // Check for incomplete participant data
    const hasIncompleteData = participants.some(
      (participant) =>
        !participant.name ||
        (typeof participant.name === "string" && participant.name.trim() === "") ||
        participant.situpReps === 0 ||
        participant.pushupReps === 0 ||
        !participant.runTime ||
        participant.runTime === 0
    );

    if (hasIncompleteData) {
      return false;
    }

    // Check for participants with invalid scores (all zeros indicates incomplete data)
    const hasInvalidScores = participants.some(
      (participant) =>
        participant.situpScore === 0 &&
        participant.pushupScore === 0 &&
        participant.runScore === 0 &&
        participant.totalScore === 0
    );

    if (hasInvalidScores) {
      return false;
    }

    return true;
  };

  // Store scanned participants globally for conflict resolution
  const [scannedParticipants, setScannedParticipants] = useState<ConductParticipant[]>([]);

  // Function to filter users based on input
  const filterUsers = (input: string | any, index: number) => {
    // Ensure input is a string
    const searchString = typeof input === "string" ? input : "";
    
    if (!searchString || !allUsers) {
      setUserSuggestions((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    const filtered = allUsers
      .filter((user: SafeUser) => user.fullName.toLowerCase().includes(searchString.toLowerCase()))
      .slice(0, 5); // Limit to 5 suggestions

    setUserSuggestions((prev) => ({ ...prev, [index]: filtered }));
  };

  // Function to handle user selection from suggestions
  const selectUser = (index: number, user: SafeUser) => {
    handleUpdateParticipant(index, "name", user);
    setUserSuggestions((prev) => ({ ...prev, [index]: [] }));
  };

  const handleUpdateParticipant = async (
    index: number,
    field: keyof ConductParticipant,
    value: any
  ) => {
    // For manual name edits, clear match data immediately
    if (field === "name" && typeof value === "string") {
      const updatedParticipants = participants.map((p: ConductParticipant, i: number) => {
        if (i === index) {
          const updated = {
            ...p,
            [field]: value,
            matchPercentage: undefined,
            matchedUser: undefined,
            rank: "",
            platoon: "",
          };
          return updated;
        }
        return p;
      });

      // Check for duplicates
      const duplicate = checkDuplicates(updatedParticipants);
      if (duplicate) {
        setDuplicateError(duplicate);
      } else {
        setDuplicateError("");
      }

      setParticipants(updatedParticipants);

      // Calculate scores separately
      const participant = participants[index];
      const runTimeSeconds = parseRunTimeToSeconds(participant.runTime);
      calculateIpptScore(
        participant.situpReps,
        participant.pushupReps,
        runTimeSeconds,
        conductDate,
        participant.matchedUser?.dob ? new Date(participant.matchedUser.dob) : undefined
      ).then((scoreResult) => {
        setParticipants((current: ConductParticipant[]) =>
          current.map((p: ConductParticipant, i: number) => {
            if (i === index) {
              return {
                ...p,
                situpScore: scoreResult.situpScore,
                pushupScore: scoreResult.pushupScore,
                runScore: scoreResult.runScore,
                totalScore: scoreResult.totalScore,
                result: scoreResult.result,
              };
            }
            return p;
          })
        );
      });
      return;
    }

    // Handle other updates (user selection, reps, run time)
    setParticipants((prev: ConductParticipant[]) =>
      prev.map((p: ConductParticipant, i: number) => {
        if (i === index) {
          const updated = { ...p, [field]: value };

          // If user is selected from dropdown, update all user info but don't show badge
          if (field === "name" && value && typeof value === "object") {
            const selectedUser = value as SafeUser;
            updated.name = selectedUser.fullName;
            updated.rank = selectedUser.rank || "";
            updated.platoon = selectedUser.mspId || "";
            updated.matchPercentage = undefined; // Don't show badge for manual selection
            updated.matchedUser = selectedUser;

            // Check for duplicates
            const tempParticipants = prev.map((p, i) => (i === index ? updated : p));
            const duplicate = checkDuplicates(tempParticipants);
            if (duplicate) {
              setDuplicateError(duplicate);
            } else {
              setDuplicateError("");
            }

            // Recalculate scores with conduct date and user DOB
            const runTimeSeconds = parseRunTimeToSeconds(updated.runTime);
            calculateIpptScore(
              updated.situpReps,
              updated.pushupReps,
              runTimeSeconds,
              conductDate,
              selectedUser?.dob ? new Date(selectedUser.dob) : undefined
            ).then((scoreResult) => {
              updated.situpScore = scoreResult.situpScore;
              updated.pushupScore = scoreResult.pushupScore;
              updated.runScore = scoreResult.runScore;
              updated.totalScore = scoreResult.totalScore;
              updated.result = scoreResult.result;

              setParticipants((current: ConductParticipant[]) =>
                current.map((participant: ConductParticipant, idx: number) =>
                  idx === index ? updated : participant
                )
              );
            });
          }
          // Recalculate scores if reps or run time changed
          else if (field === "situpReps" || field === "pushupReps" || field === "runTime") {
            const runTimeSeconds = parseRunTimeToSeconds(updated.runTime);
            calculateIpptScore(
              updated.situpReps,
              updated.pushupReps,
              runTimeSeconds,
              conductDate,
              p.matchedUser?.dob ? new Date(p.matchedUser.dob) : undefined
            ).then((scoreResult) => {
              updated.situpScore = scoreResult.situpScore;
              updated.pushupScore = scoreResult.pushupScore;
              updated.runScore = scoreResult.runScore;
              updated.totalScore = scoreResult.totalScore;
              updated.result = scoreResult.result;

              // Check for duplicates after score update
              const tempParticipants = prev.map((part, i) => (i === index ? updated : part));
              const duplicate = checkDuplicates(tempParticipants);
              if (duplicate) {
                setDuplicateError(duplicate);
              } else {
                setDuplicateError("");
              }

              // Update the participants state with new scores
              setParticipants((current: ConductParticipant[]) =>
                current.map((participant: ConductParticipant, idx: number) =>
                  idx === index ? updated : participant
                )
              );
            });
          }

          return updated;
        }
        return p;
      })
    );
    
    // Broadcast update to other devices (debounced for performance)
    if (isSyncing && (field === "situpReps" || field === "pushupReps" || field === "runTime" || field === "name")) {
      // For score-related fields, broadcast after a short delay to batch updates
      setTimeout(() => {
        const updatedParticipant = participants[index];
        if (updatedParticipant) {
          broadcastParticipantUpdate(index, { [field]: value } as Partial<SyncParticipant>);
        }
      }, 300);
    }
  };

  // Find best name match using fuzzy matching
  const findBestNameMatch = (
    scannedName: string,
    users: SafeUser[]
  ): { user: SafeUser | null; score: number; percentage: number } => {
    if (!users || users.length === 0) return { user: null, score: 0, percentage: 0 };

    const scannedLower = scannedName?.toLowerCase()?.trim() || "";

    // First try exact match
    const exactMatch = users.find(
      (user: SafeUser) => user?.fullName?.toLowerCase() === scannedLower
    );
    if (exactMatch) return { user: exactMatch, score: 100, percentage: 100 };

    // Try partial match (contains)
    const partialMatch = users.find(
      (user: SafeUser) =>
        user?.fullName?.toLowerCase()?.includes(scannedLower) ||
        scannedLower?.includes(user?.fullName?.toLowerCase() || "")
    );
    if (partialMatch) return { user: partialMatch, score: 80, percentage: 80 };

    // Try word matching
    const scannedWords = scannedLower.split(" ").filter((word) => word.length > 0);
    let bestMatch = null;
    let bestScore = 0;

    users.forEach((user) => {
      if (!user?.fullName) return; // Skip users without fullName

      const userWords = user.fullName
        .toLowerCase()
        .split(" ")
        .filter((word) => word.length > 0);
      let matchScore = 0;

      scannedWords.forEach((scannedWord: string) => {
        userWords.forEach((userWord: string) => {
          if (scannedWord === userWord) {
            matchScore += 2;
          } else if (scannedWord.includes(userWord) || userWord.includes(scannedWord)) {
            matchScore += 1;
          }
        });
      });

      if (matchScore > bestScore && matchScore >= 2) {
        bestScore = matchScore;
        bestMatch = user;
      }
    });

    // Calculate percentage based on possible max score
    const maxPossibleScore = scannedWords.length * 2; // Each word can match with max 2 points
    const percentage =
      maxPossibleScore > 0 ? Math.min(100, Math.round((bestScore / maxPossibleScore) * 100)) : 0;

    return { user: bestMatch, score: bestScore, percentage };
  };

  // Get user-specific localStorage key
  const getDraftKey = () => {
    return user ? `ippt-conduct-draft-${user.id}` : "ippt-conduct-draft-guest";
  };

  // Auto-load draft on component mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(getDraftKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        const savedDate = new Date(draftData.savedAt);
        const timeDiff = Date.now() - savedDate.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Only auto-load if draft is less than 24 hours old
        if (hoursDiff < 24) {
          setConductName(draftData.conductName || "");
          setConductDate(draftData.conductDate || "");
          setParticipants(draftData.participants || []);
        }
      } catch (error) {
        console.error("Error auto-loading draft:", error);
      }
    }
  }, [user]); // Add user dependency

  // Simple OCR processing with jscanify
  const handleScanScoresheet = async () => {
    console.log("Starting jscanify scanner...");

    try {
      // Import jscanify
      const jscanify = await import("jscanify");

      // Create scanner dialog
      const dialog = document.createElement("div");
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      dialog.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 24px; max-width: 800px; width: 90%; max-height: 90vh;">
          <h2 style="margin: 0 0 16px 0; color: #333;">Document Scanner</h2>
          <div style="position: relative; background: black; border-radius: 8px; overflow: hidden; margin-bottom: 16px; min-height: 400px;">
            <video id="scanner-video" style="width: 100%; height: auto; display: block;"></video>
            <canvas id="scanner-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></canvas>
            <div id="status" style="position: absolute; top: 12px; left: 12px; background: #10b981; color: white; padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;">Initializing...</div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancel-btn" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
            <button id="capture-btn" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Capture</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const video = dialog.querySelector("#scanner-video") as HTMLVideoElement;
      const canvas = dialog.querySelector("#scanner-canvas") as HTMLCanvasElement;
      const status = dialog.querySelector("#status") as HTMLDivElement;
      const cancelBtn = dialog.querySelector("#cancel-btn") as HTMLButtonElement;
      const captureBtn = dialog.querySelector("#capture-btn") as HTMLButtonElement;

      // Initialize jscanify
      const scanner = new jscanify.default();

      // Start camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = stream;
      await video.play();

      status.textContent = "Ready to scan";
      status.style.background = "#10b981";

      // Start scanning loop
      const scanLoop = () => {
        // Simple document detection would go here
        // For now, just show the camera feed
        if (dialog.parentNode) {
          requestAnimationFrame(scanLoop);
        }
      };

      scanLoop();

      // Capture button
      captureBtn.onclick = () => {
        // Capture current frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);

          // Convert to blob
          canvas.toBlob(
            async (blob) => {
              if (blob) {
                const file = new File([blob], "scan.jpg", { type: "image/jpeg" });

                // Stop camera
                const stream = video.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());

                // Remove dialog
                if (document.body.contains(dialog)) {
                  document.body.removeChild(dialog);
                }

                // Send to Azure OCR
                const event = { target: { files: [file] } } as any;
                await handleFileUpload(event);
              }
            },
            "image/jpeg",
            0.9
          );
        }
      };

      // Cancel button
      cancelBtn.onclick = () => {
        // Stop camera
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());

        if (document.body.contains(dialog)) {
          document.body.removeChild(dialog);
        }
      };

      // Cleanup on dialog close
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
          // Stop camera
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());

          if (document.body.contains(dialog)) {
            document.body.removeChild(dialog);
          }
        }
      });
    } catch (error) {
      console.error("Scanner error:", error);
      // Fallback to file upload
      fileInputRef.current?.click();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanProgress(0);

    try {
      setScanProgress(25);

      // Create image element
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);

      image.onload = async function () {
        setScanProgress(50);

        // Simple image processing - try jscanify first, fallback to original
        let processedCanvas: HTMLCanvasElement | null = null;

        // Try to use jscanify if available (need both jscanify and OpenCV)
        if ((window as any).jscanify && (window as any).cv) {
          try {
            const scanner = new (window as any).jscanify();

            if (scanner.extractPaper) {
              const paperWidth = 800;
              const paperHeight = 600;
              processedCanvas = scanner.extractPaper(image, paperWidth, paperHeight);
            } else {
              console.warn("jscanify extractPaper method not found");
            }
          } catch (e) {
            console.warn("jscanify processing failed, using original image:", e);
          }
        } else {
          console.warn("jscanify or OpenCV not loaded, using original image");
        }

        // Fallback to original image if jscanify failed
        if (!processedCanvas) {
          processedCanvas = document.createElement("canvas");
          const ctx = processedCanvas.getContext("2d");
          if (!ctx) {
            throw new Error("Could not get canvas context");
          }
          processedCanvas.width = image.width;
          processedCanvas.height = image.height;
          ctx.drawImage(image, 0, 0);
        }

        setScanProgress(75);

        // Show popup with both original and processed images
        const imagePopup = document.createElement("div");
        imagePopup.innerHTML = `
          <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                      bg-card border border-border rounded-lg shadow-lg 
                      max-w-[95vw] max-h-[95vh] overflow-auto z-[9999] p-5">
            <h3 class="text-lg font-semibold text-foreground mb-5 text-center">Image Processing Results</h3>
            
            ${
              processedCanvas
                ? `
              <div class="mb-5">
                <h4 class="text-sm font-medium text-muted-foreground mb-2.5">Processed Image (jscanify)</h4>
                <div class="text-center">
                  <img src="${processedCanvas.toDataURL("image/jpeg", 0.9)}" 
                       class="max-w-[45%] max-h-[40vh] border rounded-md mx-0.5" />
                </div>
              </div>
            `
                : ""
            }
            
            <div class="mb-5">
              <h4 class="text-sm font-medium text-muted-foreground mb-2.5">Original Image</h4>
              <div class="text-center">
                <img src="${imageUrl}" 
                     class="max-w-[${processedCanvas ? "45%" : "80%"}] max-h-[40vh] border rounded-md mx-0.5" />
              </div>
            </div>
            
            <div class="flex gap-2.5 justify-center flex-wrap">
              ${
                processedCanvas
                  ? `
                <button id="use-processed" 
                        class="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                  Use Processed Image
                </button>
              `
                  : ""
              }
              <button id="use-original" 
                      class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                Use Original Image
              </button>
              <button id="close-popup" 
                      class="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                Close
              </button>
            </div>
            
            ${
              !processedCanvas
                ? `
              <div class="mt-4 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-md text-center">
                <small class="text-red-700 dark:text-red-400">jscanify not available - only original image shown</small>
              </div>
            `
                : ""
            }
          </div>
        `;
        document.body.appendChild(imagePopup);

        // Handle button clicks
        if (processedCanvas) {
          document.getElementById("use-processed")?.addEventListener("click", async () => {
            imagePopup.remove();
            URL.revokeObjectURL(imageUrl);
            await proceedWithAzureAnalysis(processedCanvas);
          });
        }

        document.getElementById("use-original")?.addEventListener("click", async () => {
          imagePopup.remove();
          URL.revokeObjectURL(imageUrl);
          await proceedWithAzureAnalysis(image);
        });

        document.getElementById("close-popup")?.addEventListener("click", () => {
          imagePopup.remove();
          URL.revokeObjectURL(imageUrl);
          setIsScanning(false);
          setScanProgress(0);
        });
      };

      image.src = imageUrl;
    } catch (error) {
      console.error("Image processing error:", error);
      alert("Failed to process image. Please try again.");
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Function to proceed with Azure analysis and table confirmation
  const proceedWithAzureAnalysis = async (imageElement: HTMLImageElement | HTMLCanvasElement) => {
    try {
      setScanProgress(40);

      // Convert image/canvas to blob for Azure
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      ctx.drawImage(imageElement, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9);
      });

      setScanProgress(60);

      // Send image to server for Azure OCR processing
      const formData = new FormData();
      formData.append("image", blob, "scan.jpg");

      const response = await fetch("/api/azure-ocr", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process image");
      }

      const { result } = await response.json();
      setScanProgress(80);

      // Log raw Azure output for debugging

      setScanProgress(100);

      const parsedData = await parseIpptResults(result, allUsers || []);

      // Handle parsed data
      if (parsedData.length > 0) {
        // Convert to ConductParticipant format and add to list
        const conductParticipants: ConductParticipant[] = parsedData.map((participant) => ({
          scannedName: participant.name,
          name: participant.name,
          rank: participant.rank || "",
          platoon: participant.platoon || "",
          situpReps: participant.situpReps,
          pushupReps: participant.pushupReps,
          runTime: participant.runTime,
          situpScore: participant.situpScore,
          pushupScore: participant.pushupScore,
          runScore: participant.runScore,
          totalScore: participant.totalScore,
          result: participant.result,
          isEditing: false,
          matchPercentage: participant.matchPercentage,
          matchedUser: participant.matchedUser,
        }));

        // Store scanned participants for conflict resolution
        setScannedParticipants(conductParticipants);

        // Check for conflicts with existing participants
        const conflicts = checkConflicts(conductParticipants, participants);

        setParticipants((prev) => {
          const newParticipants = [...prev, ...conductParticipants];

          if (conflicts.length > 0) {
            // Show conflict dialog
            setConflictDialog({ isOpen: true, conflicts });
            return prev; // Don't update yet, wait for user decision
          }

          // No conflicts, proceed with normal duplicate checking
          const duplicate = checkDuplicates(newParticipants);
          if (duplicate) {
            setDuplicateError(duplicate);
          } else {
            setDuplicateError("");
          }
          return newParticipants;
        });

        // Reset scanning state - will be handled by conflict resolution if conflicts exist
        if (conflicts.length === 0) {
          setIsScanning(false);
          setScanProgress(0);
        }
      } else {
        // Fallback: If no tables found, try text-based parsing
        if (result.content) {
          const fallbackData = await parseTextBasedResults(result.content, conductDate);
          if (fallbackData.length > 0) {
            // Convert to ConductParticipant format and add to list with user matching
            const conductParticipants: ConductParticipant[] = await Promise.all(
              fallbackData.map(async (participant) => {
                // Find matching user to get their details
                const nameMatch = findBestNameMatch(participant.name, allUsers || []);
                const matchedUser = nameMatch.user;

                // Get user details or use defaults
                const userDob = matchedUser?.dob || new Date();
                const userRank = matchedUser?.rank || "";
                const userPlatoon = matchedUser?.mspId || "";
                const finalName = matchedUser?.fullName || participant.name;

                return {
                  scannedName: participant.name,
                  name: finalName,
                  rank: userRank,
                  platoon: userPlatoon,
                  age: participant.age,
                  situpReps: participant.situps ?? null,
                  pushupReps: participant.pushups ?? null,
                  runTime: participant.runTime ?? null,
                  situpScore: participant.situpScore,
                  pushupScore: participant.pushupScore,
                  runScore: participant.runScore,
                  totalScore: participant.totalScore,
                  result: participant.result,
                  isEditing: false,
                  matchPercentage: nameMatch.percentage,
                  matchedUser: matchedUser,
                };
              })
            );

            // Store scanned participants for conflict resolution
            setScannedParticipants(conductParticipants);

            // Check for conflicts with existing participants
            const conflicts = checkConflicts(conductParticipants, participants);

            setParticipants((prev) => {
              const newParticipants = [...prev, ...conductParticipants];

              if (conflicts.length > 0) {
                // Show conflict dialog
                setConflictDialog({ isOpen: true, conflicts });
                return prev; // Don't update yet, wait for user decision
              }

              // No conflicts, proceed with normal duplicate checking
              const duplicate = checkDuplicates(newParticipants);
              if (duplicate) {
                setDuplicateError(duplicate);
              } else {
                setDuplicateError("");
              }
              return newParticipants;
            });

            // Reset scanning state - will be handled by conflict resolution if conflicts exist
            if (conflicts.length === 0) {
              setIsScanning(false);
              setScanProgress(0);
            }
          } else {
            // Both parsing methods failed
            alert("No IPPT data found in image. Please try again with a clearer scoresheet.");
            setIsScanning(false);
            setScanProgress(0);
          }
        } else {
          // No content available
          alert("No IPPT data found in image. Please try again with a clearer scoresheet.");
          setIsScanning(false);
          setScanProgress(0);
        }
      }
    } catch (error) {
      console.error("Azure Document Intelligence Error:", error);
      console.error("Error details:", error instanceof Error ? error.message : error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

      // Provide more specific error messages
      let errorMessage = "Failed to process image. ";

      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("403")) {
          errorMessage +=
            "Azure API key is invalid or expired. Please check your VITE_AZURE_API_KEY environment variable.";
        } else if (error.message.includes("404")) {
          errorMessage +=
            "Azure endpoint not found. Please check your AZURE_ENDPOINT configuration.";
        } else if (error.message.includes("429")) {
          errorMessage += "Azure API rate limit exceeded. Please try again in a few moments.";
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage += "Network error. Please check your internet connection.";
        } else {
          errorMessage += `Error: ${error.message}`;
        }
      } else {
        errorMessage += "Please check your Azure configuration and try again.";
      }

      alert(errorMessage);
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const handleAddManual = () => {
    const newParticipant: ConductParticipant = {
      name: "",
      rank: "",
      platoon: "",
      age: "",
      situpReps: 0,
      situpScore: 0,
      pushupReps: 0,
      pushupScore: 0,
      runTime: 0,
      runScore: 0,
      totalScore: 0,
      result: "Fail",
      isEditing: false,
    };

    setParticipants((prev) => [...prev, newParticipant]);
    
    // Broadcast to other devices
    if (isSyncing) {
      broadcastParticipantAdd(newParticipant as unknown as SyncParticipant);
    }
  };

  const handleEditParticipant = (index: number) => {
    setParticipants((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, isEditing: !p.isEditing } : { ...p, isEditing: false }
      )
    );
  };

  const handleDeleteParticipant = (index: number) => {
    const newParticipants = participants.filter((_, i) => i !== index);
    const duplicate = checkDuplicates(newParticipants);
    if (duplicate) {
      setDuplicateError(duplicate);
    } else {
      setDuplicateError("");
    }
    setParticipants(newParticipants);
    
    // Broadcast to other devices
    if (isSyncing) {
      broadcastParticipantRemove(index);
    }
  };

  const handleCreateConduct = async () => {
    if (!conductName || !conductDate) {
      alert("Please fill in conduct name and date");
      return;
    }

    if (participants.length === 0) {
      alert("Please add at least one participant");
      return;
    }

    try {
      // Create IPPT session API call with participants
      const response = await fetch("/api/ippt/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: conductName,
          date: conductDate,
          participants: participants.map((p) => ({
            name: p.name,
            rank: p.rank,
            platoon: p.platoon,
            situpReps: p.situpReps,
            situpScore: p.situpScore,
            pushupReps: p.pushupReps,
            pushupScore: p.pushupScore,
            runTime: p.runTime,
            runScore: p.runScore,
            totalScore: p.totalScore,
            result: p.result,
            userId: p.matchedUser?.id || null,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create conduct");
      }

      const result = await response.json();

      // Clear draft after successful creation
      localStorage.removeItem(getDraftKey());

      // Show success message
      alert("Conduct created successfully!");

      // Invalidate the IPPT sessions cache to refresh dropdown
      queryClient.invalidateQueries({ queryKey: ["/api/ippt/sessions"] });

      // Redirect back to IPPT tracker conduct view
      setLocation("/ippt-tracker");
    } catch (error) {
      console.error("Error creating conduct:", error);
      alert(error instanceof Error ? error.message : "Failed to create conduct. Please try again.");
    }
  };

  const handleSaveDraft = () => {
    const draftData = {
      conductName,
      conductDate,
      participants,
      savedAt: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(getDraftKey(), JSON.stringify(draftData));

    // Show success message
    alert("Draft saved successfully!");
  };

  const handleClearDraft = () => {
    localStorage.removeItem(getDraftKey());
    setConductName("");
    setConductDate("");
    setParticipants([]);
    alert("Draft cleared!");
  };

  const handleLoadDraft = () => {
    const savedDraft = localStorage.getItem(getDraftKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setConductName(draftData.conductName || "");
        setConductDate(draftData.conductDate || "");
        setParticipants(draftData.participants || []);

        const savedDate = new Date(draftData.savedAt);
        alert(`Draft loaded from ${savedDate.toLocaleString()}`);
      } catch (error) {
        console.error("Error loading draft:", error);
        alert("Error loading draft");
      }
    } else {
      alert("No saved draft found");
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/ippt-tracker")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create New Conduct</h1>
              <p className="text-muted-foreground">
                Set up a new IPPT conduct session with participants
              </p>
            </div>
          </div>
          
          {/* Sync Status Indicator */}
          {conductId && (
            <div className="flex flex-col items-end gap-1">
              {/* Main status badge */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isReconnecting
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse"
                  : isConnected
                    ? isSyncing 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }`}>
                {isReconnecting ? (
                  <>
                    <Wifi className="w-3 h-3 animate-pulse" />
                    <span>Reconnecting...</span>
                  </>
                ) : isConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    {isSyncing ? (
                      <>
                        <span>Synced</span>
                        <div className="flex items-center gap-1 ml-1">
                          {otherDevices.filter(d => d.deviceType !== deviceType).map((device, i) => (
                            <span key={i} title={`Connected to ${device.deviceType}`} className="flex items-center">
                              {device.deviceType === "mobile" ? (
                                <Smartphone className="w-3 h-3" />
                              ) : (
                                <Monitor className="w-3 h-3" />
                              )}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span>Connected (single device)</span>
                    )}
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </>
                )}
              </div>
              
              {/* Sync warning banner */}
              {syncWarning && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <span>{syncWarning}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => {
                      broadcastParticipantsSync(participants as unknown as SyncParticipant[]);
                      setSyncWarning(null);
                    }}
                  >
                    Sync Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs"
                    onClick={() => setSyncWarning(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {/* Last sync info */}
              {lastSyncInfo && isSyncing && !syncWarning && (
                <div className="text-[10px] text-muted-foreground">
                  Last synced from {lastSyncInfo.from === "mobile" ? "phone" : "laptop"} {Math.round((Date.now() - lastSyncInfo.time) / 1000) < 60 ? "just now" : `${Math.round((Date.now() - lastSyncInfo.time) / 60000)}m ago`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conduct Details */}
        <Card>
          <CardHeader>
            <CardTitle>Conduct Details</CardTitle>
            <CardDescription>Enter basic information for this IPPT conduct session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conduct-name">IPPT Conduct Name</Label>
                <Input
                  id="conduct-name"
                  placeholder="e.g., Annual IPPT Test 2024, Remedial Training, Pre-Enlistment IPPT"
                  value={conductName}
                  onChange={(e) => setConductName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conduct-date">Conduct Date</Label>
                <Input
                  id="conduct-date"
                  type="date"
                  value={conductDate}
                  onChange={(e) => setConductDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Participants ({participants.length})
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={handleAddManual}
                  className="flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4" />
                  Add Manually
                </Button>
                <Button
                  variant="outline"
                  onClick={handleScanScoresheet}
                  disabled={isScanning}
                  className="flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Scan className="w-4 h-4" />
                  {isScanning ? "Scanning..." : "Scan Scoresheet"}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-2 sm:p-4 md:p-6">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Scan Progress */}
            {isScanning && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{scanProgress}%</span>
                </div>
              </div>
            )}

            {/* Participants Table */}
            {duplicateError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 font-medium">{duplicateError}</p>
              </div>
            )}

            {participants.length > 0 && (
              <div className="bg-background sm:border sm:border-border sm:rounded-lg sm:overflow-hidden">
                <div className="overflow-x-auto mb-5">
                  <table className="border-collapse w-full min-w-[700px] sm:min-w-[900px] text-xs sm:text-sm">
                    <thead className="bg-gradient-to-r from-muted/50 to-muted border-b-2 border-border">
                      <tr>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          #
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-left font-semibold">
                          Name
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Age
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Sit-ups
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Push-ups
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Run Time
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Total
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold">
                          Result
                        </th>
                        <th className="p-1 sm:p-2 md:p-3 border border-border text-center font-semibold w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant, index) => (
                        <tr key={index} className="hover:bg-muted/50 transition-colors">
                          <td className="p-1 sm:p-2 md:p-3 border border-border text-center font-medium">
                            {index + 1}
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border">
                            <div className="relative">
                              <Input
                                type="text"
                                value={participant.name}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  handleUpdateParticipant(index, "name", value);
                                  filterUsers(value, index);
                                }}
                                onFocus={() => filterUsers(participant.name, index)}
                                placeholder="Type or select user..."
                                className={`pr-8 ${
                                  participant.matchPercentage !== undefined
                                    ? participant.matchPercentage === 100
                                      ? "border-green-500 bg-green-100 text-gray-900"
                                      : participant.matchPercentage >= 80
                                        ? "border-blue-500 bg-blue-100 text-gray-900"
                                        : participant.matchPercentage >= 50
                                          ? "border-yellow-500 bg-yellow-100 text-gray-900"
                                          : "border-red-500 bg-red-100 text-gray-900"
                                    : "border-gray-300 bg-background text-foreground"
                                }`}
                                disabled={false}
                              />
                              {participant.matchPercentage !== undefined && (
                                <div
                                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold px-1.5 py-0.5 rounded ${
                                    participant.matchPercentage === 100
                                      ? "bg-green-500 text-white"
                                      : participant.matchPercentage >= 80
                                        ? "bg-blue-500 text-white"
                                        : participant.matchPercentage >= 50
                                          ? "bg-yellow-500 text-white"
                                          : "bg-red-500 text-white"
                                  }`}
                                >
                                  {participant.matchPercentage}%
                                </div>
                              )}
                              {userSuggestions[index] && userSuggestions[index].length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                  {userSuggestions[index].map((user: SafeUser) => (
                                    <div
                                      key={user.id}
                                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                      onClick={() => selectUser(index, user)}
                                    >
                                      {user.fullName}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border text-center">
                            <span className="font-medium">
                              {conductDate && participant.matchedUser?.dob
                                ? calculateFinancialYearAge(participant.matchedUser.dob, conductDate)
                                : participant.age || ""}
                            </span>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border">
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                value={participant.situpReps === 0 ? "" : participant.situpReps}
                                onChange={(e) =>
                                  handleUpdateParticipant(
                                    index,
                                    "situpReps",
                                    e.target.value === "" ? 0 : parseInt(e.target.value) || 0
                                  )
                                }
                                min="0"
                                max="100"
                                placeholder="0"
                                className="w-full p-1 sm:p-2 border border-border rounded-md bg-background text-foreground text-center font-medium text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              />
                              <div className="text-xs text-center font-bold text-foreground">
                                {participant.situpScore || ""} pts
                              </div>
                            </div>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border">
                            <div className="flex flex-col gap-1">
                              <Input
                                type="number"
                                value={participant.pushupReps === 0 ? "" : participant.pushupReps}
                                onChange={(e) =>
                                  handleUpdateParticipant(
                                    index,
                                    "pushupReps",
                                    e.target.value === "" ? 0 : parseInt(e.target.value) || 0
                                  )
                                }
                                min="0"
                                max="100"
                                placeholder="0"
                                className="w-full p-1 sm:p-2 border border-border rounded-md bg-background text-foreground text-center font-medium text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                              />
                              <div className="text-xs text-center font-bold text-foreground">
                                {participant.pushupScore || ""} pts
                              </div>
                            </div>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border">
                            <div className="flex flex-col gap-1">
                              <Input
                                type="text"
                                value={(() => {
                                  const rt = participant.runTime;
                                  if (rt === 0 || rt === "" || rt === null || rt === undefined) return "";
                                  if (typeof rt === "string") return rt;
                                  const seconds = Number(rt);
                                  if (!Number.isFinite(seconds) || seconds === 0) return "";
                                  const mins = Math.floor(seconds / 60);
                                  const secs = seconds % 60;
                                  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
                                })()}
                                onChange={(e) => {
                                  let digits = e.target.value.replace(/[^0-9]/g, "");
                                  if (digits.length > 4) digits = digits.slice(0, 4);
                                  if (digits.length === 0) {
                                    handleUpdateParticipant(index, "runTime", "");
                                    return;
                                  }
                                  let formatted = digits;
                                  if (digits.length > 2) {
                                    formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
                                  }
                                  handleUpdateParticipant(index, "runTime", formatted);
                                }}
                                onBlur={(e) => {
                                  let digits = e.target.value.replace(/[^0-9]/g, "");
                                  if (digits.length === 0) {
                                    handleUpdateParticipant(index, "runTime", "");
                                    return;
                                  }
                                  digits = digits.padEnd(4, "0");
                                  const minsNumber = parseInt(digits.slice(0, 2)) || 0;
                                  let secsNumber = parseInt(digits.slice(2, 4)) || 0;
                                  if (secsNumber > 59) secsNumber = 59;
                                  const formatted = `${minsNumber.toString().padStart(2, "0")}:${secsNumber.toString().padStart(2, "0")}`;
                                  handleUpdateParticipant(index, "runTime", formatted);
                                }}
                                inputMode="numeric"
                                maxLength={5}
                                placeholder="MM:SS"
                                className="w-full p-1 sm:p-2 border border-border rounded-md bg-background text-foreground text-center font-medium text-xs sm:text-sm focus:ring-2 focus:ring-primary focus-border-primary transition-all"
                              />
                              <div className="text-xs text-center font-bold text-foreground">
                                {participant.runScore || ""} pts
                              </div>
                            </div>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border text-center">
                            <span className="font-bold text-lg text-foreground">
                              {participant.totalScore || ""}
                            </span>
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border text-center">
                            {participant.totalScore ? (
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-md ${
                                  participant.result === "Fail"
                                    ? "bg-gradient-to-r from-red-400 to-rose-300 text-red-900"
                                    : participant.result === "Pass"
                                      ? "bg-gradient-to-r from-green-400 to-emerald-300 text-green-900"
                                      : participant.result === "Silver"
                                        ? "bg-gradient-to-r from-gray-300 to-slate-300 text-gray-900"
                                        : participant.result === "Gold"
                                          ? "bg-gradient-to-r from-yellow-400 to-amber-300 text-yellow-900"
                                          : "bg-gradient-to-r from-green-400 to-emerald-300 text-green-900"
                                }`}
                              >
                                {participant.result || "Pass"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-1 sm:p-2 md:p-3 border border-border text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteParticipant(index)}
                              className="hover:bg-muted text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {participants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No participants added yet. Add soldiers manually or scan a scoresheet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setLocation("/ippt-tracker")}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} className="w-full sm:w-auto">
            Save Draft
          </Button>
          <div className="relative">
            <Button
              onClick={handleCreateConduct}
              disabled={!canCreateConduct()}
              className="w-full sm:w-auto"
            >
              Create Conduct ({participants.length})
            </Button>
            {!canCreateConduct() && participants.length > 0 && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-muted text-muted-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                {duplicateError ? "Resolve duplicates first" : "Complete all participant data"}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-muted"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conflict Resolution Dialog */}
      {conflictDialog.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Participant Conflicts Detected
            </h3>

            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-3">
                The following participants already exist in your table:
              </p>

              <div className="max-h-40 overflow-y-auto space-y-2">
                {conflictDialog.conflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-md border border-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">{conflict.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Row {conflict.existingIndex + 1}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Scanned data available</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleConflictResolution("skip", scannedParticipants)}
                className="flex-1"
              >
                Don't Import
              </Button>
              <Button
                onClick={() => handleConflictResolution("overwrite", scannedParticipants)}
                className="flex-1"
              >
                Overwrite Existing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

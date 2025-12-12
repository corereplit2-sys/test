import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from "wouter";
import { Search, X, Plus, Filter, Edit2, Save, Calendar, Camera, Trash2, Trash } from "lucide-react";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import { type IpptAttempt, type IpptSession, type IpptSessionWithAttempts, type IpptCommanderStats, type TrooperIpptSummary, type SafeUser, type UserEligibility } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Navbar } from "@/components/Navbar";

// Azure Document Intelligence credentials
const AZURE_ENDPOINT = 'https://ipptocr.cognitiveservices.azure.com/';
const AZURE_API_KEY = import.meta.env.VITE_AZURE_API_KEY;

// Debug Azure configuration
console.log('=== AZURE CONFIGURATION DEBUG ===');
console.log('AZURE_ENDPOINT:', AZURE_ENDPOINT);
console.log('AZURE_API_KEY:', AZURE_API_KEY ? 'SET' : 'NOT SET');
console.log('API Key Length:', AZURE_API_KEY?.length || 0);
console.log('=====================================');

// Helper function to get age group from date of birth
const getAgeGroup = (dob: Date): string => {
  const age = Math.floor((new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  
  if (age <= 22) return "18";
  else if (age <= 27) return "25"; 
  else if (age <= 32) return "28";
  else if (age <= 37) return "33";
  else if (age <= 42) return "38";
  else return "43";
};

// Helper function to convert run time string to seconds
const parseRunTimeToSeconds = (runTime: string | number | undefined | null): number => {
  if (!runTime) return 0;
  if (typeof runTime === 'number') return runTime;
  if (typeof runTime === 'string' && runTime.includes(':')) {
    const [minutes, seconds] = runTime.split(':').map(Number);
    return minutes * 60 + seconds;
  }
  return 0;
};

// Helper function to calculate IPPT score using database scoring matrix
const calculateIpptScore = async (situps: number, pushups: number, runTime: number, dob: Date): Promise<{totalScore: number, result: string, situpScore: number, pushupScore: number, runScore: number}> => {
  try {
    const ageGroup = getAgeGroup(dob);
    console.log('Fetching scoring data for age group:', ageGroup);
    
    const response = await fetch(`/api/ippt/scoring/${ageGroup}`, {
      credentials: 'include' // Include session cookies for authentication
    });
    
    if (!response.ok) {
      console.error('Failed to get scoring data. Status:', response.status);
      throw new Error(`Failed to get scoring data: ${response.status}`);
    }
    
    const scoringData = await response.json();
    console.log('Received scoring data:', scoringData);
    
    // Find sit-up score (find first entry where reps >= target)
    const situpScore = scoringData.situpsScoring.find(([reps]: [number, number]) => reps <= situps)?.[1] || 0;
    
    // Find push-up score (find first entry where reps >= target)
    const pushupScore = scoringData.pushupsScoring.find(([reps]: [number, number]) => reps <= pushups)?.[1] || 0;
    
    // Find run score (find first entry where seconds <= target)
    const runScore = scoringData.runScoring.find(([seconds]: [number, number]) => seconds >= runTime)?.[1] || 0;
    
    const totalScore = situpScore + pushupScore + runScore;
    
    // Determine award
    let result = 'Fail';
    if (totalScore >= 85) result = 'Gold';
    else if (totalScore >= 75) result = 'Silver';
    else if (totalScore >= 51) result = 'Pass';
    
    console.log('Calculated scores:', { situpScore, pushupScore, runScore, totalScore, result });
    
    return { totalScore, result, situpScore, pushupScore, runScore };
  } catch (error) {
    console.error('Error calculating IPPT score:', error);
    throw error; // Re-throw to let the caller handle it
  }
};

interface GroupStatistics {
  bestBreakdown: {
    total: number;
    gold: number;
    silver: number;
    pass: number;
    fail: number;
    ytt: number;
  };
  initialBreakdown: {
    total: number;
    gold: number;
    silver: number;
    pass: number;
    fail: number;
    ytt: number;
  };
  improvementRates: {
    gold: number;
    silver: number;
    pass: number;
    fail: number;
  };
  averageScores: {
    situps: number;
    pushups: number;
    runTime: string;
    score: number;
  };
}

type FilterTag = {
  id: string;
  type: "msp" | "rank" | "status";
  label: string;
  value: string;
};

function IpptTracker() {
  const [themeKey, setThemeKey] = useState(0);
  
  // Force chart regeneration when theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeKey(prev => prev + 1);
    };
    
    // Listen for theme changes
    const observer = new MutationObserver(() => {
      handleThemeChange();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);
  
  const { data: user, isLoading: authLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const [, setLocation] = useLocation();
  const [selectedGroup, setSelectedGroup] = useState('MSC Overall');
  const [viewMode, setViewMode] = useState<'stats' | 'leaderboard' | 'conduct' | 'scores'>('stats');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);

  // Toggle function for user details
  const toggleUserDetail = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Define the exact groups as specified
  const dashboardGroups = [
    "MSC Overall",
    "MSC Commanders", 
    "MSC Troopers",
    "MSP 1",
    "MSP 2", 
    "MSP 3",
    "MSP 4",
    "MSP 5"
  ];

  const [selectedConduct, setSelectedConduct] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [conductSearchTerm, setConductSearchTerm] = useState<string>('');
  const [filterTags, setFilterTags] = useState<Array<{id: string, type: string, label: string, value: string}>>([]);
  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const [expandedUsers, setExpandedUsers] = useState<{[key: string]: boolean}>({});
  const [debugTrooperId, setDebugTrooperId] = useState<string | null>(null);
  
  // Eligibility Editor State
  const [eligibilityEditorOpen, setEligibilityEditorOpen] = useState<boolean>(false);
  const [editingTrooper, setEditingTrooper] = useState<TrooperIpptSummary | null>(null);
  const [eligibilityForm, setEligibilityForm] = useState({
    isEligible: true,
    reason: '',
    ineligibilityType: 'indefinite' as "indefinite" | "until_date",
    untilDate: ''
  });

  // Scan Scoresheet State
  const [scanModalOpen, setScanModalOpen] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<'scan' | 'confirm' | 'edit'>('scan');
  const [scannedData, setScannedData] = useState<{
    name: string;
    situps: number;
    pushups: number;
    runTime: number;
    situpScore: number;
    pushupScore: number;
    runScore: number;
    totalScore: number;
    result: string;
  } | null>(null);
  const [editingData, setEditingData] = useState<{
    situps: number;
    pushups: number;
    runTime: number;
  } | null>(null);
  const [draftEntries, setDraftEntries] = useState<Array<{
    id: string;
    data: typeof scannedData;
    timestamp: Date;
  }>>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);

  // Parse IPPT results from Azure Document Intelligence table structure
  const parseIpptResults = async (result: any): Promise<Array<{
    activity: string;
    ipptDate: string;
    platoon?: string;
    rank?: string;
    name: string;
    dob: string;
    ageAsOfIppt: number;
    result: string;
    totalScore: number;
    situpReps: number;
    situpScore: number;
    pushupReps: number;
    pushupScore: number;
    runTime: string;
    runScore: number;
  }>> => {
    const entries: Array<{
      activity: string;
      ipptDate: string;
      platoon?: string;
      rank?: string;
      name: string;
      dob: string;
      ageAsOfIppt: number;
      result: string;
      totalScore: number;
      situpReps: number;
      situpScore: number;
      pushupReps: number;
      pushupScore: number;
      runTime: string;
      runScore: number;
    }> = [];
    
    console.log('=== PARSING AZURE TABLE STRUCTURE ===');
    
    if (!result.tables || result.tables.length === 0) {
      console.log('No tables found in Azure result');
      return entries;
    }
    
    const table = result.tables[0];
    console.log(`Table found with ${table.rowCount} rows and ${table.columnCount} columns`);
    console.log('Total cells:', table.cells.length);
    
    // Find header row indices and column mappings
    const headerCells = table.cells.filter((cell: any) => cell.kind === 'columnHeader');
    console.log('Header cells:', headerCells.length);
    
    // Create column mapping
    const columnMap: { [key: string]: number } = {};
    headerCells.forEach((cell: any) => {
      const content = cell.content.toLowerCase();
      if (content.includes('s/n')) columnMap['serial'] = cell.columnIndex;
      else if (content.includes('nric')) columnMap['nric'] = cell.columnIndex;
      else if (content.includes('name')) columnMap['name'] = cell.columnIndex;
      else if (content.includes('unit')) columnMap['unit'] = cell.columnIndex;
      else if (content.includes('age')) columnMap['age'] = cell.columnIndex;
      else if (content.includes('tag')) columnMap['tag'] = cell.columnIndex;
      else if (content.includes('reps') && cell.rowIndex === 1 && cell.columnIndex === 7) columnMap['situpReps'] = cell.columnIndex;
      else if (content.includes('pts') && cell.rowIndex === 1 && cell.columnIndex === 8) columnMap['situpPts'] = cell.columnIndex;
      else if (content.includes('reps') && cell.rowIndex === 1 && cell.columnIndex === 9) columnMap['pushupReps'] = cell.columnIndex;
      else if (content.includes('pts') && cell.rowIndex === 1 && cell.columnIndex === 10) columnMap['pushupPts'] = cell.columnIndex;
      else if (content.includes('mm:ss')) columnMap['runTime'] = cell.columnIndex;
      else if (content.includes('pts') && cell.rowIndex === 1 && cell.columnIndex === 12) columnMap['runPts'] = cell.columnIndex;
      else if (content.includes('total')) columnMap['total'] = cell.columnIndex;
      else if (content.includes('g/s')) columnMap['result'] = cell.columnIndex;
    });
    
    console.log('Column mapping:', columnMap);
    
    // Process data rows (skip header rows)
    const dataRows = table.cells.filter((cell: any) => 
      cell.kind === 'content' && cell.rowIndex >= 2
    );
    
    // Group cells by row
    const rowsByIndex: { [key: number]: any[] } = {};
    dataRows.forEach((cell: any) => {
      if (!rowsByIndex[cell.rowIndex]) {
        rowsByIndex[cell.rowIndex] = [];
      }
      rowsByIndex[cell.rowIndex][cell.columnIndex] = cell;
    });
    
    console.log('Data rows found:', Object.keys(rowsByIndex).length);
    
    // Process each row
    for (const rowIndex of Object.keys(rowsByIndex)) {
      const rowCells = rowsByIndex[parseInt(rowIndex)];
      const serialCell = rowCells[columnMap['serial']];
      
      // Only process rows with any serial number (not just 1-10)
      if (serialCell && /^\d+$/.test(serialCell.content)) {
        const serialNum = parseInt(serialCell.content);
        console.log(`Processing row with serial number: ${serialNum}`);
        
        const nameCell = rowCells[columnMap['name']];
        const situpRepsCell = rowCells[columnMap['situpReps']];
        const situpPtsCell = rowCells[columnMap['situpPts']];
        const pushupRepsCell = rowCells[columnMap['pushupReps']];
        const pushupPtsCell = rowCells[columnMap['pushupPts']];
        const runTimeCell = rowCells[columnMap['runTime']];
        const runPtsCell = rowCells[columnMap['runPts']];
        const totalCell = rowCells[columnMap['total']];
        const resultCell = rowCells[columnMap['result']];
        
        // Extract data with fallbacks
        const name = nameCell?.content || 'Unknown';
        const situpReps = parseInt(situpRepsCell?.content) || 0;
        const situpPts = parseInt(situpPtsCell?.content) || 0;
        const pushupReps = parseInt(pushupRepsCell?.content) || 0;
        const pushupPts = parseInt(pushupPtsCell?.content) || 0;
        const runTimeStr = runTimeCell?.content || '';
        const runPts = parseInt(runPtsCell?.content) || 0;
        const totalScore = parseInt(totalCell?.content) || 0;
        const result = resultCell?.content || '';
        
        // Parse run time
        let runTime = 0;
        if (runTimeStr.includes(':')) {
          const [minutes, seconds] = runTimeStr.split(':').map(Number);
          runTime = minutes * 60 + seconds;
        }
        
        console.log(`Row ${serialNum}: ${name}, Sit-ups: ${situpReps}, Push-ups: ${pushupReps}, Run: ${runTimeStr}`);
        
        // Find matching user to get their details
        const allUsers = (commanderStats as any)?.troopers?.map((t: any) => t.user) || [];
        const matchedUser = findBestNameMatch(name, allUsers);
        
        // Get user details or use defaults
        const userDob = matchedUser?.dob || new Date();
        const userRank = matchedUser?.rank || '';
        const userPlatoon = matchedUser?.mspId || '';
        const finalName = matchedUser?.fullName || name;
        
        // Calculate age as of IPPT date (use today's date for now)
        const ipptDate = new Date();
        const ageAsOfIppt = Math.floor((ipptDate.getTime() - new Date(userDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (runTimeStr.includes(':')) {
          const [minutes, seconds] = runTimeStr.split(':').map(Number);
          runTime = minutes * 60 + seconds;
        }
        
        // Use database scoring with actual user DOB
        const scoreResult = await calculateIpptScore(situpReps, pushupReps, runTime, new Date(userDob));
        
        // Use Azure-provided scores if available, otherwise use calculated scores
        const finalSitupScore = situpPts || scoreResult.situpScore;
        const finalPushupScore = pushupPts || scoreResult.pushupScore;
        const finalRunScore = runPts || scoreResult.runScore;
        const finalTotalScore = totalScore || scoreResult.totalScore;
        const finalResult = result || scoreResult.result;
        
        // Format run time as MM:SS
        const formattedRunTime = runTimeStr || `${Math.floor(runTime / 60)}:${(runTime % 60).toString().padStart(2, '0')}`;
        
        entries.push({
          activity: 'IPPT Test',
          ipptDate: ipptDate.toISOString().split('T')[0],
          platoon: userPlatoon,
          rank: userRank,
          name: finalName.trim(),
          dob: new Date(userDob).toISOString().split('T')[0],
          ageAsOfIppt,
          result: finalResult,
          totalScore: finalTotalScore,
          situpReps,
          situpScore: finalSitupScore,
          pushupReps,
          pushupScore: finalPushupScore,
          runTime: formattedRunTime,
          runScore: finalRunScore
        });
      }
    }
    
    console.log(`Parsed ${entries.length} valid soldier entries from table`);
    console.log('========================');
    return entries;
  };

  // Handle image upload with jscanify processing + popup
  const handleImageUpload = async (file: File) => {
    setIsScanning(true);
    setScanProgress(0);
    
    try {
      setScanProgress(25);
      
      // Create image element
      const image = new Image();
      const imageUrl = URL.createObjectURL(file);
      
      image.onload = async function() {
        setScanProgress(50);
        
        // Try to load jscanify from CDN (requires OpenCV)
        let processedCanvas: HTMLCanvasElement | null = null;
        
        // Wait for OpenCV and jscanify to load (OpenCV can take time)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Checking for jscanify availability...');
        console.log('window.cv (OpenCV):', (window as any).cv);
        console.log('window.jscanify:', (window as any).jscanify);
        console.log('typeof window.jscanify:', typeof (window as any).jscanify);
        
        // Check if both OpenCV and jscanify are available
        if ((window as any).cv && (window as any).jscanify) {
          try {
            console.log('Both OpenCV and jscanify available, creating scanner...');
            const scanner = new (window as any).jscanify();
            console.log('jscanify instance created:', scanner);
            
            if (scanner.extractPaper) {
              console.log('extractPaper method found, processing image...');
              
              // Calculate aspect ratio to preserve original proportions
              const aspectRatio = image.width / image.height;
              const targetWidth = 800; // Base width
              const targetHeight = Math.round(targetWidth / aspectRatio); // Calculate height to maintain aspect ratio
              
              console.log(`Original dimensions: ${image.width}x${image.height}, aspect ratio: ${aspectRatio.toFixed(2)}`);
              console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);
              
              processedCanvas = scanner.extractPaper(image, targetWidth, targetHeight);
              console.log('jscanify processed the image successfully');
              console.log('Processed canvas dimensions:', processedCanvas?.width, 'x', processedCanvas?.height);
            } else {
              console.warn('extractPaper method not found on jscanify instance');
            }
          } catch (e) {
            console.error('jscanify processing failed:', e);
          }
        } else {
          if (!(window as any).cv) {
            console.error('OpenCV not loaded - jscanify requires OpenCV');
          }
          if (!(window as any).jscanify) {
            console.error('jscanify not loaded');
          }
        }
        
        setScanProgress(75);
        
        // Show popup with both original and processed images
        const imagePopup = document.createElement('div');
        imagePopup.innerHTML = `
          <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                      bg-card border border-border rounded-lg shadow-lg 
                      max-w-[95vw] max-h-[95vh] overflow-auto z-[9999] p-5">
            <h3 class="text-lg font-semibold text-foreground mb-5 text-center">Image Processing Results</h3>
            
            ${processedCanvas ? `
              <div class="mb-5">
                <h4 class="text-sm font-medium text-muted-foreground mb-2.5">Processed Image (jscanify)</h4>
                <div class="text-center">
                  <img src="${processedCanvas.toDataURL('image/jpeg', 0.9)}" 
                       class="max-w-[45%] max-h-[40vh] border rounded-md mx-0.5" />
                </div>
              </div>
            ` : ''}
            
            <div class="mb-5">
              <h4 class="text-sm font-medium text-muted-foreground mb-2.5">Original Image</h4>
              <div class="text-center">
                <img src="${imageUrl}" 
                     class="max-w-[${processedCanvas ? '45%' : '80%'}] max-h-[40vh] border rounded-md mx-0.5" />
              </div>
            </div>
            
            <div class="flex gap-2.5 justify-center flex-wrap">
              ${processedCanvas ? `
                <button id="use-processed" 
                        class="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                  Use Processed Image
                </button>
              ` : ''}
              <button id="use-original" 
                      class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                Use Original Image
              </button>
              <button id="close-popup" 
                      class="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-md cursor-pointer transition-colors">
                Close
              </button>
            </div>
            
            ${!processedCanvas ? `
              <div class="mt-4 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-md text-center">
                <small class="text-red-700 dark:text-red-400">jscanify not available - only original image shown</small>
              </div>
            ` : ''}
          </div>
        `;
        document.body.appendChild(imagePopup);
        
        // Handle button clicks
        if (processedCanvas) {
          document.getElementById('use-processed')?.addEventListener('click', async () => {
            imagePopup.remove();
            URL.revokeObjectURL(imageUrl);
            await proceedWithAzureAnalysis(processedCanvas);
          });
        }
        
        document.getElementById('use-original')?.addEventListener('click', async () => {
          imagePopup.remove();
          URL.revokeObjectURL(imageUrl);
          await proceedWithAzureAnalysis(image);
        });
        
        document.getElementById('close-popup')?.addEventListener('click', () => {
          imagePopup.remove();
          URL.revokeObjectURL(imageUrl);
          setIsScanning(false);
          setScanProgress(0);
        });
      };
      
      image.src = imageUrl;
      
    } catch (error) {
      console.error('Image processing error:', error);
      alert('Failed to process image. Please try again.');
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Function to proceed with Azure analysis and table confirmation
  const proceedWithAzureAnalysis = async (imageElement: HTMLImageElement | HTMLCanvasElement) => {
    try {
      setScanProgress(40);
      
      // Convert image/canvas to blob for Azure
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      ctx.drawImage(imageElement, 0, 0);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      });
      
      setScanProgress(60);
      
      // Initialize Azure Document Intelligence client
      const client = new DocumentAnalysisClient(
        AZURE_ENDPOINT,
        new AzureKeyCredential(AZURE_API_KEY)
      );
      
      // Analyze document using prebuilt-layout for better table extraction
      const poller = await client.beginAnalyzeDocument(
        "prebuilt-layout", 
        blob
      );
      
      setScanProgress(80);
      
      // Get results
      const result = await poller.pollUntilDone();
      setScanProgress(100);
      
      // Log raw Azure output for debugging
      console.log('=== RAW AZURE OUTPUT ===');
      console.log('Full result:', JSON.stringify(result, null, 2));
      console.log('Content:', result.content);
      console.log('Tables:', result.tables);
      console.log('Number of tables:', result.tables?.length || 0);
      console.log('Pages:', result.pages);
      console.log('========================');
      
      const parsedData = await parseIpptResults(result);
      
      // Fallback: If no tables found, try text-based parsing
      if (parsedData.length === 0 && result.content) {
        console.log('No table data found, trying text-based fallback...');
        const fallbackData = await parseTextBasedResults(result.content);
        if (fallbackData.length > 0) {
          showTableConfirmationPopup(fallbackData, result);
        } else {
          alert('No IPPT data found in image. Please try again with a clearer scoresheet.');
          setIsScanning(false);
          setScanProgress(0);
        }
      } else if (parsedData.length > 0) {
        showTableConfirmationPopup(parsedData, result);
      } else {
        alert('No IPPT data found in image. Please try again with a clearer scoresheet.');
        setIsScanning(false);
        setScanProgress(0);
      }
    } catch (error) {
      console.error('Azure Document Intelligence Error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to process image. ';
      
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          errorMessage += 'Azure API key is invalid or expired. Please check your VITE_AZURE_API_KEY environment variable.';
        } else if (error.message.includes('404')) {
          errorMessage += 'Azure endpoint not found. Please check your AZURE_ENDPOINT configuration.';
        } else if (error.message.includes('429')) {
          errorMessage += 'Azure API rate limit exceeded. Please try again in a few moments.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your internet connection.';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
      } else {
        errorMessage += 'Please check your Azure configuration and try again.';
      }
      
      alert(errorMessage);
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Fallback text-based parser for when table extraction fails
  const parseTextBasedResults = async (content: string): Promise<Array<{
    name: string;
    situps: number;
    pushups: number;
    runTime: number;
    situpScore: number;
    pushupScore: number;
    runScore: number;
    totalScore: number;
    result: string;
  }>> => {
    const entries: Array<{
      name: string;
      situps: number;
      pushups: number;
      runTime: number;
      situpScore: number;
      pushupScore: number;
      runScore: number;
      totalScore: number;
      result: string;
    }> = [];
    
    console.log('=== TEXT-BASED PARSING FALLBACK ===');
    
    // Extract text content and split into lines
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('Total lines:', lines.length);
    console.log('First 20 lines:', lines.slice(0, 20));
    
    // Find table data - look for numbered entries (1-10)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is any serial number (not just 1-10)
      if (/^\d+$/.test(line)) {
        const serialNum = parseInt(line);
        console.log(`Found soldier ${serialNum} at index ${i}`);
        
        // Extract soldier data - pattern: S/N, NRIC, Name, Age, Training, Tag, Sit-up reps, Sit-up pts, Push-up reps, Push-up pts, Run time, Run pts
        if (i + 11 < lines.length) {
          const nric = lines[i + 1];
          const name = lines[i + 2];
          const age = lines[i + 3];
          const training = lines[i + 4];
          const tag = lines[i + 5];
          const situpReps = parseInt(lines[i + 6]) || 0;
          const situpPts = parseInt(lines[i + 7]) || 0;
          const pushupReps = parseInt(lines[i + 8]) || 0;
          const pushupPts = parseInt(lines[i + 9]) || 0;
          const runTimeStr = lines[i + 10];
          const runPts = parseInt(lines[i + 11]) || 0;
          
          console.log(`Soldier ${serialNum} data:`, { nric, name, age, training, tag, situpReps, situpPts, pushupReps, pushupPts, runTime: runTimeStr, runPts });
          
          // Parse run time (handle both MM:SS and MM.SS formats)
          let runTimeSeconds = 0;
          if (runTimeStr.includes(':')) {
            const [minutes, seconds] = runTimeStr.split(':').map(Number);
            runTimeSeconds = minutes * 60 + seconds;
          } else if (runTimeStr.includes('.')) {
            const [minutes, seconds] = runTimeStr.split('.').map(Number);
            runTimeSeconds = minutes * 60 + seconds;
          }
          
          // Use database scoring for all calculations
          const scoreResult = await calculateIpptScore(situpReps, pushupReps, runTimeSeconds, new Date());
          
          const finalSitupScore = situpPts || scoreResult.situpScore;
          const finalPushupScore = pushupPts || scoreResult.pushupScore;
          const finalRunScore = runPts || scoreResult.runScore;
          const totalScore = finalSitupScore + finalPushupScore + finalRunScore;
          
          let result = scoreResult.result; // Use calculated result
          
          entries.push({
            name: name.trim(),
            situps: situpReps,
            pushups: pushupReps,
            runTime: runTimeSeconds,
            situpScore: finalSitupScore,
            pushupScore: finalPushupScore,
            runScore: finalRunScore,
            totalScore,
            result
          });
          
          console.log(`Added soldier ${serialNum}: ${name}, Total: ${totalScore}, Result: ${result}`);
          
          i += 11; // Skip to next soldier
        }
      }
    }
    
    console.log(`Text-based fallback parsed ${entries.length} entries`);
    console.log('====================================');
    return entries;
  };

  // Find best name match using fuzzy matching
  const findBestNameMatch = (scannedName: string, users: any[]): any | null => {
    if (!users || users.length === 0) return null;
    
    const scannedLower = scannedName?.toLowerCase()?.trim() || '';
    
    // First try exact match
    const exactMatch = users.find(user => 
      user?.fullName?.toLowerCase() === scannedLower
    );
    if (exactMatch) return exactMatch;
    
    // Try partial match (contains)
    const partialMatch = users.find(user => 
      user?.fullName?.toLowerCase()?.includes(scannedLower) || 
      scannedLower?.includes(user?.fullName?.toLowerCase() || '')
    );
    if (partialMatch) return partialMatch;
    
    // Try word matching
    const scannedWords = scannedLower.split(' ');
    let bestMatch = null;
    let bestScore = 0;
    
    users.forEach(user => {
      if (!user?.fullName) return; // Skip users without fullName
      
      const userWords = user.fullName.toLowerCase().split(' ');
      let matchScore = 0;
      
      scannedWords.forEach((scannedWord: string) => {
        userWords.forEach((userWord: string) => {
          if (scannedWord === userWord) matchScore += 2;
          else if (scannedWord.includes(userWord) || userWord.includes(scannedWord)) matchScore += 1;
        });
      });
      
      if (matchScore > bestScore && matchScore >= 2) {
        bestScore = matchScore;
        bestMatch = user;
      }
    });
    
    return bestMatch;
  };

  // Function to show table confirmation popup
  const showTableConfirmationPopup = (parsedData: any[], azureResult: any) => {
    const tablePopup = document.createElement('div');
    
    // Get all users for name matching
    const allUsers = (commanderStats as any)?.troopers?.map((t: any) => t.user) || [];
    
    // Generate table HTML with searchable dropdowns for names and editable inputs
    const tableRows = parsedData.map((entry, index) => {
      const scannedName = entry.name;
      const matchedUser = findBestNameMatch(scannedName, allUsers);
      const isExactMatch = matchedUser && matchedUser?.fullName?.toLowerCase() === scannedName.toLowerCase();
      
      return `
        <tr class="hover:bg-muted/50 transition-colors">
          <td class="p-3 border border-border text-center font-medium">${index + 1}</td>
          <td class="p-3 border border-border">
            <div class="relative">
              <input type="text" 
                     id="name-search-${index}" 
                     class="w-full p-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     placeholder="Search user..."
                     value="${matchedUser ? matchedUser.fullName || 'Unknown User' : scannedName || 'Unknown'}"
                     data-scanned="${scannedName}">
              <div id="name-dropdown-${index}" class="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-32 overflow-y-auto z-50 hidden">
                ${allUsers
                  .map((user: any) => `<div class="px-3 py-2 hover:bg-muted cursor-pointer text-sm" data-user-id="${user.id}" data-user-name="${user.fullName || 'Unknown User'}" data-user-dob="${user.dob || ''}">${user.fullName || 'Unknown User'}</div>`)
                  .join('')
                }
              </div>
              ${!matchedUser ? 
                `<div class="text-xs text-amber-600 dark:text-amber-400 mt-1">Name not found in users</div>` : 
                isExactMatch ?
                `<div class="text-xs text-green-600 dark:text-green-400 mt-1">Exact match</div>` :
                `<div class="text-xs text-blue-600 dark:text-blue-400 mt-1">Auto-matched</div>`
              }
            </div>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="age-display-${index}" class="font-medium">
              ${matchedUser ? 
                Math.floor((new Date().getTime() - new Date(matchedUser.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
                'N/A'
              }
            </span>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="number" 
                     id="situps-${index}" 
                     class="w-full p-2 border border-border rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="${entry.situpReps}"
                     min="0" 
                     max="100"
                     data-index="${index}">
              <div id="situps-score-${index}" class="text-xs text-center font-bold text-foreground">${entry.situpScore} pts</div>
            </div>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="number" 
                     id="pushups-${index}" 
                     class="w-full p-2 border border-border rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="${entry.pushupReps}"
                     min="0" 
                     max="100"
                     data-index="${index}">
              <div id="pushups-score-${index}" class="text-xs text-center font-bold text-foreground">${entry.pushupScore} pts</div>
            </div>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="text" 
                     id="runtime-${index}" 
                     class="w-full p-2 border border-border rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="${Math.floor(parseRunTimeToSeconds(entry.runTime) / 60)}:${(parseRunTimeToSeconds(entry.runTime) % 60).toString().padStart(2, '0')}"
                     placeholder="MM:SS"
                     data-index="${index}">
              <div id="runtime-score-${index}" class="text-xs text-center font-bold text-foreground">${entry.runScore} pts</div>
            </div>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="total-score-${index}" class="font-bold text-lg ${entry.totalScore >= 85 ? 'text-yellow-600 dark:text-yellow-400' : entry.totalScore >= 75 ? 'text-gray-600 dark:text-gray-400' : entry.totalScore >= 51 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">${entry.totalScore}</span>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="result-badge-${index}" class="px-3 py-1 rounded-full text-xs font-bold transition-all
              ${entry.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 to-amber-300 text-yellow-900 shadow-md' : 
                entry.result === 'Silver' ? 'bg-gradient-to-r from-gray-400 to-slate-300 text-gray-900 shadow-md' :
                entry.result === 'Pass' ? 'bg-gradient-to-r from-green-400 to-emerald-300 text-green-900 shadow-md' :
                'bg-gradient-to-r from-red-400 to-rose-300 text-red-900 shadow-md'}">
              ${entry.result}
            </span>
          </td>
          <td class="p-3 border border-border text-center">
            <button id="delete-row-${index}" 
                    class="hover:bg-muted text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    data-index="${index}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    tablePopup.innerHTML = `
      <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                  bg-card border border-border rounded-lg shadow-lg 
                  max-w-[95vw] max-h-[95vh] overflow-auto z-[9999] p-5">
        <h3 class="text-lg font-semibold text-foreground mb-5 text-center">Extracted IPPT Data - Confirm</h3>
        
        <div class="mb-5 text-center">
          <p class="text-muted-foreground mb-2.5">Found ${parsedData.length} soldier(s) in the image</p>
        </div>
        
        <div class="overflow-x-auto mb-5">
          <table class="border-collapse w-full min-w-[900px] text-sm">
            <thead>
              <tr class="bg-gradient-to-r from-muted/50 to-muted border-b-2 border-border">
                <th class="p-3 border border-border text-center font-semibold">#</th>
                <th class="p-3 border border-border text-left font-semibold">Name</th>
                <th class="p-3 border border-border text-center font-semibold">Age</th>
                <th class="p-3 border border-border text-center font-semibold">Sit-ups</th>
                <th class="p-3 border border-border text-center font-semibold">Push-ups</th>
                <th class="p-3 border border-border text-center font-semibold">Run Time</th>
                <th class="p-3 border border-border text-center font-semibold">Total</th>
                <th class="p-3 border border-border text-center font-semibold">Result</th>
                <th class="p-3 border border-border text-center font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
        
        <div class="flex gap-3 justify-start flex-wrap mb-4">
          <button id="add-row" 
                  class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-semibold cursor-pointer transition-colors shadow text-sm flex items-center">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
        
        <div class="flex gap-3 justify-center flex-wrap">
          <button id="confirm-data" 
                  class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors shadow">
            Confirm
          </button>
          <button id="cancel-table" 
                  class="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors shadow">
            Cancel
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(tablePopup);
    
    // Add functionality for editable inputs and searchable dropdowns
    const setupEditableInputs = () => {
      // Store parsed data and all users for score calculation
      const entriesData: any[] = parsedData;
      
      // Setup name search functionality
      entriesData.forEach((entry, index) => {
        const nameInput = document.getElementById(`name-search-${index}`) as HTMLInputElement;
        const dropdown = document.getElementById(`name-dropdown-${index}`) as HTMLDivElement;
        
        if (nameInput && dropdown) {
          nameInput.addEventListener('input', (e) => {
            const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
            const dropdownItems = dropdown.querySelectorAll('div');
            
            dropdownItems.forEach(item => {
              const userName = item.getAttribute('data-user-name')?.toLowerCase() || '';
              if (userName.includes(searchTerm)) {
                item.style.display = 'block';
              } else {
                item.style.display = 'none';
              }
            });
            
            dropdown.classList.remove('hidden');
          });
          
          nameInput.addEventListener('focus', () => {
            dropdown.classList.remove('hidden');
          });
          
          // Handle dropdown item selection
          dropdown.addEventListener('click', (e) => {
            const target = e.target as HTMLDivElement;
            const userName = target.getAttribute('data-user-name');
            const userId = target.getAttribute('data-user-id');
            const userDob = target.getAttribute('data-user-dob');
            
            if (userName && userId) {
              nameInput.value = userName;
              nameInput.setAttribute('data-selected-user-id', userId);
              
              // Update age display
              const ageDisplay = document.getElementById(`age-display-${index}`);
              if (ageDisplay && userDob) {
                const age = Math.floor((new Date().getTime() - new Date(userDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                ageDisplay.textContent = age.toString();
              }
              
              // Recalculate scores with new user's DOB
              updateScoresForIndex(index);
            }
            
            dropdown.classList.add('hidden');
          });
        }
        
        // Setup input change listeners for live score updates
        const situpsInput = document.getElementById(`situps-${index}`) as HTMLInputElement;
        const pushupsInput = document.getElementById(`pushups-${index}`) as HTMLInputElement;
        const runtimeInput = document.getElementById(`runtime-${index}`) as HTMLInputElement;
        
        if (situpsInput) {
          situpsInput.addEventListener('input', () => updateScoresForIndex(index));
        }
        if (pushupsInput) {
          pushupsInput.addEventListener('input', () => updateScoresForIndex(index));
        }
        if (runtimeInput) {
          runtimeInput.addEventListener('input', () => updateScoresForIndex(index));
        }
        
        // Setup delete button
        const deleteButton = document.getElementById(`delete-row-${index}`) as HTMLButtonElement;
        if (deleteButton) {
          deleteButton.addEventListener('click', () => {
            // Remove from parsedData array
            entriesData.splice(index, 1);
            
            // Remove the row from DOM
            const row = deleteButton.closest('tr');
            if (row) {
              row.remove();
            }
            
            // Re-index all remaining rows
            reindexRows();
          });
        }
      });
    };
    
    // Function to re-index all rows after deletion
    const reindexRows = () => {
      const rows = tablePopup.querySelectorAll('tbody tr');
      rows.forEach((row, index) => {
        // Update row number
        const firstCell = row.querySelector('td:first-child');
        if (firstCell) {
          firstCell.textContent = (index + 1).toString();
        }
        
        // Update all element IDs to match new index
        const elementsToUpdate = [
          'name-search', 'name-dropdown', 'age-display',
          'situps', 'situps-score', 'pushups', 'pushups-score',
          'runtime', 'runtime-score', 'total-score', 'result-badge', 'delete-row'
        ];
        
        elementsToUpdate.forEach(elementId => {
          const element = row.querySelector(`[id^="${elementId}-"]`) as HTMLElement;
          if (element) {
            const oldId = element.id;
            const newId = `${elementId}-${index}`;
            element.id = newId;
            
            // Update data-index attributes
            if (element.hasAttribute('data-index')) {
              element.setAttribute('data-index', index.toString());
            }
          }
        });
      });
      
      // Re-setup event listeners for all rows
      setupEditableInputs();
    };
    
    // Function to update scores for a specific index
    const updateScoresForIndex = async (index: number) => {
      const nameInput = document.getElementById(`name-search-${index}`) as HTMLInputElement;
      const situpsInput = document.getElementById(`situps-${index}`) as HTMLInputElement;
      const pushupsInput = document.getElementById(`pushups-${index}`) as HTMLInputElement;
      const runtimeInput = document.getElementById(`runtime-${index}`) as HTMLInputElement;
      
      if (!nameInput || !situpsInput || !pushupsInput || !runtimeInput) return;
      
      // Find selected user
      const selectedUserId = nameInput.getAttribute('data-selected-user-id');
      const selectedUser = selectedUserId ? allUsers.find((u: any) => u.id === selectedUserId) : null;
      const userDob = selectedUser?.dob || new Date();
      
      // Get current values
      const situps = parseInt(situpsInput.value) || 0;
      const pushups = parseInt(pushupsInput.value) || 0;
      const runTimeStr = runtimeInput.value;
      
      // Parse run time
      let runTimeSeconds = 0;
      if (runTimeStr.includes(':')) {
        const [minutes, seconds] = runTimeStr.split(':').map(Number);
        runTimeSeconds = minutes * 60 + seconds;
      }
      
      try {
        // Calculate new scores
        const scoreResult = await calculateIpptScore(situps, pushups, runTimeSeconds, new Date(userDob));
        
        // Update score displays
        const situpsScoreEl = document.getElementById(`situps-score-${index}`);
        const pushupsScoreEl = document.getElementById(`pushups-score-${index}`);
        const runtimeScoreEl = document.getElementById(`runtime-score-${index}`);
        const totalScoreEl = document.getElementById(`total-score-${index}`);
        const resultBadgeEl = document.getElementById(`result-badge-${index}`);
        
        if (situpsScoreEl) situpsScoreEl.textContent = `${scoreResult.situpScore} pts`;
        if (pushupsScoreEl) pushupsScoreEl.textContent = `${scoreResult.pushupScore} pts`;
        if (runtimeScoreEl) runtimeScoreEl.textContent = `${scoreResult.runScore} pts`;
        if (totalScoreEl) {
          totalScoreEl.textContent = scoreResult.totalScore.toString();
          // Update color based on score
          totalScoreEl.className = `font-bold text-lg ${scoreResult.totalScore >= 85 ? 'text-yellow-600 dark:text-yellow-400' : scoreResult.totalScore >= 75 ? 'text-gray-600 dark:text-gray-400' : scoreResult.totalScore >= 51 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
        }
        if (resultBadgeEl) {
          resultBadgeEl.textContent = scoreResult.result;
          // Update badge styling
          const resultClass = scoreResult.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 to-amber-300 text-yellow-900 shadow-md' : 
                            scoreResult.result === 'Silver' ? 'bg-gradient-to-r from-gray-400 to-slate-300 text-gray-900 shadow-md' :
                            scoreResult.result === 'Pass' ? 'bg-gradient-to-r from-green-400 to-emerald-300 text-green-900 shadow-md' :
                            'bg-gradient-to-r from-red-400 to-rose-300 text-red-900 shadow-md';
          resultBadgeEl.className = `px-3 py-1 rounded-full text-xs font-bold transition-all ${resultClass}`;
        }
        
        // Update the entry data
        entriesData[index].situpReps = situps;
        entriesData[index].pushupReps = pushups;
        entriesData[index].runTime = runTimeStr;
        entriesData[index].situpScore = scoreResult.situpScore;
        entriesData[index].pushupScore = scoreResult.pushupScore;
        entriesData[index].runScore = scoreResult.runScore;
        entriesData[index].totalScore = scoreResult.totalScore;
        entriesData[index].result = scoreResult.result;
        
      } catch (error) {
        console.error('Error updating scores:', error);
      }
    };
    
    // Initialize the editable inputs
    setupEditableInputs();
    
    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        document.querySelectorAll('[id^="name-dropdown-"]').forEach(dropdown => {
          dropdown.classList.add('hidden');
        });
      }
    });
    
    // Handle button clicks
    document.getElementById('confirm-data')?.addEventListener('click', () => {
      // Collect selected users from dropdowns
      const entriesWithUsers = parsedData.map((entry, index) => {
        const selectElement = document.getElementById(`name-select-${index}`) as HTMLSelectElement;
        const selectedUserId = selectElement?.value;
        const selectedUser = selectedUserId ? allUsers.find(u => u.id === selectedUserId) : null;
        
        return {
          ...entry,
          userId: selectedUserId || null,
          user: selectedUser,
          originalScannedName: entry.name,
          finalName: selectedUser ? (selectedUser.fullName || selectedUser.username || 'Unknown User') : (entry.name || 'Unknown'),
          wasAutoMatched: selectedUserId && selectedUser?.fullName?.toLowerCase() !== entry.name?.toLowerCase()
        };
      });
      
      tablePopup.remove();
      
      // Store all entries with user mappings for bulk processing
      setDraftEntries(entriesWithUsers.map((entry, index) => ({
        id: Date.now().toString() + index,
        data: entry,
        timestamp: new Date()
      })));
      
      // Set first entry for current editing
      const firstEntry = entriesWithUsers[0];
      setScannedData(firstEntry);
      setEditingData({
        situps: firstEntry.situpReps,
        pushups: firstEntry.pushupReps,
        runTime: firstEntry.runTime
      });
      setScanStep('confirm');
      
      setIsScanning(false);
      console.log(`Confirmed ${parsedData.length} soldiers for processing`);
    });
    
    document.getElementById('cancel-table')?.addEventListener('click', () => {
      tablePopup.remove();
      setIsScanning(false);
      setScanProgress(0);
    });
    
    // Add Row functionality
    document.getElementById('add-row')?.addEventListener('click', () => {
      const newIndex = parsedData.length;
      const newRow = {
        name: '',
        situpReps: 0,
        pushupReps: 0,
        runTime: '10:00',
        situpScore: 0,
        pushupScore: 0,
        runScore: 0,
        totalScore: 0,
        result: 'Fail'
      };
      
      // Add to parsedData array
      parsedData.push(newRow);
      
      // Create new row HTML
      const newRowHtml = `
        <tr class="hover:bg-muted/50 transition-colors border-2 border-amber-400 bg-amber-50/50">
          <td class="p-3 border border-border text-center font-medium">${newIndex + 1}</td>
          <td class="p-3 border border-border">
            <div class="relative">
              <input type="text" 
                     id="name-search-${newIndex}" 
                     class="w-full p-2 border-2 border-amber-400 rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     placeholder="Search user..."
                     value=""
                     data-scanned="">
              <div id="name-dropdown-${newIndex}" class="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-32 overflow-y-auto z-50 hidden">
                ${allUsers
                  .map((user: any) => `<div class="px-3 py-2 hover:bg-muted cursor-pointer text-sm" data-user-id="${user.id}" data-user-name="${user.fullName || 'Unknown User'}" data-user-dob="${user.dob || ''}">${user.fullName || 'Unknown User'}</div>`)
                  .join('')
                }
              </div>
              <div class="text-xs text-amber-600 dark:text-amber-400 mt-1">New row - please fill data</div>
            </div>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="age-display-${newIndex}" class="font-medium">N/A</span>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="number" 
                     id="situps-${newIndex}" 
                     class="w-full p-2 border-2 border-amber-400 rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="0"
                     min="0" 
                     max="100"
                     data-index="${newIndex}">
              <div id="situps-score-${newIndex}" class="text-xs text-center font-bold text-blue-600 dark:text-blue-400">0 pts</div>
            </div>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="number" 
                     id="pushups-${newIndex}" 
                     class="w-full p-2 border-2 border-amber-400 rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="0"
                     min="0" 
                     max="100"
                     data-index="${newIndex}">
              <div id="pushups-score-${newIndex}" class="text-xs text-center font-bold text-green-600 dark:text-green-400">0 pts</div>
            </div>
          </td>
          <td class="p-3 border border-border">
            <div class="flex flex-col gap-1">
              <input type="text" 
                     id="runtime-${newIndex}" 
                     class="w-full p-2 border-2 border-amber-400 rounded-md bg-background text-foreground text-center font-medium focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                     value="10:00"
                     placeholder="MM:SS"
                     data-index="${newIndex}">
              <div id="runtime-score-${newIndex}" class="text-xs text-center font-bold text-purple-600 dark:text-purple-400">0 pts</div>
            </div>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="total-score-${newIndex}" class="font-bold text-lg text-red-600 dark:text-red-400">0</span>
          </td>
          <td class="p-3 border border-border text-center">
            <span id="result-badge-${newIndex}" class="px-3 py-1 rounded-full text-xs font-bold transition-all bg-gradient-to-r from-red-400 to-rose-300 text-red-900 shadow-md">
              Fail
            </span>
          </td>
          <td class="p-3 border border-border text-center">
            <button id="delete-row-${newIndex}" 
                    class="hover:bg-muted text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                    data-index="${newIndex}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>
      `;
      
      // Add row to table
      const tbody = tablePopup.querySelector('tbody');
      if (tbody) {
        tbody.insertAdjacentHTML('beforeend', newRowHtml);
      }
      
      // Setup event listeners for the new row
      setupEditableInputs();
    });
  };

  // API queries
  const { data: commanderStats, isLoading, error } = useQuery<IpptCommanderStats>({
    queryKey: ["/api/ippt/commander-stats"],
    enabled: !!user,
    retry: 2
  });

  // Always log when this query runs
  React.useEffect(() => {
    console.log('DEBUG FRONTEND: User state:', !!user, 'User ID:', user?.id);
    console.log('DEBUG FRONTEND: Commander stats query state:', { isLoading, error: !!error });
    if (error) {
      console.error('DEBUG FRONTEND: Full error object:', error);
      console.error('DEBUG FRONTEND: Error message:', (error as any).message);
      console.error('DEBUG FRONTEND: Error response:', (error as any).response?.data);
    }
    if (commanderStats) {
      console.log('DEBUG FRONTEND: Commander stats loaded successfully, troopers:', (commanderStats as any)?.troopers?.length);
    }
  }, [user, isLoading, error, commanderStats]);

  // Fetch conduct session data
  const { data: conductSessions, isLoading: conductLoading } = useQuery<IpptSession[]>({
    queryKey: ["/api/ippt/sessions"],
    enabled: !!user,
    retry: 2
  });

  // Define conduct options from database
  const conductOptions = conductSessions?.map((session: IpptSession) => session.name) || [];

  // Get current conduct session data
  const currentConductSession = conductSessions?.find((session: IpptSession) => session.name === selectedConduct);

  // Fetch IPPT attempts for current session
  const { data: sessionAttempts, isLoading: attemptsLoading } = useQuery<IpptSessionWithAttempts>({
    queryKey: ["/api/ippt/sessions", currentConductSession?.id, "details"],
    enabled: !!user && !!currentConductSession?.id,
  });

  // Filter conduct attempts based on search term
  const filteredConductAttempts = useMemo(() => {
    if (!conductSearchTerm || !sessionAttempts?.attempts) return sessionAttempts?.attempts || [];
    
    const lowerSearchTerm = conductSearchTerm.toLowerCase();
    return sessionAttempts.attempts.filter(attempt => 
      attempt.user?.fullName?.toLowerCase().includes(lowerSearchTerm) ||
      attempt.user?.rank?.toLowerCase().includes(lowerSearchTerm) ||
      (attempt.user as any).mspName?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [conductSearchTerm, sessionAttempts?.attempts]);

  // Set default conduct session when data loads
  useEffect(() => {
    if (conductSessions && conductSessions.length > 0 && !selectedConduct) {
      setSelectedConduct(conductSessions[0].name);
    }
  }, [conductSessions, selectedConduct]);

  // Toggle debug panel for a trooper
  const toggleDebugPanel = (trooperId: string) => {
    setDebugTrooperId(debugTrooperId === trooperId ? null : trooperId);
  };

  // Filter management functions
  const addFilterTag = (type: "msp" | "rank" | "status", value: string, label: string) => {
    const id = `${type}-${value}`;
    if (!filterTags.find(tag => tag.id === id)) {
      setFilterTags([...filterTags, { id, type, label, value }]);
    }
    setShowFilterPopover(false);
  };

  const removeFilterTag = (id: string) => {
    setFilterTags(filterTags.filter(tag => tag.id !== id));
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const queryClient = useQueryClient();

  // Eligibility mutations
  const updateEligibilityMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const response = await fetch(`/api/users/${userId}/eligibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update eligibility');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ippt/commander-stats"] });
      setEligibilityEditorOpen(false);
      setEditingTrooper(null);
    },
    onError: (error: any) => {
      alert(`Error saving eligibility: ${error.message}`);
      console.error('Eligibility update error:', error);
    }
  });

  // Eligibility Editor Handlers
  const openEligibilityEditor = (trooper: TrooperIpptSummary) => {
    console.log('=== Opening Eligibility Editor ===');
    console.log('Trooper:', trooper.user.fullName, 'ID:', trooper.user.id);
    
    setEditingTrooper(trooper);
    
    // Fetch existing eligibility data
    console.log('Fetching eligibility from:', `/api/users/${trooper.user.id}/eligibility`);
    fetch(`/api/users/${trooper.user.id}/eligibility`)
      .then(response => {
        console.log('Response status:', response.status);
        return response.json();
      })
      .then(eligibility => {
        console.log('Eligibility data received:', eligibility);
        if (eligibility) {
          // Load existing eligibility data
          const formData = {
            isEligible: eligibility.isEligible === "true",
            reason: eligibility.reason || '',
            ineligibilityType: (eligibility.ineligibilityType || 'indefinite') as "indefinite" | "until_date",
            untilDate: eligibility.untilDate || ''
          };
          console.log('Setting form data:', formData);
          setEligibilityForm(formData);
        } else {
          // Default to eligible if no record exists
          const defaultData = {
            isEligible: true,
            reason: '',
            ineligibilityType: 'indefinite' as "indefinite" | "until_date",
            untilDate: ''
          };
          console.log('No existing data, using defaults:', defaultData);
          setEligibilityForm(defaultData);
        }
      })
      .catch(error => {
        console.error('Error fetching eligibility:', error);
        // Default to eligible on error
        const errorData = {
          isEligible: true,
          reason: '',
          ineligibilityType: 'indefinite' as "indefinite" | "until_date",
          untilDate: ''
        };
        console.log('Error occurred, using defaults:', errorData);
        setEligibilityForm(errorData);
      });
    
    setEligibilityEditorOpen(true);
  };

  const closeEligibilityEditor = () => {
    setEligibilityEditorOpen(false);
    setEditingTrooper(null);
    setEligibilityForm({
      isEligible: true,
      reason: '',
      ineligibilityType: 'indefinite',
      untilDate: ''
    });
  };

  const saveEligibility = () => {
    console.log('=== Saving Eligibility ===');
    console.log('Current editing trooper:', editingTrooper?.user.fullName);
    console.log('Current form state:', eligibilityForm);
    
    if (!editingTrooper) {
      console.error('No editing trooper found!');
      return;
    }
    
    // Debug logging
    console.log('Saving eligibility for:', editingTrooper.user.fullName);
    console.log('Form data:', eligibilityForm);
    
    // Validation
    if (!eligibilityForm.isEligible) {
      if (!eligibilityForm.reason.trim()) {
        console.log('Validation failed: Reason is required');
        alert('Reason is required when setting eligibility to Not Eligible');
        return;
      }
      if (eligibilityForm.ineligibilityType === 'until_date' && !eligibilityForm.untilDate) {
        console.log('Validation failed: Until date is required');
        alert('Until date is required when ineligibility type is Until Date');
        return;
      }
    }
    
    const dataToSend = {
      isEligible: eligibilityForm.isEligible,
      reason: eligibilityForm.reason,
      ineligibilityType: eligibilityForm.ineligibilityType,
      untilDate: eligibilityForm.untilDate || null
    };
    
    console.log('Data being sent:', dataToSend);
    console.log('API endpoint:', `/api/users/${editingTrooper.user.id}/eligibility`);
    
    updateEligibilityMutation.mutate({
      userId: editingTrooper.user.id,
      data: dataToSend
    });
  };

  // Calculate leaderboard data from actual database
  const calculateLeaderboardData = () => {
    if (!(commanderStats as any)?.troopers) return {
      topScores: [],
      mostPushUps: [],
      mostSitUps: [],
      fastestRuns: []
    };

    // Filter personnel based on selected group
    const filteredTroopers = (commanderStats as any).troopers.filter((trooper: any) => {
      const mspName = (trooper.user as any).mspName || '';
      
      if (selectedGroup === 'MSC Overall') {
        return true; // Include everyone
      } else if (selectedGroup === 'MSC Commanders') {
        return trooper.user.rank?.includes('Commander') || trooper.user.rank?.includes('Captain');
      } else if (selectedGroup === 'MSC Troopers') {
        return !trooper.user.rank?.includes('Commander') && !trooper.user.rank?.includes('Captain');
      } else {
        return mspName === selectedGroup;
      }
    });

    // Get all IPPT attempts (deduplicated)
    const allAttempts = filteredTroopers.flatMap(trooper => {
      const combinedAttempts = (trooper.yearOneAttempts || []).concat(trooper.yearTwoAttempts || []);
      // Deduplicate by ID
      return combinedAttempts.filter((attempt: any, index: number, self: any[]) => 
        attempt && attempt.totalScore > 0 && index === self.findIndex((a: any) => a.id === attempt.id)
      );
    });

    // Top Scores (highest total score)
    const topScores = allAttempts
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        score: attempt.totalScore
      }));

    // Most Push Ups
    const mostPushUps = allAttempts
      .sort((a, b) => b.pushupReps - a.pushupReps)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        reps: attempt.pushupReps
      }));

    // Most Sit Ups
    const mostSitUps = allAttempts
      .sort((a, b) => b.situpReps - a.situpReps)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        reps: attempt.situpReps
      }));

    // Fastest Runs (lowest time, exclude invalid times)
    const fastestRuns = allAttempts
      .filter((attempt: any) => {
        if (!attempt || !attempt.runTime) return false;
        // Filter out 0:00, 00:00, and other invalid times
        const timeInSeconds = attempt.runTime.split(':').reduce((acc: number, part: string) => acc * 60 + parseInt(part), 0);
        return timeInSeconds > 0;
      })
      .sort((a, b) => {
        // Convert MM:SS to seconds for comparison
        const timeToSeconds = (time: string) => {
          const [minutes, seconds] = time.split(':').map(Number);
          return minutes * 60 + seconds;
        };
        return timeToSeconds(a.runTime) - timeToSeconds(b.runTime);
      })
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        time: attempt.runTime // Use the runTime directly from the database
      }));

    // Score Improvement (calculate difference between earliest and latest attempts)
    const scoreImprovements = filteredTroopers
      .map(trooper => {
        const allTrooperAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ].filter(attempt => attempt && attempt.totalScore > 0)
        .sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestScore = allTrooperAttempts[0].totalScore;
        const latestScore = allTrooperAttempts[allTrooperAttempts.length - 1].totalScore;
        const improvement = latestScore - earliestScore;

        return {
          name: trooper.user.fullName || 'Unknown',
          improvement: improvement
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        improvement: `+${item.improvement}`
      }));

    // Push Ups Improvement (calculate difference between earliest and latest attempts)
    const pushUpsImprovements = filteredTroopers
      .map(trooper => {
        const allTrooperAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ].filter(attempt => attempt && attempt.pushupReps > 0)
        .sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestPushUps = allTrooperAttempts[0].pushupReps;
        const latestPushUps = allTrooperAttempts[allTrooperAttempts.length - 1].pushupReps;
        const improvement = latestPushUps - earliestPushUps;

        return {
          name: trooper.user.fullName || 'Unknown',
          improvement: improvement
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        improvement: `+${item.improvement}`
      }));

    // Sit Ups Improvement (calculate difference between earliest and latest attempts)
    const sitUpsImprovements = filteredTroopers
      .map(trooper => {
        const allTrooperAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ].filter(attempt => attempt && attempt.situpReps > 0)
        .sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestSitUps = allTrooperAttempts[0].situpReps;
        const latestSitUps = allTrooperAttempts[allTrooperAttempts.length - 1].situpReps;
        const improvement = latestSitUps - earliestSitUps;

        return {
          name: trooper.user.fullName || 'Unknown',
          improvement: improvement
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        improvement: `+${item.improvement}`
      }));

    // Run Improvement (calculate time reduction between earliest and latest attempts)
    const runImprovements = filteredTroopers
      .map(trooper => {
        // Deduplicate attempts first (for regulars)
        const combinedAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ];
        const uniqueAttempts = combinedAttempts.filter((attempt: any, index: number, self: any[]) => 
          attempt && attempt.runTime && index === self.findIndex((a: any) => a.id === attempt.id)
        );
        
        // Filter valid run times and sort by date
        const validAttempts = uniqueAttempts
          .filter((attempt: any) => {
            const timeInSeconds = attempt.runTime.split(':').reduce((acc: number, part: string) => acc * 60 + parseInt(part), 0);
            return timeInSeconds > 0;
          })
          .sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());

        if (validAttempts.length < 2) return null;

        // Use direct runTime parsing instead of parseRunTimeToSeconds
        const timeToSeconds = (time: string) => {
          const [minutes, seconds] = time.split(':').map(Number);
          return minutes * 60 + seconds;
        };
        
        const earliestTime = timeToSeconds(validAttempts[0].runTime);
        const latestTime = timeToSeconds(validAttempts[validAttempts.length - 1].runTime);
        const improvement = earliestTime - latestTime; // Positive improvement means faster (less time)

        return {
          name: trooper.user.fullName || 'Unknown',
          improvement: improvement
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        improvement: `${Math.floor(item.improvement / 60)}:${(item.improvement % 60).toString().padStart(2, '0')}`
      }));

    return {
      topScores,
      mostPushUps,
      mostSitUps,
      fastestRuns,
      scoreImprovements,
      pushUpsImprovements,
      sitUpsImprovements,
      runImprovements
    };
  };

  // Filter personnel based on search term and filter tags
  const filteredPersonnel = useMemo(() => {
    if (!(commanderStats as any)?.troopers) return [];
    
    return (commanderStats as any).troopers.filter((trooper: any) => {
      // Search term matching
      const matchesSearch = searchTerm === "" || 
        trooper.user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trooper.user.rank?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trooper.user as any).mspName?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter tag matching
      const mspTags = filterTags.filter(t => t.type === "msp");
      const rankTags = filterTags.filter(t => t.type === "rank");
      const statusTags = filterTags.filter(t => t.type === "status");

      const matchesMsp = mspTags.length === 0 || mspTags.some(tag => 
        (trooper.user as any).mspName === tag.value
      );

      const matchesRank = rankTags.length === 0 || rankTags.some(tag => 
        trooper.user.rank === tag.value
      );

      const matchesStatus = statusTags.length === 0 || statusTags.some(tag => {
        if (tag.value === "Completed") {
          return trooper.bestAttempt && ['Gold', 'Silver', 'Pass'].includes(trooper.bestAttempt.result);
        } else if (tag.value === "Pending") {
          return !trooper.bestAttempt;
        } else if (tag.value === "Regular") {
          const days = trooper.user.doe ? Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          return days > 730;
        }
        return false;
      });

      return matchesSearch && matchesMsp && matchesRank && matchesStatus;
    }).sort((a, b) => {
      // Sort by MSP first (HQ comes first, then MSP 1-5)
    const aMsp = (a.user as any).mspName || '';
    const bMsp = (b.user as any).mspName || '';
    
    // HQ comes first
    if (aMsp === 'HQ' && bMsp !== 'HQ') return -1;
    if (bMsp === 'HQ' && aMsp !== 'HQ') return 1;
    
    // Then sort by MSP number
    const aMspNum = aMsp.replace('MSP ', '');
    const bMspNum = bMsp.replace('MSP ', '');
    const mspCompare = aMspNum.localeCompare(bMspNum, undefined, { numeric: true });
    
    if (mspCompare !== 0) return mspCompare;
    
    // Then sort by rank (matching admin users sorting)
    const rankOrder = [
      // Officers
      'CPT', '2LT',
      // Warrant Officers
      '1WO', '2WO', '3WO',
      // Specialists
      '1SG', '2SG', '3SG',
      // Enlisted
      'LCP', 'PTE'
    ];
    const aRankIndex = rankOrder.indexOf(a.user.rank || '');
    const bRankIndex = rankOrder.indexOf(b.user.rank || '');
    
    // If rank not found in order, put it at the end
    const aFinalRank = aRankIndex === -1 ? 999 : aRankIndex;
    const bFinalRank = bRankIndex === -1 ? 999 : bRankIndex;
    
    return aFinalRank - bFinalRank;
    });
  }, [(commanderStats as any)?.troopers, searchTerm, filterTags]) || [];

  // Function to get group-specific statistics
  const getGroupStats = (groupName: string): GroupStatistics => {
    let groupTroopers = (commanderStats as any)?.troopers || [];
    
    if (groupName === "MSC Overall") {
      // All personnel
    } else if (groupName === "MSC Commanders") {
      // Only commanders
      groupTroopers = groupTroopers.filter(t => t.user.role === "commander");
    } else if (groupName === "MSC Troopers") {
      // Only soldiers (non-commanders)
      groupTroopers = groupTroopers.filter(t => t.user.role !== "commander");
    } else if (groupName.startsWith("MSP ")) {
      // Specific MSP
      const mspName = groupName;
      groupTroopers = groupTroopers.filter(t => (t.user as any).mspName === mspName);
    }

    // Calculate breakdowns
    const bestBreakdown = {
      total: groupTroopers.filter((trooper: any) => trooper.isEligible !== false).length, // Count only eligible
      gold: 0,
      silver: 0,
      pass: 0,
      fail: 0,
      ytt: 0
    };

    const initialBreakdown = {
      total: groupTroopers.filter((trooper: any) => trooper.isEligible !== false).length, // Count only eligible
      gold: 0,
      silver: 0,
      pass: 0,
      fail: 0,
      ytt: 0
    };

    let totalSitups = 0;
    let totalPushups = 0;
    let totalRunSeconds = 0;
    let totalScore = 0;
    let countWithScores = 0;

    groupTroopers.forEach(trooper => {
      // Best results
      const bestResult = trooper.bestAttempt?.result || "YTT";
      if (bestResult === "Gold") bestBreakdown.gold++;
      else if (bestResult === "Silver") bestBreakdown.silver++;
      else if (bestResult === "Pass") bestBreakdown.pass++;
      else if (bestResult === "Fail") bestBreakdown.fail++;
      else bestBreakdown.ytt++;

      // Initial results
      const initialResult = trooper.initialAttempt?.result || "YTT";
      if (initialResult === "Gold") initialBreakdown.gold++;
      else if (initialResult === "Silver") initialBreakdown.silver++;
      else if (initialResult === "Pass") initialBreakdown.pass++;
      else if (initialResult === "Fail") initialBreakdown.fail++;
      else initialBreakdown.ytt++;

      // Average scores
      if (trooper.bestAttempt) {
        totalSitups += trooper.bestAttempt.situpReps || 0;
        totalPushups += trooper.bestAttempt.pushupReps || 0;
        totalRunSeconds += parseRunTimeToSeconds(trooper.bestAttempt.runTime) || 0;
        totalScore += trooper.bestAttempt.totalScore || 0;
        countWithScores++;
      }
    });

    // Calculate improvement rates
    const improvementRates = {
      gold: initialBreakdown.gold > 0 ? Math.round(((bestBreakdown.gold - initialBreakdown.gold) / initialBreakdown.gold) * 100) : 0,
      silver: initialBreakdown.silver > 0 ? Math.round(((bestBreakdown.silver - initialBreakdown.silver) / initialBreakdown.silver) * 100) : 0,
      pass: initialBreakdown.pass > 0 ? Math.round(((bestBreakdown.pass - initialBreakdown.pass) / initialBreakdown.pass) * 100) : 0,
      fail: initialBreakdown.fail > 0 ? Math.round(((bestBreakdown.fail - initialBreakdown.fail) / initialBreakdown.fail) * 100) : 0
    };

    // Average scores
    const avgSitups = countWithScores > 0 ? Math.round(totalSitups / countWithScores) : 0;
    const avgPushups = countWithScores > 0 ? Math.round(totalPushups / countWithScores) : 0;
    const avgRunSeconds = countWithScores > 0 ? Math.round(totalRunSeconds / countWithScores) : 0;
    const avgScore = countWithScores > 0 ? Math.round(totalScore / countWithScores) : 0;
    
    // Format run time
    const minutes = Math.floor(avgRunSeconds / 60);
    const seconds = avgRunSeconds % 60;
    const formattedRunTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      bestBreakdown,
      initialBreakdown,
      improvementRates,
      averageScores: {
        situps: avgSitups,
        pushups: avgPushups,
        runTime: formattedRunTime,
        score: avgScore
      }
    };
  };

  // Get current group stats
  const currentGroupStats = getGroupStats(selectedGroup);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {user && <Navbar user={user} />}
        <div className="flex items-center justify-center pt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading IPPT data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {user && <Navbar user={user} />}
        <div className="flex items-center justify-center pt-20">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading IPPT data</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {user && <Navbar user={user} pageTitle="IPPT Dashboard" />}
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">IPPT Tracker</h1>
            <p className="text-sm md:text-lg text-muted-foreground mt-1 md:mt-2">
              {viewMode === 'stats' ? 'Monitor and analyze IPPT statistics according to group' :
               viewMode === 'leaderboard' ? 'View top performers and rankings according to group' :
               viewMode === 'conduct' ? 'View conduct participants and IPPT scores by session' :
               viewMode === 'scores' ? 'Click on any personnel to view detailed IPPT records and eligibility information' :
               'Manage IPPT data and personnel records'}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="mb-6 md:mb-8 md:max-w-none">
            {/* View Toggle - Always visible */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                {/* Tab Navigation */}
                <div className="w-full">
                  <div role="tablist" aria-orientation="horizontal" className="flex gap-1 border-b border-border w-full md:w-fit overflow-x-auto justify-center md:justify-start">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'stats'}
                      aria-controls={`tabpanel-${viewMode}`}
                      data-index="0"
                      onClick={() => setViewMode('stats')}
                      className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap touch-manipulation text-center ${
                        viewMode === 'stats'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Statistics
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'leaderboard'}
                      aria-controls={`tabpanel-${viewMode}`}
                      data-index="1"
                      onClick={() => setViewMode('leaderboard')}
                      className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap touch-manipulation text-center ${
                        viewMode === 'leaderboard'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Leaderboard
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'conduct'}
                      aria-controls={`tabpanel-${viewMode}`}
                      data-index="2"
                      onClick={() => setViewMode('conduct')}
                      className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap touch-manipulation text-center ${
                        viewMode === 'conduct'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Conduct
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'scores'}
                      aria-controls={`tabpanel-${viewMode}`}
                      data-index="3"
                      onClick={() => setViewMode('scores')}
                      className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap touch-manipulation text-center ${
                        viewMode === 'scores'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Individual
                    </button>
                  </div>
                </div>
                
                {/* Additional controls */}
                <div className="w-full sm:w-auto">
                  {/* Group Selector - Only show for stats and leaderboard views */}
                  {(viewMode === 'stats' || viewMode === 'leaderboard') && (
                    <>
                      <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger id="group-select" className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {dashboardGroups.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  
                  {/* Conduct Selector - Only show for conduct view */}
                  {viewMode === 'conduct' && (
                    <div className="flex gap-2">
                      <Select value={selectedConduct} onValueChange={setSelectedConduct}>
                        <SelectTrigger id="conduct-select" className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Select conduct" />
                        </SelectTrigger>
                        <SelectContent>
                          {conductOptions.map((conduct) => (
                            <SelectItem key={conduct} value={conduct}>
                              {conduct}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => setScanModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  )}
                  
                  {/* Search - Only show for individual view */}
                  {viewMode === 'scores' && (
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="personnel-search"
                            placeholder="Search by name or type filter (e.g., MSP 1, CPT, Completed)..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Filter className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="end">
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm font-medium mb-2">Platoon</p>
                                <div className="space-y-1">
                                  {dashboardGroups.filter(group => group.startsWith("MSP")).map(msp => (
                                    <Button
                                      key={msp}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addFilterTag("msp", msp, msp)}
                                      className="w-full justify-start"
                                    >
                                      {msp}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium mb-2">Rank</p>
                                <div className="space-y-1">
                                  {['CPT', '2LT', '1WO', '2WO', '3WO', '1SG', '2SG', '3SG', 'LCP', 'PTE'].map(rank => (
                                    <Button
                                      key={rank}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addFilterTag("rank", rank, rank)}
                                      className="w-full justify-start"
                                    >
                                      {rank}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium mb-2">Status</p>
                                <div className="space-y-1">
                                  {['Completed', 'Pending', 'Regular'].map(status => (
                                    <Button
                                      key={status}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => addFilterTag("status", status, status)}
                                      className="w-full justify-start"
                                    >
                                      {status}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Dashboard Content */}
          {viewMode === 'stats' ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6 md:mb-8">
            {/* Best Result Table */}
            <Card className="shadow-lg border-0 overflow-hidden h-full">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-3 sm:p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white text-center">
                  Best Result
                </h2>
              </div>
              <div className="p-3 sm:p-4 md:p-6 bg-card flex flex-col h-full">
                <div className="space-y-1 md:space-y-1 flex-1">
                  {[
                    { label: 'Total Eligible', value: currentGroupStats.bestBreakdown.total, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Gold', value: currentGroupStats.bestBreakdown.gold, color: 'bg-yellow-100 text-yellow-800' },
                    { label: 'Silver', value: currentGroupStats.bestBreakdown.silver, color: 'bg-gray-100 text-gray-800' },
                    { label: 'Pass', value: currentGroupStats.bestBreakdown.pass, color: 'bg-green-100 text-green-800' },
                    { label: 'Fail', value: currentGroupStats.bestBreakdown.fail, color: 'bg-red-100 text-red-800' },
                    { label: 'YTT', value: currentGroupStats.bestBreakdown.ytt, color: 'bg-purple-100 text-purple-800' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <span className="font-medium text-sm md:text-base text-foreground">{item.label}</span>
                      <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-bold ${item.color}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Pie Chart */}
            <Card className="shadow-lg border-0 overflow-hidden h-full">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-3 sm:p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-white text-center">
                  Result Distribution
                </h2>
              </div>
              <div className="p-3 sm:p-4 md:p-6 bg-card flex flex-col h-full">
                <div className="space-y-1 md:space-y-1 flex-1">
                  <div className="flex items-center justify-center" style={{ minHeight: '200px' }}>
                    <canvas 
                    key={themeKey}
                    ref={(canvas) => {
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          // Fixed sizing to prevent shrinking loop
                          const size = 300;
                          
                          canvas.width = size * 2;
                          canvas.height = size * 2;
                          canvas.style.width = size + 'px';
                          canvas.style.height = size + 'px';
                          
                          ctx.scale(2, 2);
                          
                          ctx.clearRect(0, 0, size, size);
                          const centerX = size / 2;
                          const centerY = size / 2;
                          const radius = size * 0.35;
                          const total = currentGroupStats.bestBreakdown.total || 1;

                          // Enable crisp rendering and add shadow
                          ctx.imageSmoothingEnabled = true;
                          ctx.imageSmoothingQuality = 'high';
                          
                          // Add shadow effect
                          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                          ctx.shadowBlur = 10;
                          ctx.shadowOffsetX = 3;
                          ctx.shadowOffsetY = 3;

                          const segments = [
                            { label: 'Gold', value: currentGroupStats.bestBreakdown.gold, color: '#FFD700' },
                            { label: 'Silver', value: currentGroupStats.bestBreakdown.silver, color: '#C0C0C0' },
                            { label: 'Pass', value: currentGroupStats.bestBreakdown.pass, color: '#4CAF50' },
                            { label: 'Fail', value: currentGroupStats.bestBreakdown.fail, color: '#F44336' },
                            { label: 'YTT', value: currentGroupStats.bestBreakdown.ytt, color: '#9C27B0' }
                          ];

                          let currentAngle = -Math.PI / 2;

                          segments.forEach(segment => {
                            if (segment.value > 0) {
                              const sliceAngle = (segment.value / total) * 2 * Math.PI;
                              
                              // Draw pie slice with enhanced styling
                              ctx.beginPath();
                              ctx.moveTo(centerX, centerY);
                              ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                              ctx.closePath();
                              
                              // Fill with gradient effect
                              ctx.fillStyle = segment.color;
                              ctx.fill();
                              
                              // Enhanced border styling
                              ctx.strokeStyle = '#ffffff';
                              ctx.lineWidth = 3;
                              ctx.stroke();
                              
                              // Reset shadow for labels
                              ctx.shadowColor = 'transparent';
                              ctx.shadowBlur = 0;
                              ctx.shadowOffsetX = 0;
                              ctx.shadowOffsetY = 0;

                              // Draw label outside the slice
                              const labelAngle = currentAngle + sliceAngle / 2;
                              const labelX = centerX + Math.cos(labelAngle) * (radius + (size < 300 ? 20 : 30));
                              const labelY = centerY + Math.sin(labelAngle) * (radius + (size < 300 ? 20 : 30));
                              
                              const percentage = Math.round((segment.value / total) * 100);
                              
                              // Draw label text
                              // Label text - black in light mode, white in dark mode
                              const isDarkMode = document.body.classList.contains('dark') || 
                                               document.documentElement.classList.contains('dark');
                              ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
                              ctx.font = `bold ${size < 300 ? 9 : 13}px Arial`;
                              ctx.textAlign = 'center';
                              ctx.textBaseline = 'middle';
                              ctx.fillText(`${segment.label}`, labelX, labelY - 3);
                              ctx.font = `bold ${size < 300 ? 11 : 15}px Arial`;
                              ctx.fillText(`${percentage}%`, labelX, labelY + 8);

                              currentAngle += sliceAngle;
                            }
                          });
                        }
                      }
                    }}
                    className="drop-shadow-lg max-w-full h-auto"
                  />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                  {[
                    { label: 'Gold', color: '#FFD700' },
                    { label: 'Silver', color: '#C0C0C0' },
                    { label: 'Pass', color: '#4CAF50' },
                    { label: 'Fail', color: '#F44336' },
                    { label: 'YTT', color: '#9C27B0' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-1 md:gap-2 px-2 py-1 rounded-full bg-muted/50">
                      <span className="w-2 h-2 md:w-3 md:h-3 rounded-full border-2 border-white/20" style={{ backgroundColor: item.color }}></span>
                      <span className="text-xs md:text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Three Statistical Tables - Only show in stats view */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:p-4 md:gap-6">
            {/* Initial Result Table */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-3 md:p-3 sm:p-4">
                <h3 className="text-sm md:text-lg font-bold text-black text-center">
                  Initial Result
                </h3>
              </div>
              <div className="p-3 md:p-3 sm:p-4 bg-card">
                <div className="space-y-1 md:space-y-1">
                  {[
                    { label: 'Total Eligible', value: currentGroupStats.initialBreakdown.total },
                    { label: 'Gold', value: currentGroupStats.initialBreakdown.gold },
                    { label: 'Silver', value: currentGroupStats.initialBreakdown.silver },
                    { label: 'Pass', value: currentGroupStats.initialBreakdown.pass },
                    { label: 'Fail', value: currentGroupStats.initialBreakdown.fail }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="font-medium text-xs md:text-sm text-foreground">{item.label}</span>
                      <span className="font-bold text-sm md:text-lg text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Improvement Rate Table */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 p-3 md:p-3 sm:p-4">
                <h3 className="text-sm md:text-lg font-bold text-white text-center">
                  Improvement Rate
                </h3>
              </div>
              <div className="p-3 md:p-3 sm:p-4 bg-card">
                <div className="space-y-1 md:space-y-1">
                  {[
                    { label: 'Gold', value: currentGroupStats.improvementRates.gold, positive: currentGroupStats.improvementRates.gold > 0 },
                    { label: 'Silver', value: currentGroupStats.improvementRates.silver, positive: currentGroupStats.improvementRates.silver > 0 },
                    { label: 'Pass', value: currentGroupStats.improvementRates.pass, positive: currentGroupStats.improvementRates.pass > 0 },
                    { label: 'Fail', value: currentGroupStats.improvementRates.fail, positive: currentGroupStats.improvementRates.fail < 0 }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="font-medium text-xs md:text-sm text-foreground">{item.label}</span>
                      <span className={`font-bold text-sm md:text-lg ${item.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {item.value > 0 ? '+' : ''}{item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Average Scores Table */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 md:p-3 sm:p-4">
                <h3 className="text-sm md:text-lg font-bold text-white text-center">
                  Average Scores
                </h3>
              </div>
              <div className="p-3 md:p-3 sm:p-4 bg-card">
                <div className="space-y-1 md:space-y-1">
                  {[
                    { label: 'Sit-Up Reps', value: currentGroupStats.averageScores.situpReps, unit: 'reps' },
                    { label: 'Push-Up Reps', value: currentGroupStats.averageScores.pushupReps, unit: 'reps' },
                    { label: 'Run Timing', value: currentGroupStats.averageScores.runTime, unit: '' },
                    { label: 'Score', value: currentGroupStats.averageScores.score, unit: 'pts' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="font-medium text-xs md:text-sm text-foreground">{item.label}</span>
                      <span className="font-bold text-sm md:text-lg text-foreground">
                        {item.value}{item.unit && <span className="text-xs md:text-sm text-muted-foreground ml-1">{item.unit}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
            </>
          ) : viewMode === 'leaderboard' ? (
            <div className="space-y-6 md:space-y-8 mb-6 md:mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:p-4 md:gap-6">
                {/* Top Score */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Top Score</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData().topScores.length > 0 ? (
                        calculateLeaderboardData().topScores.map((person) => (
                          <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                                #{person.rank}
                              </span>
                              <span className="text-xs md:text-sm font-medium">{person.name}</span>
                            </div>
                            <span className="text-xs md:text-sm font-bold text-foreground">{person.score}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Most Push Ups */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Most Push Ups</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData().mostPushUps.length > 0 ? (
                        calculateLeaderboardData().mostPushUps.map((person) => (
                          <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                                #{person.rank}
                              </span>
                              <span className="text-xs md:text-sm font-medium">{person.name}</span>
                            </div>
                            <span className="text-xs md:text-sm font-bold text-foreground">{person.reps}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Most Sit Ups */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Most Sit Ups</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData().mostSitUps.length > 0 ? (
                        calculateLeaderboardData().mostSitUps.map((person) => (
                          <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                                #{person.rank}
                              </span>
                              <span className="text-xs md:text-sm font-medium">{person.name}</span>
                            </div>
                            <span className="text-xs md:text-sm font-bold text-foreground">{person.reps}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Fastest Run */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Fastest Run</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData().fastestRuns.length > 0 ? (
                        calculateLeaderboardData().fastestRuns.map((person) => (
                          <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                                #{person.rank}
                              </span>
                              <span className="text-xs md:text-sm font-medium">{person.name}</span>
                            </div>
                            <span className="text-xs md:text-sm font-bold text-foreground">{person.time}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:p-4 md:gap-6">
                {/* Score Improvement */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Score Improvement</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData()?.scoreImprovements?.length ? (
                        calculateLeaderboardData()?.scoreImprovements?.map((person) => (
                        <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                              #{person.rank}
                            </span>
                            <span className="text-xs md:text-sm font-medium">{person.name}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-green-600">{person.improvement}</span>
                        </div>
                      ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Push Ups Improvement */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Push Ups Improvement</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData()?.pushUpsImprovements?.length ? (
                        calculateLeaderboardData()?.pushUpsImprovements?.map((person) => (
                        <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                              #{person.rank}
                            </span>
                            <span className="text-xs md:text-sm font-medium">{person.name}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-green-600">{person.improvement}</span>
                        </div>
                      ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Sit Ups Improvement */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Sit Ups Improvement</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData()?.sitUpsImprovements?.length ? (
                        calculateLeaderboardData()?.sitUpsImprovements?.map((person) => (
                        <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                              #{person.rank}
                            </span>
                            <span className="text-xs md:text-sm font-medium">{person.name}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-green-600">{person.improvement}</span>
                        </div>
                      ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Run Timing Improvement */}
                <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 md:p-3 sm:p-4">
                    <h3 className="text-sm md:text-base font-bold text-white text-center">Run Improvement</h3>
                  </div>
                  <div className="p-3 md:p-3 sm:p-4 bg-card">
                    <div className="space-y-1">
                      {calculateLeaderboardData()?.runImprovements?.length ? (
                        calculateLeaderboardData()?.runImprovements?.map((person) => (
                        <div key={person.rank} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-xs ${person.rank === 1 ? 'text-yellow-500' : person.rank === 2 ? 'text-gray-400' : 'text-orange-600'}`}>
                              #{person.rank}
                            </span>
                            <span className="text-xs md:text-sm font-medium">{person.name}</span>
                          </div>
                          <span className="text-xs md:text-sm font-bold text-green-600">{person.improvement}</span>
                        </div>
                      ))
                      ) : (
                        <div className="text-center text-muted-foreground text-xs py-4">
                          No data available
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {/* Conduct Details View */}
          {viewMode === 'conduct' && (
            <div className="space-y-6 md:space-y-8">
              <Card className="shadow-lg border-0 overflow-hidden">
                <div className="bg-muted/80 border-b border-border p-3 sm:p-4 md:p-6">
                  <h2 className="text-lg md:text-xl font-semibold text-foreground text-center">Conduct Details</h2>
                  <p className="text-muted-foreground text-center mt-2">{selectedConduct}</p>
                </div>
                <div className="p-3 sm:p-4 md:p-6">
                  {/* Search for Conduct View */}
                  <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="conduct-search"
                        placeholder="Search by name or type filter (e.g., MSP 1, CPT, Completed)..."
                        value={conductSearchTerm}
                        onChange={(e) => setConductSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Popover open={showFilterPopover} onOpenChange={setShowFilterPopover}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Filter className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium mb-2">Platoon</p>
                            <div className="space-y-1">
                              {dashboardGroups.filter(group => group.startsWith("MSP")).map(msp => (
                                <Button
                                  key={msp}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addFilterTag("msp", msp, msp)}
                                  className="w-full justify-start"
                                >
                                  {msp}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Rank</p>
                            <div className="space-y-1">
                              {['CPT', '2LT', '1WO', '2WO', '3WO', '1SG', '2SG', '3SG', 'LCP', 'PTE'].map(rank => (
                                <Button
                                  key={rank}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addFilterTag("rank", rank, rank)}
                                  className="w-full justify-start"
                                >
                                  {rank}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Status</p>
                            <div className="space-y-1">
                              {['Completed', 'Pending', 'Regular'].map(status => (
                                <Button
                                  key={status}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => addFilterTag("status", status, status)}
                                  className="w-full justify-start"
                                >
                                  {status}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Total Score</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Sit-Up Reps</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Push-Up Reps</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Run Time</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attemptsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              Loading IPPT attempts...
                            </td>
                          </tr>
                        ) : (filteredConductAttempts?.length || 0) > 0 ? (
                          filteredConductAttempts.map((attempt: IpptAttempt & { user?: SafeUser }, index: number) => (
                            <tr key={index} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 border-b border-border font-medium">{attempt.user?.fullName || 'Unknown'}</td>
                              <td className="px-4 py-3 border-b border-border">{attempt.totalScore}</td>
                              <td className="px-4 py-3 border-b border-border">{attempt.situpReps}</td>
                              <td className="px-4 py-3 border-b border-border">{attempt.pushupReps}</td>
                              <td className="px-4 py-3 border-b border-border">{attempt.runTime}</td>
                              <td className="px-4 py-3 border-b border-border">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  attempt.result === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                                  attempt.result === 'Silver' ? 'bg-gray-100 text-gray-800' :
                                  attempt.result === 'Pass' ? 'bg-green-100 text-green-800' :
                                  attempt.result === 'Fail' ? 'bg-red-100 text-red-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {attempt.result}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                              No IPPT attempts found for this conduct session.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Individual Personnel View */}
          {viewMode === 'scores' && (
            <div className="space-y-6 md:space-y-8">
              <Card className="shadow-lg border-0 overflow-hidden">
                                <div className="p-3 sm:p-4 md:p-6">
                  {/* Filter Tags Display */}
                  {filterTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {filterTags.map(tag => (
                        <Badge key={tag.id} variant="secondary" className="gap-1">
                          {tag.label}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => removeFilterTag(tag.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Search Results Count */}
                  <div className="mb-4 text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{filteredPersonnel.length}</span> of <span className="font-semibold text-foreground">{(commanderStats as any)?.troopers?.length || 0}</span> personnel
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Platoon</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Rank</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Eligibility</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Year 1 Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground border-b">Year 2 Status</th>
                          <th className="px-4 py-3 text-center font-semibold text-foreground border-b"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPersonnel.length > 0 ? (
                          filteredPersonnel.map((trooper) => (
                            <React.Fragment key={trooper.user.id}>
                              <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toggleUserDetail(trooper.user.id)}>
                                <td className="px-4 py-3 border-b border-border font-medium">
                                  {(trooper.user as any).mspName || 'N/A'}
                                </td>
                                <td className="px-4 py-3 border-b border-border">{trooper.user.rank || 'N/A'}</td>
                                <td className="px-4 py-3 border-b border-border font-medium">{trooper.user.fullName || 'Unknown'}</td>
                                <td className="px-4 py-3 border-b border-border">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      trooper.isEligible !== false ? 'bg-green-500' : 'bg-red-500'
                                    }`}></div>
                                    <span className="text-xs font-medium">
                                      {trooper.isEligible !== false ? 'Eligible' : 'Not Eligible'}
                                    </span>
                                  </div>
                                </td>
                                {(() => {
                                  const days = trooper.user.doe ? Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                  const isRegular = days > 730;
                                  
                                  if (isRegular) {
                                    return (
                                      <td colSpan={2} className="px-4 py-3 border-b border-border bg-slate-800/50 text-center dark:bg-slate-700/50">
                                        <div className="flex items-center justify-center gap-2">
                                          <span className="text-xs font-medium">Regular</span>
                                        </div>
                                      </td>
                                    );
                                  } else {
                                    return (
                                      <>
                                        <td className="px-4 py-3 border-b border-border">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              trooper.yearOneStatus === 'Cleared' ? 'bg-green-500' :
                                              trooper.yearOneStatus === 'Incomplete' ? 'bg-red-500' :
                                              'bg-gray-400'
                                            }`}></div>
                                            <span className="text-xs font-medium">
                                              {trooper.yearOneStatus === 'Cleared' ? 'Cleared' :
                                               trooper.yearOneStatus === 'Incomplete' ? 'Incomplete' :
                                               trooper.yearOneStatus || 'N/A'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 border-b border-border">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              trooper.yearTwoStatus === 'Cleared' ? 'bg-green-500' :
                                              trooper.yearTwoStatus === 'Incomplete' ? 'bg-red-500' :
                                              'bg-gray-400'
                                            }`}></div>
                                            <span className="text-xs font-medium">
                                              {trooper.yearTwoStatus === 'Cleared' ? 'Cleared' :
                                               trooper.yearTwoStatus === 'Incomplete' ? 'Incomplete' :
                                               trooper.yearTwoStatus || 'N/A'}
                                            </span>
                                          </div>
                                        </td>
                                      </>
                                    );
                                  }
                                })()}
                                <td className="px-4 py-3 border-b border-border text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 p-0 hover:bg-transparent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEligibilityEditor(trooper);
                                    }}
                                  >
                                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </td>
                              </tr>
                              {debugTrooperId === trooper.user.id && (
                                <tr className="bg-yellow-50">
                                  <td colSpan={7} className="px-4 py-4 text-xs border-t border-yellow-200">
                                    <div className="font-mono space-y-2">
                                      <div className="font-bold text-sm mb-2">Year 1 & 2 Status Debug for {trooper.user.fullName}</div>
                                      
                                      {/* Year 1 Calculation */}
                                      <div className="border-b border-yellow-200 pb-3 mb-3">
                                        <div className="font-semibold text-blue-700 mb-2">Year 1 Status Calculation:</div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">Step 1:</span>
                                          <span>Is admin? {trooper.user.role === "admin" ? "Yes → NA" : "No"}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">Step 2:</span>
                                          <span>Has DOE? {trooper.user.doe ? "Yes" : "No → NA"}</span>
                                        </div>
                                        
                                        {trooper.user.doe && (
                                          <>
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold">Step 3:</span>
                                              <span>Days since enlistment: {(() => {
                                                const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                return days;
                                              })()}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold">Step 4:</span>
                                              <span>Is Regular? (days &gt; 730) {(() => {
                                                const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                return days > 730 ? "Yes → NA" : "No (NSF)";
                                              })()}</span>
                                            </div>
                                            
                                            {(() => {
                                              const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                              if (days <= 730) {
                                                return (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 5:</span>
                                                      <span>Checking IPPT attempts in Year 1 (days 0-365 from {new Date(trooper.user.doe).toISOString().split('T')[0]})</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 6:</span>
                                                      <span>Attempts found in this period: {trooper.yearOneAttempts?.length || 0}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 7:</span>
                                                      <span className="text-red-600">LOGIC CHECK: {trooper.yearOneAttempts?.length || 0} &gt; 0 ? {trooper.yearOneAttempts?.length || 0} &gt; 0 ? "Cleared" : "Incomplete" = {(trooper.yearOneAttempts?.length || 0) > 0 ? "Cleared" : "Incomplete"}</span>
                                                    </div>
                                                    
                                                    {trooper.yearOneAttempts && trooper.yearOneAttempts.length > 0 && (
                                                      <div className="ml-4 space-y-1">
                                                        <div className="text-xs font-semibold">IPPT Attempts in Year 1:</div>
                                                        {trooper.yearOneAttempts.map((attempt: any, idx: any) => (
                                                          <div key={idx} className="text-xs ml-2">
                                                            • {new Date(attempt.ipptDate).toLocaleDateString()} - {attempt.result} ({attempt.totalScore} pts) - Days from DOE: {(() => {
                                                              if (!trooper.user.doe) return 'N/A';
                                                              const days = Math.floor((new Date(attempt.ipptDate).getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                              return days;
                                                            })()}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                    
                                                    {trooper.yearOneAttempts && trooper.yearOneAttempts.length === 0 && (
                                                      <div className="ml-4 text-xs text-red-600">
                                                        No IPPT attempts found in Year 1 period (days 0-365 from DOE)
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </>
                                        )}
                                        
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="font-bold">Year 1 Result:</span>
                                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            trooper.yearOneStatus === 'Cleared' ? 'bg-green-100 text-green-800' :
                                            trooper.yearOneStatus === 'Incomplete' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {trooper.yearOneStatus}
                                          </span>
                                          <span className="text-xs text-red-600 font-mono">
                                            (DEBUG: attempts={trooper.yearOneAttempts?.length || 0}, status={trooper.yearOneStatus}, DOE={trooper.user.doe ? new Date(trooper.user.doe).toLocaleDateString() : 'null'}, days={(() => {
                                              if (!trooper.user.doe) return 'null';
                                              const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                              return days;
                                            })()})
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Year 2 Calculation */}
                                      <div className="border-b border-yellow-200 pb-3 mb-3">
                                        <div className="font-semibold text-blue-700 mb-2">Year 2 Status Calculation:</div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">Step 1:</span>
                                          <span>Is admin? {trooper.user.role === "admin" ? "Yes → NA" : "No"}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold">Step 2:</span>
                                          <span>Has DOE? {trooper.user.doe ? "Yes" : "No → NA"}</span>
                                        </div>
                                        
                                        {trooper.user.doe && (
                                          <>
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold">Step 3:</span>
                                              <span>Days since enlistment: {(() => {
                                                const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                return days;
                                              })()}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold">Step 4:</span>
                                              <span>Is Regular? (days &gt; 730) {(() => {
                                                const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                return days > 730 ? "Yes → NA" : "No (NSF)";
                                              })()}</span>
                                            </div>
                                            
                                            {(() => {
                                              const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                              if (days <= 730) {
                                                return (
                                                  <>
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 5:</span>
                                                      <span>Checking IPPT attempts in Year 2 (days 365-730 from {new Date(trooper.user.doe).toISOString().split('T')[0]})</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 6:</span>
                                                      <span>Attempts found in this period: {trooper.yearTwoAttempts?.length || 0}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-semibold">Step 7:</span>
                                                      <span className="text-red-600">LOGIC CHECK: {trooper.yearTwoAttempts?.length || 0} &gt; 0 ? {trooper.yearTwoAttempts?.length || 0} &gt; 0 ? "Cleared" : "Incomplete" = {(trooper.yearTwoAttempts?.length || 0) > 0 ? "Cleared" : "Incomplete"}</span>
                                                    </div>
                                                    
                                                    {trooper.yearTwoAttempts && trooper.yearTwoAttempts.length > 0 && (
                                                      <div className="ml-4 space-y-1">
                                                        <div className="text-xs font-semibold">IPPT Attempts in Year 2:</div>
                                                        {trooper.yearTwoAttempts.map((attempt, idx) => (
                                                          <div key={idx} className="text-xs ml-2">
                                                            • {new Date(attempt.ipptDate).toLocaleDateString()} - {attempt.result} ({attempt.totalScore} pts) - Days from DOE: {(() => {
                                                              if (!trooper.user.doe) return 'N/A';
                                                              const days = Math.floor((new Date(attempt.ipptDate).getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                                              return days;
                                                            })()}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                    
                                                    {trooper.yearTwoAttempts && trooper.yearTwoAttempts.length === 0 && (
                                                      <div className="ml-4 text-xs text-red-600">
                                                        No IPPT attempts found in Year 2 period (days 365-730 from DOE)
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              }
                                              return null;
                                            })()}
                                          </>
                                        )}
                                        
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="font-bold">Year 2 Result:</span>
                                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                            trooper.yearTwoStatus === 'Cleared' ? 'bg-green-100 text-green-800' :
                                            trooper.yearTwoStatus === 'Incomplete' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {trooper.yearTwoStatus}
                                          </span>
                                          <span className="text-xs text-red-600 font-mono">
                                            (DEBUG: attempts={trooper.yearTwoAttempts?.length || 0}, status={trooper.yearTwoStatus}, DOE={trooper.user.doe ? new Date(trooper.user.doe).toLocaleDateString() : 'null'}, days={(() => {
                                              if (!trooper.user.doe) return 'null';
                                              const days = Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
                                              return days;
                                            })()})
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {expandedUsers[trooper.user.id] && (
                                <tr className="bg-muted/20">
                                  <td colSpan={7} className="px-0 py-0">
                                    <div className="animate-in slide-in-from-top-2 duration-500 ease-out">
                                      <div className="px-4 py-6">
                                        <div className="space-y-6">
                                      {/* Performance Overview */}
                                      <div className="bg-card border border-border rounded-lg p-6">
                                        <h4 className="font-semibold text-foreground mb-4">Performance Overview</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:p-4">
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Best Result</div>
                                            <div className={`text-lg font-bold ${
                                              trooper.bestAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                              trooper.bestAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                              trooper.bestAttempt?.result === 'Pass' ? 'text-green-600' :
                                              'text-gray-600'
                                            }`}>
                                              {trooper.bestAttempt?.result || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} pts • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Latest Result</div>
                                            <div className={`text-lg font-bold ${
                                              trooper.latestAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                              trooper.latestAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                              trooper.latestAttempt?.result === 'Pass' ? 'text-green-600' :
                                              'text-gray-600'
                                            }`}>
                                              {trooper.latestAttempt?.result || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.latestAttempt ? `${trooper.latestAttempt.totalScore} pts • ${new Date(trooper.latestAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Initial Result</div>
                                            <div className={`text-lg font-bold ${
                                              trooper.initialAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                              trooper.initialAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                              trooper.initialAttempt?.result === 'Pass' ? 'text-green-600' :
                                              'text-gray-600'
                                            }`}>
                                              {trooper.initialAttempt?.result || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.initialAttempt ? `${trooper.initialAttempt.totalScore} pts • ${new Date(trooper.initialAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Improvement</div>
                                            <div className="text-lg font-bold text-blue-600">
                                              {trooper.initialAttempt && trooper.bestAttempt ? 
                                                `+${trooper.bestAttempt.totalScore - trooper.initialAttempt.totalScore}` : 
                                                'N/A'
                                              }
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.initialAttempt && trooper.bestAttempt ? 
                                                `${((trooper.bestAttempt.totalScore - trooper.initialAttempt.totalScore) / trooper.initialAttempt.totalScore * 100).toFixed(1)}% improvement` : 
                                                'No data'
                                              }
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Component Performance */}
                                      <div className="bg-card border border-border rounded-lg p-6">
                                        <h4 className="font-semibold text-foreground mb-4">Best Component Performance</h4>
                                        <div className="grid grid-cols-3 gap-3 sm:p-4">
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Sit-Ups</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {trooper.bestAttempt?.situpReps || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Push-Ups</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {trooper.bestAttempt?.pushupReps || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">2.4km Run</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {trooper.bestAttempt?.runTime || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `timing • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Improvement Analysis */}
                                      {trooper.initialAttempt && trooper.bestAttempt && (
                                        <div className="bg-card border border-border rounded-lg p-6">
                                          <h4 className="font-semibold text-foreground mb-4">Improvement Analysis</h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                              <div className="text-sm text-muted-foreground mb-3">Raw Gains</div>
                                              <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                  <span>Score</span>
                                                  <span className="font-bold text-green-600">
                                                    +{trooper.bestAttempt.totalScore - trooper.initialAttempt.totalScore} pts
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Sit-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{trooper.bestAttempt.situpReps - trooper.initialAttempt.situpReps} reps
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Push-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{trooper.bestAttempt.pushupReps - trooper.initialAttempt.pushupReps} reps
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Run Time</span>
                                                  <span className="font-bold text-green-600">
                                                    {(() => {
                                                      const improvement = parseRunTimeToSeconds(trooper.initialAttempt.runTime) - parseRunTimeToSeconds(trooper.bestAttempt.runTime);
                                                      const minutes = Math.floor(improvement / 60);
                                                      const seconds = improvement % 60;
                                                      return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
                                                    })()}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-sm text-muted-foreground mb-3">Percentage Rate</div>
                                              <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                  <span>Score</span>
                                                  <span className="font-bold text-green-600">
                                                    +{((trooper.bestAttempt.totalScore - trooper.initialAttempt.totalScore) / trooper.initialAttempt.totalScore * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Sit-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{((trooper.bestAttempt.situpReps - trooper.initialAttempt.situpReps) / trooper.initialAttempt.situpReps * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Push-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{((trooper.bestAttempt.pushupReps - trooper.initialAttempt.pushupReps) / trooper.initialAttempt.pushupReps * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Run Time</span>
                                                  <span className="font-bold text-red-600">
                                                    {((parseRunTimeToSeconds(trooper.initialAttempt.runTime) - parseRunTimeToSeconds(trooper.bestAttempt.runTime)) / parseRunTimeToSeconds(trooper.initialAttempt.runTime) * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      <div>
                                        <h5 className="font-semibold text-foreground mb-4">IPPT History Timeline</h5>
                                        <div className="relative">
                                          {/* Timeline Line */}
                                          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                                          
                                          {/* Check if this is a regular trooper */}
                                          {(() => {
                                            const days = trooper.user.doe ? Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                            const isRegular = days > 730;
                                            
                                            // DEBUG: Log the calculation details
                                            console.log(`DEBUG Timeline for ${trooper.user.fullName}:`, {
                                              days,
                                              isRegular,
                                              doe: trooper.user.doe,
                                              yearOneAttemptsCount: trooper.yearOneAttempts?.length || 0,
                                              yearTwoAttemptsCount: trooper.yearTwoAttempts?.length || 0,
                                              yearOneAttempts: trooper.yearOneAttempts,
                                              yearTwoAttempts: trooper.yearTwoAttempts
                                            });
                                            
                                            // Check if any IPPT data exists
                                            const hasNoAttempts = (!trooper.yearOneAttempts || trooper.yearOneAttempts.length === 0) && 
                                                               (!trooper.yearTwoAttempts || trooper.yearTwoAttempts.length === 0);
                                            
                                            if (hasNoAttempts) {
                                              return (
                                                <div className="relative ml-10 mb-4">
                                                  <div className="bg-muted/30 border border-dashed border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground">
                                                    <div className="text-sm mb-2">No IPPT attempts found</div>
                                                    <div className="text-xs">IPPT records will appear here once available</div>
                                                  </div>
                                                </div>
                                              );
                                            }
                                            
                                            if (isRegular) {
                                              // Show all attempts together for regulars (deduplicated)
                                              const allAttempts = [
                                                ...(trooper.yearOneAttempts || []),
                                                ...(trooper.yearTwoAttempts || [])
                                              ];
                                              
                                              // Deduplicate by ID
                                              const uniqueAttempts = allAttempts.filter((attempt, index, self) => 
                                                index === self.findIndex((a) => a.id === attempt.id)
                                              ).sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());
                                              
                                              return (
                                                <React.Fragment>
                                                  <div className="mb-8">
                                                    <div className="flex items-center mb-4">
                                                      <div className="w-8"></div>
                                                      <div className="relative flex items-center">
                                                        <div className="absolute -left-[7px] w-4 h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                                        <div className="pl-5 text-lg font-bold text-foreground">IPPT History</div>
                                                      </div>
                                                    </div>
                                                    
                                                    {uniqueAttempts.map((attempt, index) => (
                                                      <div key={attempt.id || index} className="relative ml-10 mb-4">
                                                        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                                          <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                              <div className={`text-lg font-bold ${
                                                                attempt.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                                                attempt.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                                                attempt.result === 'Pass' ? 'text-green-600' :
                                                                'text-gray-600'
                                                              }`}>
                                                                {attempt.result}
                                                              </div>
                                                              <div className="text-sm text-muted-foreground">
                                                                {attempt.sessionName || 'IPPT Test'} • {new Date(attempt.ipptDate).toLocaleDateString()}
                                                              </div>
                                                            </div>
                                                            <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                                          </div>
                                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                                            <div>
                                                              <div className="text-muted-foreground">Sit-Ups</div>
                                                              <div className="font-bold">{attempt.situpReps} reps</div>
                                                              <div className="text-blue-600 font-semibold">{attempt.situpScore} pts</div>
                                                            </div>
                                                            <div>
                                                              <div className="text-muted-foreground">Push-Ups</div>
                                                              <div className="font-bold">{attempt.pushupReps} reps</div>
                                                              <div className="text-green-600 font-semibold">{attempt.pushupScore} pts</div>
                                                            </div>
                                                            <div>
                                                              <div className="text-muted-foreground">2.4km Run</div>
                                                              <div className="font-bold">
                                                                {attempt.runTime}
                                                              </div>
                                                              <div className="text-orange-600 font-semibold">{attempt.runScore} pts</div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </React.Fragment>
                                              );
                                            } else {
                                              // Show Year 1 and Year 2 separately for NSFs
                                              return (
                                                <React.Fragment>
                                                  {/* Year 1 */}
                                                  <div className="mb-8">
                                                    <div className="flex items-center mb-4">
                                                      <div className="w-8"></div>
                                                      <div className="relative flex items-center">
                                                        <div className="absolute -left-[7px] w-4 h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                                        <div className="pl-5 text-lg font-bold text-foreground">Year 1</div>
                                                      </div>
                                                    </div>
                                                    
                                                    {/* Year 1 IPPT Attempts */}
                                                    {trooper.yearOneAttempts && trooper.yearOneAttempts.length > 0 ? (
                                                      trooper.yearOneAttempts.sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime()).map((attempt, index) => (
                                                      <div key={attempt.id || index} className="relative ml-10 mb-4">
                                                        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                                          <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                              <div className={`text-lg font-bold ${
                                                                attempt.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                                                attempt.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                                                attempt.result === 'Pass' ? 'text-green-600' :
                                                                'text-gray-600'
                                                              }`}>
                                                                {attempt.result}
                                                              </div>
                                                              <div className="text-sm text-muted-foreground">
                                                                {attempt.sessionName || 'IPPT Test'} • {new Date(attempt.ipptDate).toLocaleDateString()}
                                                              </div>
                                                            </div>
                                                            <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                                          </div>
                                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                                            <div>
                                                              <div className="text-muted-foreground">Sit-Ups</div>
                                                              <div className="font-bold">{attempt.situpReps} reps</div>
                                                              <div className="text-blue-600 font-semibold">{attempt.situpScore} pts</div>
                                                            </div>
                                                            <div>
                                                              <div className="text-muted-foreground">Push-Ups</div>
                                                              <div className="font-bold">{attempt.pushupReps} reps</div>
                                                              <div className="text-green-600 font-semibold">{attempt.pushupScore} pts</div>
                                                            </div>
                                                            <div>
                                                              <div className="text-muted-foreground">2.4km Run</div>
                                                              <div className="font-bold">
                                                                {attempt.runTime}
                                                              </div>
                                                              <div className="text-orange-600 font-semibold">{attempt.runScore} pts</div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))
                                                    ) : (
                                                      <div className="relative ml-10 mb-4">
                                                        <div className="bg-muted/30 border border-dashed border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground">
                                                          <div className="text-sm mb-2">No IPPT attempts found in Year 1</div>
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Year 2 - Only show if there are records */}
                                                  {trooper.yearTwoAttempts && trooper.yearTwoAttempts.length > 0 && (
                                                    <div className="mt-8 mb-8">
                                                      <div className="flex items-center mb-4">
                                                        <div className="w-8"></div>
                                                        <div className="relative flex items-center">
                                                          <div className="absolute -left-[7px] w-4 h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                                          <div className="pl-5 text-lg font-bold text-foreground">Year 2</div>
                                                        </div>
                                                      </div>
                                                      {/* Year 2 IPPT Attempts */}
                                                      {trooper.yearTwoAttempts.sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime()).map((attempt, index) => (
                                                        <div key={attempt.id || index} className="relative ml-10 mb-4">
                                                          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                                            <div className="flex items-center justify-between mb-3">
                                                              <div>
                                                                <div className={`text-lg font-bold ${
                                                                  attempt.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                                                  attempt.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                                                  attempt.result === 'Pass' ? 'text-green-600' :
                                                                  'text-gray-600'
                                                                }`}>
                                                                  {attempt.result}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                  {attempt.sessionName || 'IPPT Test'} • {new Date(attempt.ipptDate).toLocaleDateString()}
                                                                </div>
                                                              </div>
                                                              <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-3 text-xs">
                                                              <div>
                                                                <div className="text-muted-foreground">Sit-Ups</div>
                                                                <div className="font-bold">{attempt.situpReps} reps</div>
                                                                <div className="text-blue-600 font-semibold">{attempt.situpScore} pts</div>
                                                              </div>
                                                              <div>
                                                                <div className="text-muted-foreground">Push-Ups</div>
                                                                <div className="font-bold">{attempt.pushupReps} reps</div>
                                                                <div className="text-green-600 font-semibold">{attempt.pushupScore} pts</div>
                                                              </div>
                                                              <div>
                                                                <div className="text-muted-foreground">2.4km Run</div>
                                                                <div className="font-bold">
                                                                  {attempt.runTime}
                                                                </div>
                                                                <div className="text-orange-600 font-semibold">{attempt.runScore} pts</div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </React.Fragment>
                                              );
                                            }
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    </div>
                                  </div>
                                </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-muted-foreground">
                              No personnel found matching "{searchTerm}"
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {filteredPersonnel.length > 0 ? (
                      filteredPersonnel.map((trooper) => (
                        <Card key={trooper.user.id} className="hover:shadow-xl transition-all duration-300 cursor-pointer bg-background border border-border shadow-2xl" onClick={() => toggleUserDetail(trooper.user.id)}>
                          <div className="p-4 sm:p-6">
                            {/* Header with better spacing */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-lg text-foreground mb-2">
                                  {trooper.user.fullName || 'Unknown'}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                  <span className="font-medium">{trooper.user.rank || 'N/A'}</span>
                                  <span className="text-border">•</span>
                                  <span className="text-blue-600 font-medium">{(trooper.user as any).mspName || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Status Overview */}
                            <div className="bg-muted rounded-xl p-4 mb-4 border border-border shadow-inner">
                              <div className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wide">Status</div>
                                <div className="space-y-3">
                                  {/* Eligibility Status */}
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      trooper.isEligible !== false ? 'bg-green-500 shadow-green' : 'bg-red-500 shadow-red'
                                    }`}></div>
                                    <span className="text-sm font-medium text-foreground">
                                      {trooper.isEligible !== false ? 'Eligible' : 'Not Eligible'}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 p-0 hover:bg-transparent"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEligibilityEditor(trooper);
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                  {/* Service Status */}
                                  {(() => {
                                    const days = trooper.user.doe ? Math.floor((new Date().getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                    const isRegular = days > 730;
                                    
                                    if (isRegular) {
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-foreground">Regular</span>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              trooper.yearOneStatus === 'Cleared' ? 'bg-green-500' :
                                              trooper.yearOneStatus === 'Incomplete' ? 'bg-red-500' :
                                              'bg-gray-400'
                                            }`}></div>
                                            <span className="text-sm">Y1: <span className={`font-medium ${
                                              trooper.yearOneStatus === 'Cleared' ? 'text-green-600' :
                                              trooper.yearOneStatus === 'Incomplete' ? 'text-red-600' :
                                              'text-gray-600'
                                            }`}>{trooper.yearOneStatus || 'Not Started'}</span></span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              trooper.yearTwoStatus === 'Cleared' ? 'bg-green-500' :
                                              trooper.yearTwoStatus === 'Incomplete' ? 'bg-red-500' :
                                              'bg-gray-400'
                                            }`}></div>
                                            <span className="text-sm">Y2: <span className={`font-medium ${
                                              trooper.yearTwoStatus === 'Cleared' ? 'text-green-600' :
                                              trooper.yearTwoStatus === 'Incomplete' ? 'text-red-600' :
                                              'text-gray-600'
                                            }`}>{trooper.yearTwoStatus || 'Not Started'}</span></span>
                                          </div>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>

                          {/* Expanded Details */}
                          {expandedUsers[trooper.user.id] && (
                            <div className="border-t border-border bg-muted/20 animate-in slide-in-from-top-2 duration-500 ease-out mt-2">
                              <div className="p-3 sm:p-4">
                                <div className="space-y-4 sm:space-y-6">
                                  {/* Performance Overview */}
                                  <div className="py-2 sm:py-4">
                                    <h4 className="font-semibold text-foreground mb-3 sm:mb-4">Performance Overview</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3 sm:p-4">
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Best Result</div>
                                    <div className={`text-lg font-bold ${
                                      trooper.bestAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                      trooper.bestAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                      trooper.bestAttempt?.result === 'Pass' ? 'text-green-600' :
                                      'text-gray-600'
                                    }`}>
                                      {trooper.bestAttempt?.result || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} pts • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Latest Result</div>
                                    <div className={`text-lg font-bold ${
                                      trooper.latestAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                      trooper.latestAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                      trooper.latestAttempt?.result === 'Pass' ? 'text-green-600' :
                                      'text-gray-600'
                                    }`}>
                                      {trooper.latestAttempt?.result || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.latestAttempt ? `${trooper.latestAttempt.totalScore} pts • ${new Date(trooper.latestAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Initial Result</div>
                                    <div className={`text-lg font-bold ${
                                      trooper.initialAttempt?.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                      trooper.initialAttempt?.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                      trooper.initialAttempt?.result === 'Pass' ? 'text-green-600' :
                                      'text-gray-600'
                                    }`}>
                                      {trooper.initialAttempt?.result || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.initialAttempt ? `${trooper.initialAttempt.totalScore} pts • ${new Date(trooper.initialAttempt.ipptDate).toLocaleDateString()}` : 'No attempts'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Improvement</div>
                                    <div className="text-lg font-bold text-blue-600">
                                      {trooper.initialAttempt && trooper.bestAttempt ? 
                                        `+${trooper.bestAttempt.totalScore - trooper.initialAttempt.totalScore}` : 
                                        'N/A'
                                      }
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.initialAttempt && trooper.bestAttempt ? 
                                        `From ${trooper.initialAttempt.totalScore} to ${trooper.bestAttempt.totalScore} pts` : 
                                        'No improvement data'
                                      }
                                    </div>
                                  </div>
                                </div>
                                </div>
                              </div>

                              {/* Divider */}
                              <div className="border-t border-border"></div>
                              
                              {/* Best Component Performance */}
                              <div className="py-2 sm:py-4">
                                <h4 className="font-semibold text-foreground mb-3 sm:mb-4">Best Component Performance</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3 sm:p-4">
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Sit-Ups</div>
                                    <div className="text-lg font-bold text-foreground">
                                      {trooper.bestAttempt?.situpReps || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Push-Ups</div>
                                    <div className="text-lg font-bold text-foreground">
                                      {trooper.bestAttempt?.pushupReps || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">2.4km Run</div>
                                    <div className="text-lg font-bold text-foreground">
                                      {trooper.bestAttempt?.runTime || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `time • ${new Date(trooper.bestAttempt.ipptDate).toLocaleDateString()}` : 'No data'}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Divider */}
                              <div className="border-t border-border"></div>
                              
                              {/* IPPT History Timeline */}
                              <div className="py-2 sm:py-4">
                                <h4 className="font-semibold text-foreground mb-3 sm:mb-4">IPPT History Timeline</h4>
                                <div className="relative">
                                  {/* Timeline Line */}
                                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
                                  
                                  {/* Check if any IPPT data exists */}
                                  {(!trooper.yearOneAttempts || trooper.yearOneAttempts.length === 0) && 
                                   (!trooper.yearTwoAttempts || trooper.yearTwoAttempts.length === 0) ? (
                                    <div className="relative ml-10 mb-4">
                                      <div className="bg-muted/30 border border-dashed border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground">
                                        <div className="text-sm mb-2">No IPPT attempts found</div>
                                        <div className="text-xs">IPPT records will appear here once available</div>
                                      </div>
                                    </div>
                                  ) : (
                                  <React.Fragment>
                                  {/* All IPPT Attempts */}
                                  <div className="mb-6 sm:mb-8">
                                    <div className="flex items-center mb-3 sm:mb-4">
                                      <div className="w-8"></div>
                                      <div className="relative flex items-center">
                                        <div className="absolute -left-[5px] w-3 h-3 sm:-left-[7px] sm:w-4 sm:h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                        <div className="pl-4 sm:pl-5 text-base sm:text-lg font-bold text-foreground">IPPT History</div>
                                      </div>
                                    </div>
                                    
                                    {/* All IPPT Attempts Combined */}
                                    {(() => {
                                      const allAttempts = [
                                        ...(trooper.yearOneAttempts || []),
                                        ...(trooper.yearTwoAttempts || [])
                                      ].sort((a, b) => new Date(a.ipptDate).getTime() - new Date(b.ipptDate).getTime());
                                      
                                      return allAttempts.length > 0 ? (
                                        allAttempts.map((attempt, index) => (
                                        <div key={attempt.id || index} className="relative ml-10 mb-4">
                                          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                              <div>
                                                <div className={`text-lg font-bold ${
                                                  attempt.result === 'Gold' ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent' :
                                                  attempt.result === 'Silver' ? 'bg-gradient-to-r from-gray-600 via-slate-500 to-gray-700 bg-clip-text text-transparent' :
                                                  attempt.result === 'Pass' ? 'text-green-600' :
                                                  'text-gray-600'
                                                }`}>
                                                  {attempt.result}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                  {attempt.sessionName || 'IPPT Test'} • {new Date(attempt.ipptDate).toLocaleDateString()}
                                                </div>
                                              </div>
                                              <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 text-xs">
                                              <div>
                                                <div className="text-muted-foreground">Sit-Ups</div>
                                                <div className="font-bold">{attempt.situpReps} reps</div>
                                                <div className="text-blue-600 font-semibold">{attempt.situpScore} pts</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">Push-Ups</div>
                                                <div className="font-bold">{attempt.pushupReps} reps</div>
                                                <div className="text-green-600 font-semibold">{attempt.pushupScore} pts</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">2.4km Run</div>
                                                <div className="font-bold">
                                                  {attempt.runTime}
                                                </div>
                                                <div className="text-orange-600 font-semibold">{attempt.runScore} pts</div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="relative ml-10 mb-4">
                                        <div className="bg-muted/30 border border-dashed border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground">
                                          <div className="text-sm mb-2">No IPPT attempts found</div>
                                        </div>
                                      </div>
                                    );
                                    })()}
                                  </div>
                                  </React.Fragment>
                                  )}
                              </div>
                            </div>
                                </div>
                            </div>
                          )}
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No personnel found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Eligibility Editor Modal */}
      {eligibilityEditorOpen && editingTrooper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-lg font-semibold">Edit Eligibility</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeEligibilityEditor}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Editing eligibility for: <span className="font-medium text-foreground">{editingTrooper.user.fullName}</span>
              </div>
              
              {/* Eligibility Status */}
              <div className="space-y-2">
                <Label htmlFor="eligibility-status">Eligibility Status</Label>
                <Select
                  value={eligibilityForm.isEligible.toString()}
                  onValueChange={(value) => setEligibilityForm(prev => ({ ...prev, isEligible: value === 'true' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Eligible</SelectItem>
                    <SelectItem value="false">Not Eligible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Conditional fields for Not Eligible */}
              {!eligibilityForm.isEligible && (
                <>
                  {/* Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="reason">Status / Reason *</Label>
                    <Input
                      id="reason"
                      placeholder="Enter reason for ineligibility"
                      value={eligibilityForm.reason}
                      onChange={(e) => setEligibilityForm(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                  
                  {/* Ineligibility Type */}
                  <div className="space-y-2">
                    <Label htmlFor="ineligibility-type">Ineligibility Type *</Label>
                    <Select
                      value={eligibilityForm.ineligibilityType}
                      onValueChange={(value: 'indefinite' | 'until_date') => setEligibilityForm(prev => ({ ...prev, ineligibilityType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indefinite">Indefinite</SelectItem>
                        <SelectItem value="until_date">Until Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Until Date (conditional) */}
                  {eligibilityForm.ineligibilityType === 'until_date' && (
                    <div className="space-y-2">
                      <Label htmlFor="until-date">Until Date *</Label>
                      <Input
                        id="until-date"
                        type="date"
                        value={eligibilityForm.untilDate}
                        onChange={(e) => setEligibilityForm(prev => ({ ...prev, untilDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-2 p-6 border-t border-border">
              <Button variant="outline" onClick={closeEligibilityEditor}>
                Cancel
              </Button>
              <Button 
                onClick={saveEligibility}
                disabled={updateEligibilityMutation.isPending}
              >
                {updateEligibilityMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Scoresheet Modal */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Scan IPPT Scoresheet</h2>
              <p className="text-sm text-muted-foreground mb-4">Use your phone camera to scan a standard IPPT scoresheet</p>
              
              {scanStep === 'scan' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    <input
                      ref={(input) => {
                        if (input) {
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              handleImageUpload(file);
                            }
                          };
                        }
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      id="upload-input"
                    />
                    <label htmlFor="upload-input" className="cursor-pointer">
                      <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">Tap to scan IPPT scoresheet</p>
                      <p className="text-xs text-muted-foreground">Camera will open automatically</p>
                    </label>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">or</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('upload-input') as HTMLInputElement;
                        if (input) {
                          input.removeAttribute('capture');
                          input.click();
                        }
                      }}
                    >
                      Upload from Gallery
                    </Button>
                  </div>
                  
                  {isScanning && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2 text-sm text-muted-foreground">Processing image...</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${scanProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-center text-muted-foreground">{scanProgress}%</p>
                    </div>
                  )}
                  
                  {!isScanning && (
                    <Button 
                      onClick={() => document.getElementById('scan-input')?.click()}
                      className="w-full"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Scan Scoresheet
                    </Button>
                  )}
                </div>
              )}

              {scanStep === 'confirm' && scannedData && (
                <div className="space-y-4">
                  {/* Show all extracted participants */}
                  {draftEntries.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-blue-900">
                          Extracted Participants: {draftEntries.length}
                        </h3>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => {
                              setDraftEntries([]);
                              setScannedData(null);
                              setScanStep('scan');
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Clear All
                          </Button>
                          <Button 
                            onClick={() => {
                              setScannedData(null);
                              setScanStep('scan');
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Camera className="w-4 h-4 mr-2" />
                            Scan More
                          </Button>
                        </div>
                      </div>
                      
                      {/* Display all participants */}
                      <div className="max-h-96 overflow-y-auto space-y-3">
                        {draftEntries.map((entry, index) => (
                          <div key={entry.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {index + 1}. {entry.data?.name || 'Unknown'}
                                </h4>
                                <div className="text-sm text-gray-600 mt-1">
                                  <span className="mr-4">Sit-ups: <strong>{entry.data?.situpReps || 0}</strong> ({entry.data?.situpScore || 0}pts)</span>
                                  <span className="mr-4">Push-ups: <strong>{entry.data?.pushupReps || 0}</strong> ({entry.data?.pushupScore || 0}pts)</span>
                                  <span className="mr-4">Run: <strong>{entry.data?.runTime ? entry.data.runTime : '0:00'}</strong> ({entry.data?.runScore || 0}pts)</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                  entry.data?.result === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                                  entry.data?.result === 'Silver' ? 'bg-gray-100 text-gray-800' :
                                  entry.data?.result === 'Pass' ? 'bg-green-100 text-green-800' :
                                  entry.data?.result === 'YTT' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {entry.data?.result || 'Fail'} ({entry.data?.totalScore || 0}pts)
                                </div>
                              </div>
                            </div>
                            
                            {/* Quick edit buttons for each participant */}
                            <div className="flex gap-2 mt-3">
                              <Button 
                                onClick={() => {
                                  setScannedData(entry.data);
                                  setEditingData({
                                    situps: entry.data?.situpReps || 0,
                                    pushups: entry.data?.pushupReps || 0,
                                    runTime: entry.data?.runTime || 0
                                  });
                                }}
                                variant="outline"
                                size="sm"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                onClick={() => {
                                  // Remove this participant
                                  setDraftEntries(prev => prev.filter(e => e.id !== entry.id));
                                  if (scannedData?.name === entry.data?.name && draftEntries.length > 1) {
                                    // Set to first remaining entry
                                    const remaining = draftEntries.filter(e => e.id !== entry.id);
                                    if (remaining.length > 0) {
                                      setScannedData(remaining[0].data);
                                      setEditingData({
                                        situps: remaining[0].data?.situpReps || 0,
                                        pushups: remaining[0].data?.pushupReps || 0,
                                        runTime: remaining[0].data?.runTime || 0
                                      });
                                    }
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Current editing participant */}
                  <div className="bg-muted rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">
                      Currently Editing: {scannedData.name || 'Unknown'}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Sit-ups:</span>
                        <span className="ml-2 font-medium">{scannedData.situps} ({scannedData.situpScore}pts)</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Push-ups:</span>
                        <span className="ml-2 font-medium">{scannedData.pushups} ({scannedData.pushupScore}pts)</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Run Time:</span>
                        <span className="ml-2 font-medium">
                          {scannedData.runTime} ({scannedData.runScore}pts)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Score:</span>
                        <span className="ml-2 font-medium">{scannedData.totalScore}pts</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => setScanStep('edit')}
                        variant="outline"
                        className="flex-1"
                      >
                        Edit Current
                      </Button>
                      <Button 
                        onClick={() => {
                          // Save current edits
                          const updatedEntry = {
                            id: Date.now().toString(),
                            data: scannedData,
                            timestamp: new Date()
                          };
                          setDraftEntries(prev => prev.map(e => 
                            e.data?.name === scannedData.name ? updatedEntry : e
                          ));
                          setScannedData(null);
                          setScanStep('scan');
                        }}
                        className="flex-1"
                      >
                        Save Changes
                      </Button>
                      <Button 
                        onClick={() => {
                          // Finalize all participants
                          console.log('Finalizing all entries:', draftEntries);
                          // Here you would save all to database
                          setScanModalOpen(false);
                          setScanStep('scan');
                          setScannedData(null);
                          setDraftEntries([]);
                        }}
                        className="flex-1 bg-primary text-primary-foreground"
                      >
                        Finalise All ({draftEntries.length})
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {scanStep === 'edit' && (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Edit Extracted Data</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-foreground">Sit-ups</label>
                        <Input 
                          type="number"
                          value={editingData?.situpReps || ''}
                          onChange={(e) => setEditingData(prev => prev ? {...prev, situps: parseInt(e.target.value) || 0} : null)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">Push-ups</label>
                        <Input 
                          type="number"
                          value={editingData?.pushupReps || ''}
                          onChange={(e) => setEditingData(prev => prev ? {...prev, pushups: parseInt(e.target.value) || 0} : null)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground">2.4km Run (seconds)</label>
                        <Input 
                          type="number"
                          value={editingData?.runTime || ''}
                          onChange={(e) => setEditingData(prev => prev ? {...prev, runTime: parseInt(e.target.value) || 0} : null)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        onClick={() => setScanStep('confirm')}
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button 
                        onClick={async () => {
                          if (editingData && scannedData) {
                            // Use proper scoring calculation
                            const scoreResult = await calculateIpptScore(editingData.situpReps, editingData.pushupReps, editingData.runTime, new Date());
                            const updatedData = {
                              ...scannedData,
                              ...editingData,
                              situpScore: scoreResult.situpScore,
                              pushupScore: scoreResult.pushupScore,
                              runScore: scoreResult.runScore,
                              totalScore: scoreResult.totalScore
                            };
                            setScannedData(updatedData);
                            setScanStep('confirm');
                          }
                        }}
                        className="flex-1 bg-primary text-primary-foreground"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <Button 
                  variant="outline"
                  onClick={() => setScanModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IpptTracker;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from "wouter";
import { Search, X, Plus, Filter, Edit2, Save, Calendar } from "lucide-react";
import { type IpptAttempt, type IpptSession, type IpptSessionWithAttempts, type IpptCommanderStats, type TrooperIpptSummary, type SafeUser, type UserEligibility } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Navbar } from "@/components/Navbar";

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
    ineligibilityType: 'indefinite' as 'indefinite' | 'until_date',
    untilDate: ''
  });

  // API queries
  const { data: commanderStats, isLoading, error } = useQuery<IpptCommanderStats>({
    queryKey: ["/api/ippt/commander-stats"],
    enabled: !!user,
  });

  // Fetch conduct session data
  const { data: conductSessions, isLoading: conductLoading } = useQuery<IpptSession[]>({
    queryKey: ["/api/ippt/sessions"],
    enabled: !!user,
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
            ineligibilityType: 'indefinite',
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
    if (!commanderStats?.troopers) return {
      topScores: [],
      mostPushUps: [],
      mostSitUps: [],
      fastestRuns: []
    };

    // Filter personnel based on selected group
    const filteredTroopers = commanderStats.troopers.filter(trooper => {
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

    // Get all IPPT attempts
    const allAttempts = filteredTroopers.flatMap(trooper => 
      trooper.yearOneAttempts?.concat(trooper.yearTwoAttempts || []) || []
    ).filter(attempt => attempt && attempt.totalScore > 0);

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
      .sort((a, b) => b.pushups - a.pushups)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        reps: attempt.pushups
      }));

    // Most Sit Ups
    const mostSitUps = allAttempts
      .sort((a, b) => b.situps - a.situps)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        reps: attempt.situps
      }));

    // Fastest Runs (lowest time in seconds)
    const fastestRuns = allAttempts
      .sort((a, b) => a.runTimeSeconds - b.runTimeSeconds)
      .slice(0, 3)
      .map((attempt, index) => ({
        rank: index + 1,
        name: filteredTroopers.find(t => 
          (t.yearOneAttempts?.some(a => a.id === attempt.id) || 
           t.yearTwoAttempts?.some(a => a.id === attempt.id))
        )?.user.fullName || 'Unknown',
        time: `${Math.floor(attempt.runTimeSeconds / 60)}:${(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}`
      }));

    // Score Improvement (calculate difference between earliest and latest attempts)
    const scoreImprovements = filteredTroopers
      .map(trooper => {
        const allTrooperAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ].filter(attempt => attempt && attempt.totalScore > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        ].filter(attempt => attempt && attempt.pushups > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestPushUps = allTrooperAttempts[0].pushups;
        const latestPushUps = allTrooperAttempts[allTrooperAttempts.length - 1].pushups;
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
        ].filter(attempt => attempt && attempt.situps > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestSitUps = allTrooperAttempts[0].situps;
        const latestSitUps = allTrooperAttempts[allTrooperAttempts.length - 1].situps;
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
        const allTrooperAttempts = [
          ...(trooper.yearOneAttempts || []),
          ...(trooper.yearTwoAttempts || [])
        ].filter(attempt => attempt && attempt.runTimeSeconds > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allTrooperAttempts.length < 2) return null;

        const earliestTime = allTrooperAttempts[0].runTimeSeconds;
        const latestTime = allTrooperAttempts[allTrooperAttempts.length - 1].runTimeSeconds;
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
        improvement: (() => {
          const minutes = Math.floor(item.improvement / 60);
          const seconds = item.improvement % 60;
          return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
        })()
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
    if (!commanderStats?.troopers) return [];
    
    return commanderStats.troopers.filter(trooper => {
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
  }, [commanderStats?.troopers, searchTerm, filterTags]) || [];

  // Function to get group-specific statistics
  const getGroupStats = (groupName: string): GroupStatistics => {
    let groupTroopers = commanderStats?.troopers || [];
    
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
      total: groupTroopers.length,
      gold: 0,
      silver: 0,
      pass: 0,
      fail: 0,
      ytt: 0
    };

    const initialBreakdown = {
      total: groupTroopers.length,
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
        totalSitups += trooper.bestAttempt.situps || 0;
        totalPushups += trooper.bestAttempt.pushups || 0;
        totalRunSeconds += trooper.bestAttempt.runTimeSeconds || 0;
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
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">IPPT Dashboard</h1>
            <p className="text-sm md:text-lg text-muted-foreground mt-1 md:mt-2">
              Monitor and analyze IPPT performance across MSC
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
                    <>
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
                    </>
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
                    { label: 'Sit-Up Reps', value: currentGroupStats.averageScores.situps, unit: 'reps' },
                    { label: 'Push-Up Reps', value: currentGroupStats.averageScores.pushups, unit: 'reps' },
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
                              <td className="px-4 py-3 border-b border-border">{attempt.situps}</td>
                              <td className="px-4 py-3 border-b border-border">{attempt.pushups}</td>
                              <td className="px-4 py-3 border-b border-border">{Math.floor(attempt.runTimeSeconds / 60)}:{(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}</td>
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
                <div className="bg-muted/80 border-b border-border p-3 sm:p-4 md:p-6">
                  <h2 className="text-lg md:text-xl font-semibold text-foreground text-center">Individual Personnel Records</h2>
                  <p className="text-muted-foreground text-center mt-2">Search and manage individual IPPT records</p>
                </div>
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
                    Showing <span className="font-semibold text-foreground">{filteredPersonnel.length}</span> of <span className="font-semibold text-foreground">{commanderStats?.troopers?.length || 0}</span> personnel
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
                                                        {trooper.yearOneAttempts.map((attempt, idx) => (
                                                          <div key={idx} className="text-xs ml-2">
                                                            • {new Date(attempt.date).toLocaleDateString()} - {attempt.result} ({attempt.totalScore} pts) - Days from DOE: {(() => {
                                                              if (!trooper.user.doe) return 'N/A';
                                                              const days = Math.floor((new Date(attempt.date).getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
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
                                                            • {new Date(attempt.date).toLocaleDateString()} - {attempt.result} ({attempt.totalScore} pts) - Days from DOE: {(() => {
                                                              if (!trooper.user.doe) return 'N/A';
                                                              const days = Math.floor((new Date(attempt.date).getTime() - new Date(trooper.user.doe).getTime()) / (1000 * 60 * 60 * 24));
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
                                              {trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} pts • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                              {trooper.latestAttempt ? `${trooper.latestAttempt.totalScore} pts • ${new Date(trooper.latestAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                              {trooper.initialAttempt ? `${trooper.initialAttempt.totalScore} pts • ${new Date(trooper.initialAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                              {trooper.bestAttempt?.situps || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">Push-Ups</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {trooper.bestAttempt?.pushups || 'N/A'}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-sm text-muted-foreground mb-1">2.4km Run</div>
                                            <div className="text-lg font-bold text-foreground">
                                              {trooper.bestAttempt ? 
                                                `${Math.floor(trooper.bestAttempt.runTimeSeconds / 60)}:${(trooper.bestAttempt.runTimeSeconds % 60).toString().padStart(2, '0')}` : 
                                                'N/A'
                                              }
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {trooper.bestAttempt ? `timing • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
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
                                                    +{trooper.bestAttempt.situps - trooper.initialAttempt.situps} reps
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Push-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{trooper.bestAttempt.pushups - trooper.initialAttempt.pushups} reps
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Run Time</span>
                                                  <span className="font-bold text-green-600">
                                                    {(() => {
                                                      const improvement = trooper.initialAttempt.runTimeSeconds - trooper.bestAttempt.runTimeSeconds;
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
                                                    +{((trooper.bestAttempt.situps - trooper.initialAttempt.situps) / trooper.initialAttempt.situps * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Push-Ups</span>
                                                  <span className="font-bold text-green-600">
                                                    +{((trooper.bestAttempt.pushups - trooper.initialAttempt.pushups) / trooper.initialAttempt.pushups * 100).toFixed(1)}%
                                                  </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                  <span>Run Time</span>
                                                  <span className="font-bold text-red-600">
                                                    {((trooper.initialAttempt.runTimeSeconds - trooper.bestAttempt.runTimeSeconds) / trooper.initialAttempt.runTimeSeconds * 100).toFixed(1)}%
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
                                              trooper.yearOneAttempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((attempt, index) => (
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
                                                        IPPT Test • {new Date(attempt.date).toLocaleDateString()}
                                                      </div>
                                                    </div>
                                                    <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                                  </div>
                                                  <div className="grid grid-cols-3 gap-3 text-xs">
                                                    <div>
                                                      <div className="text-muted-foreground">Sit-Ups</div>
                                                      <div className="font-bold">{attempt.situps} reps</div>
                                                      <div className="text-blue-600 font-semibold">{Math.round(attempt.situps * 0.5)} pts</div>
                                                    </div>
                                                    <div>
                                                      <div className="text-muted-foreground">Push-Ups</div>
                                                      <div className="font-bold">{attempt.pushups} reps</div>
                                                      <div className="text-green-600 font-semibold">{Math.round(attempt.pushups * 0.5)} pts</div>
                                                    </div>
                                                    <div>
                                                      <div className="text-muted-foreground">2.4km Run</div>
                                                      <div className="font-bold">
                                                        {Math.floor(attempt.runTimeSeconds / 60)}:{(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}
                                                      </div>
                                                      <div className="text-orange-600 font-semibold">{Math.round(50 - (attempt.runTimeSeconds - 480) * 0.5)} pts</div>
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
                                              {trooper.yearTwoAttempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((attempt, index) => (
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
                                                          IPPT Test • {new Date(attempt.date).toLocaleDateString()}
                                                        </div>
                                                      </div>
                                                      <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                                      <div>
                                                        <div className="text-muted-foreground">Sit-Ups</div>
                                                        <div className="font-bold">{attempt.situps} reps</div>
                                                        <div className="text-blue-600 font-semibold">{Math.round(attempt.situps * 0.5)} pts</div>
                                                      </div>
                                                      <div>
                                                        <div className="text-muted-foreground">Push-Ups</div>
                                                        <div className="font-bold">{attempt.pushups} reps</div>
                                                        <div className="text-green-600 font-semibold">{Math.round(attempt.pushups * 0.5)} pts</div>
                                                      </div>
                                                      <div>
                                                        <div className="text-muted-foreground">2.4km Run</div>
                                                        <div className="font-bold">
                                                          {Math.floor(attempt.runTimeSeconds / 60)}:{(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}
                                                        </div>
                                                        <div className="text-orange-600 font-semibold">{Math.round(50 - (attempt.runTimeSeconds - 480) * 0.5)} pts</div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                            </div>
                                          </React.Fragment>
                                          )}
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
                                      {trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} pts • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                      {trooper.latestAttempt ? `${trooper.latestAttempt.totalScore} pts • ${new Date(trooper.latestAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                      {trooper.initialAttempt ? `${trooper.initialAttempt.totalScore} pts • ${new Date(trooper.initialAttempt.date).toLocaleDateString()}` : 'No attempts'}
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
                                      {trooper.bestAttempt?.situps || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Push-Ups</div>
                                    <div className="text-lg font-bold text-foreground">
                                      {trooper.bestAttempt?.pushups || 'N/A'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `reps • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">2.4km Run</div>
                                    <div className="text-lg font-bold text-foreground">
                                      {trooper.bestAttempt ? 
                                        `${Math.floor(trooper.bestAttempt.runTimeSeconds / 60)}:${(trooper.bestAttempt.runTimeSeconds % 60).toString().padStart(2, '0')}` : 
                                        'N/A'
                                      }
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {trooper.bestAttempt ? `time • ${new Date(trooper.bestAttempt.date).toLocaleDateString()}` : 'No data'}
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
                                  {/* Year 1 */}
                                  <div className="mb-6 sm:mb-8">
                                    <div className="flex items-center mb-3 sm:mb-4">
                                      <div className="w-8"></div>
                                      <div className="relative flex items-center">
                                        <div className="absolute -left-[5px] w-3 h-3 sm:-left-[7px] sm:w-4 sm:h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                        <div className="pl-4 sm:pl-5 text-base sm:text-lg font-bold text-foreground">Year 1</div>
                                      </div>
                                    </div>
                                    
                                    {/* Year 1 IPPT Attempts */}
                                    {trooper.yearOneAttempts && trooper.yearOneAttempts.length > 0 ? (
                                      trooper.yearOneAttempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((attempt, index) => (
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
                                                IPPT Test • {new Date(attempt.date).toLocaleDateString()}
                                              </div>
                                            </div>
                                            <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                          </div>
                                          <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div>
                                              <div className="text-muted-foreground">Sit-Ups</div>
                                              <div className="font-bold">{attempt.situps} reps</div>
                                              <div className="text-blue-600 font-semibold">{Math.round(attempt.situps * 0.5)} pts</div>
                                            </div>
                                            <div>
                                              <div className="text-muted-foreground">Push-Ups</div>
                                              <div className="font-bold">{attempt.pushups} reps</div>
                                              <div className="text-green-600 font-semibold">{Math.round(attempt.pushups * 0.5)} pts</div>
                                            </div>
                                            <div>
                                              <div className="text-muted-foreground">2.4km Run</div>
                                              <div className="font-bold">
                                                {Math.floor(attempt.runTimeSeconds / 60)}:{(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}
                                              </div>
                                              <div className="text-orange-600 font-semibold">{Math.round(50 - (attempt.runTimeSeconds - 480) * 0.5)} pts</div>
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
                                  
                                  {/* Year 2 */}
                                  {trooper.yearTwoAttempts && trooper.yearTwoAttempts.length > 0 && (
                                    <div className="mt-8 mb-8">
                                      <div className="flex items-center mb-3 sm:mb-4">
                                        <div className="w-8"></div>
                                        <div className="relative flex items-center">
                                          <div className="absolute -left-[5px] w-3 h-3 sm:-left-[7px] sm:w-4 sm:h-4 bg-blue-500 rounded-full border-2 border-background z-10"></div>
                                          <div className="pl-4 sm:pl-5 text-base sm:text-lg font-bold text-foreground">Year 2</div>
                                        </div>
                                      </div>
                                      {trooper.yearTwoAttempts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((attempt, index) => (
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
                                                  IPPT Test • {new Date(attempt.date).toLocaleDateString()}
                                                </div>
                                              </div>
                                              <div className="text-2xl font-bold text-foreground">{attempt.totalScore}</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3 text-xs">
                                              <div>
                                                <div className="text-muted-foreground">Sit-Ups</div>
                                                <div className="font-bold">{attempt.situps} reps</div>
                                                <div className="text-blue-600 font-semibold">{Math.round(attempt.situps * 0.5)} pts</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">Push-Ups</div>
                                                <div className="font-bold">{attempt.pushups} reps</div>
                                                <div className="text-green-600 font-semibold">{Math.round(attempt.pushups * 0.5)} pts</div>
                                              </div>
                                              <div>
                                                <div className="text-muted-foreground">2.4km Run</div>
                                                <div className="font-bold">
                                                  {Math.floor(attempt.runTimeSeconds / 60)}:{(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}
                                                </div>
                                                <div className="text-orange-600 font-semibold">{Math.round(50 - (attempt.runTimeSeconds - 480) * 0.5)} pts</div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
    </div>
  );
};

export default IpptTracker;

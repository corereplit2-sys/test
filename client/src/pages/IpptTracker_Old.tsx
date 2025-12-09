import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { SafeUser, type IpptCommanderStats } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Target, Plus, Users, Trophy, TrendingUp, Calendar, Eye, X, ChevronRight, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

export default function IpptTracker() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const [, setLocation] = useLocation();

  const [view, setView] = useState("commander");
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [detailView, setDetailView] = useState<"none" | "session" | "individual">("none");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: commanderStats } = useQuery<IpptCommanderStats>({
    queryKey: ["/api/ippt/commander-stats"],
    enabled: !!user,
  });

  const { data: sessionDetails } = useQuery({
    queryKey: ["/api/ippt/sessions", selectedSessionId, "details"],
    queryFn: () => fetch(`/api/ippt/sessions/${selectedSessionId}/details`).then(res => res.json()),
    enabled: detailView === "session" && !!selectedSessionId,
  });

  const { data: individualHistory } = useQuery({
    queryKey: ["/api/ippt/individual", selectedUserId, "history"],
    queryFn: () => fetch(`/api/ippt/individual/${selectedUserId}/history`).then(res => res.json()),
    enabled: detailView === "individual" && !!selectedUserId,
  });

  // Filter troopers based on selected group
  const getFilteredTroopers = () => {
    if (!commanderStats?.troopers) return [];
    
    switch (selectedGroup) {
      case "ALL":
        return commanderStats.troopers;
      case "COMD":
        return commanderStats.troopers.filter(t => t.user.role === "commander");
      default:
        // Handle PLT:MSP X format - include both commanders and soldiers in that MSP
        if (selectedGroup.startsWith("PLT:")) {
          const mspName = selectedGroup.replace("PLT:", "");
          return commanderStats.troopers.filter(t => (t.user as any).mspName === mspName);
        }
        return commanderStats.troopers;
    }
  };

  const filteredTroopers = getFilteredTroopers();

  // Calculate breakdowns for filtered troopers
  const getFilteredBreakdown = (type: 'best' | 'initial') => {
    const results = filteredTroopers.map(t => {
      if (type === 'best') {
        return t.bestAttempt?.result || "Fail";
      } else {
        return t.initialAttempt?.result || "Fail";
      }
    }).filter(Boolean);
    
    return {
      gold: results.filter(r => r === "Gold").length,
      silver: results.filter(r => r === "Silver").length,
      pass: results.filter(r => r === "Pass").length,
      fail: results.filter(r => r === "Fail").length,
      ytt: results.filter(r => r === "YTT").length
    };
  };

  const filteredBestBreakdown = getFilteredBreakdown('best');
  const filteredInitialBreakdown = getFilteredBreakdown('initial');

  // Calculate improvement rates for filtered troopers
  const filteredImprovementRates = {
    gold: filteredBestBreakdown.gold - filteredInitialBreakdown.gold,
    goldPercent: filteredInitialBreakdown.gold > 0 ? ((filteredBestBreakdown.gold - filteredInitialBreakdown.gold) / filteredInitialBreakdown.gold) * 100 : 0,
    silver: filteredBestBreakdown.silver - filteredInitialBreakdown.silver,
    silverPercent: filteredInitialBreakdown.silver > 0 ? ((filteredBestBreakdown.silver - filteredInitialBreakdown.silver) / filteredInitialBreakdown.silver) * 100 : 0,
    pass: (filteredBestBreakdown.gold + filteredBestBreakdown.silver + filteredBestBreakdown.pass) - (filteredInitialBreakdown.gold + filteredInitialBreakdown.silver + filteredInitialBreakdown.pass),
    passPercent: (filteredInitialBreakdown.gold + filteredInitialBreakdown.silver + filteredInitialBreakdown.pass) > 0 
      ? (((filteredBestBreakdown.gold + filteredBestBreakdown.silver + filteredBestBreakdown.pass) - (filteredInitialBreakdown.gold + filteredInitialBreakdown.silver + filteredInitialBreakdown.pass)) / (filteredInitialBreakdown.gold + filteredInitialBreakdown.silver + filteredInitialBreakdown.pass)) * 100 
      : 0,
    fail: filteredBestBreakdown.fail - filteredInitialBreakdown.fail,
    failPercent: filteredInitialBreakdown.fail > 0 ? ((filteredBestBreakdown.fail - filteredInitialBreakdown.fail) / filteredInitialBreakdown.fail) * 100 : 0
  };

  // Calculate average best score for filtered troopers
  // Calculate filtered leaderboards and stats
  const getFilteredLeaderboards = () => {
    // Top best scores
    const topBestScores = [...filteredTroopers]
      .filter(t => t.bestAttempt)
      .sort((a, b) => (b.bestAttempt?.totalScore || 0) - (a.bestAttempt?.totalScore || 0))
      .slice(0, 5);

    // Top improvements
    const topImprovements = [...filteredTroopers]
      .filter(t => t.scoreChange !== undefined && t.scoreChange > 0)
      .sort((a, b) => (b.scoreChange || 0) - (a.scoreChange || 0))
      .slice(0, 5);

    // Station leaders
    const stationLeaders = {
      topSitups: filteredTroopers
        .filter(t => t.bestAttempt?.situps)
        .sort((a, b) => (b.bestAttempt?.situps || 0) - (a.bestAttempt?.situps || 0))[0],
      topPushups: filteredTroopers
        .filter(t => t.bestAttempt?.pushups)
        .sort((a, b) => (b.bestAttempt?.pushups || 0) - (a.bestAttempt?.pushups || 0))[0],
      fastestRun: filteredTroopers
        .filter(t => t.bestAttempt?.runTimeSeconds)
        .sort((a, b) => (a.bestAttempt?.runTimeSeconds || Infinity) - (b.bestAttempt?.runTimeSeconds || Infinity))[0]
    };

    // Calculate pass+ rate for filtered group
    const passPlusCount = filteredTroopers.filter(t => 
      t.bestAttempt && (t.bestAttempt.result === "Gold" || t.bestAttempt.result === "Silver")
    ).length;
    const passPlusRate = filteredTroopers.length > 0 ? Math.round((passPlusCount / filteredTroopers.length) * 100) : 0;

    // Calculate overall improvement rate for filtered group
    const improvedCount = filteredTroopers.filter(t => 
      t.scoreChange !== undefined && t.scoreChange > 0
    ).length;
    const overallImprovementRate = filteredTroopers.filter(t => t.scoreChange !== undefined).length > 0 
      ? Math.round((improvedCount / filteredTroopers.filter(t => t.scoreChange !== undefined).length) * 100) 
      : 0;

    return {
      topBestScores,
      topImprovements,
      stationLeaders,
      passPlusRate,
      overallImprovementRate
    };
  };

  const filteredStats = getFilteredLeaderboards();

  // Calculate average best score for filtered troopers
  const filteredAverageBestScore = filteredTroopers.length > 0 
    ? Math.round(filteredTroopers.reduce((sum, t) => sum + (t.bestAttempt?.totalScore || 0), 0) / filteredTroopers.length)
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <Navbar user={user} pageTitle="IPPT Commander Dashboard" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">IPPT Commander Dashboard</h1>
                <p className="text-gray-600 text-lg">Comprehensive IPPT statistics and personnel performance tracking</p>
              </div>
              <Button 
                onClick={() => setLocation("/ippt-input")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-5 h-5 mr-2" />
                Input IPPT Results
              </Button>
            </div>
          </div>

          {/* Role Toggle */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Role</label>
                    <div className="inline-flex rounded-full bg-muted p-1">
                      <Button
                        variant={view === "trooper" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView("trooper")}
                        className="rounded-full px-4"
                      >
                        Trooper View
                      </Button>
                      <Button
                        variant={view === "commander" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setView("commander")}
                        className="rounded-full px-4"
                      >
                        Commander View
                      </Button>
                    </div>
                  </div>

                  {view === "commander" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Group (Excel-style)</label>
                      <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">MSC Overall</SelectItem>
                          <SelectItem value="COMD">MSC Comds</SelectItem>
                          <SelectItem value="PLT:MSP 1">MSP 1</SelectItem>
                          <SelectItem value="PLT:MSP 2">MSP 2</SelectItem>
                          <SelectItem value="PLT:MSP 3">MSP 3</SelectItem>
                          <SelectItem value="PLT:MSP 4">MSP 4</SelectItem>
                          <SelectItem value="PLT:MSP 5">MSP 5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Activity className="w-3 h-3 mr-1" />
                    Data
                  </Badge>
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                    <Target className="w-3 h-3 mr-1" />
                    Embedded Sample
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commander View Content */}
          {view === "commander" && (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Total Eligible (Group)</div>
                    <div className="text-2xl font-bold">{filteredTroopers.length}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      MSC Overall · Eligible troopers in this group
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Best Result Breakdown</div>
                    <div className="text-sm text-muted-foreground">
                      Gold: <strong>{filteredBestBreakdown.gold}</strong> ·
                      Silver: <strong>{filteredBestBreakdown.silver}</strong> ·
                      Pass: <strong>{filteredBestBreakdown.pass}</strong> ·
                      Fail: <strong>{filteredBestBreakdown.fail}</strong> ·
                      YTT: <strong>{filteredBestBreakdown.ytt}</strong>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Initial Result Breakdown</div>
                    <div className="text-sm text-muted-foreground">
                      Gold: <strong>{filteredInitialBreakdown.gold}</strong> ·
                      Silver: <strong>{filteredInitialBreakdown.silver}</strong> ·
                      Pass: <strong>{filteredInitialBreakdown.pass}</strong> ·
                      Fail: <strong>{filteredInitialBreakdown.fail}</strong> ·
                      YTT: <strong>{filteredInitialBreakdown.ytt}</strong>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Improvement & Averages */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-2">Result Improvement Rate</div>
                    <div className="text-sm text-muted-foreground">
                      <div>Gold: {filteredImprovementRates.gold >= 0 ? '+' : ''}{filteredImprovementRates.gold} ({filteredImprovementRates.goldPercent.toFixed(1)}%)</div>
                      <div>Silver: {filteredImprovementRates.silver >= 0 ? '+' : ''}{filteredImprovementRates.silver} ({filteredImprovementRates.silverPercent.toFixed(1)}%)</div>
                      <div>Pass: {filteredImprovementRates.pass >= 0 ? '+' : ''}{filteredImprovementRates.pass} ({filteredImprovementRates.passPercent.toFixed(1)}%)</div>
                      <div>Fail: {filteredImprovementRates.fail >= 0 ? '+' : ''}{filteredImprovementRates.fail} ({filteredImprovementRates.failPercent.toFixed(1)}%)</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-2">Average Best Stations</div>
                    <div className="text-sm text-muted-foreground">
                      <div>Sit-ups: <strong>{commanderStats?.averageBestStations.situps || 0}</strong></div>
                      <div>Push-ups: <strong>{commanderStats?.averageBestStations.pushups || 0}</strong></div>
                      <div>2.4km: <strong>{commanderStats?.averageBestStations.runTime || "0:00"}</strong></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Average Best Score</div>
                    <div className="text-2xl font-bold">{filteredAverageBestScore}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {selectedGroup === "ALL" ? "MSC Overall" : selectedGroup.replace("PLT:", "MSP ")} · Average of best scores
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Personnel Overview Table */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Personnel Scores Overview</CardTitle>
                  <CardDescription>Best / Latest / Initial scores and improvement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Platoon</th>
                          <th className="text-left p-3 font-medium">Rank</th>
                          <th className="text-left p-3 font-medium">Name</th>
                          <th className="text-left p-3 font-medium">Best</th>
                          <th className="text-left p-3 font-medium">Latest</th>
                          <th className="text-left p-3 font-medium">Initial</th>
                          <th className="text-left p-3 font-medium">Δ Score</th>
                          <th className="text-left p-3 font-medium"># Attempts</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTroopers.map((trooper, index) => (
                          <tr key={trooper.user.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                            <td className="p-3">{(trooper.user as any).mspName || trooper.user.mspId || 'N/A'}</td>
                            <td className="p-3">{trooper.user.rank || 'N/A'}</td>
                            <td className="p-3">{trooper.user.fullName}</td>
                            <td className="p-3 font-medium">
                              {trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} ${trooper.bestAttempt.result}` : 'N/A'}
                            </td>
                            <td className="p-3">
                              {trooper.latestAttempt ? `${trooper.latestAttempt.totalScore} ${trooper.latestAttempt.result}` : 'N/A'}
                            </td>
                            <td className="p-3">
                              {trooper.initialAttempt ? `${trooper.initialAttempt.totalScore} ${trooper.initialAttempt.result}` : 'N/A'}
                            </td>
                            <td className="p-3 text-green-600">
                              {trooper.scoreChange !== undefined ? (trooper.scoreChange >= 0 ? `+${trooper.scoreChange}` : `${trooper.scoreChange}`) : 'N/A'}
                            </td>
                            <td className="p-3">{trooper.totalAttempts}</td>
                            <td className="p-3">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedUserId(trooper.user.id);
                                  setDetailView("individual");
                                }}
                              >
                                View History
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Leaderboards & Extra Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Leaderboards & Extra Statistics</CardTitle>
                  <CardDescription>Top performers and station leaders</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    Average best score per person: <strong>{filteredAverageBestScore}</strong> · Pass plus rate: <strong>{filteredStats.passPlusRate}%</strong><br/>
                    Overall improvement rate: <strong>{filteredStats.overallImprovementRate}%</strong>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Top by Best Score */}
                    <div>
                      <div className="text-sm font-medium mb-2">Top 5 – Best Score</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Rank</th>
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Platoon</th>
                              <th className="text-left p-2 font-medium">Best</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStats.topBestScores.map((trooper, index) => (
                              <tr key={trooper.user.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                                <td className="p-2">{index + 1}</td>
                                <td className="p-2">{trooper.user.fullName}</td>
                                <td className="p-2">{(trooper.user as any).mspName || 'N/A'}</td>
                                <td className="p-2">{trooper.bestAttempt ? `${trooper.bestAttempt.totalScore} ${trooper.bestAttempt.result}` : 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Top by Score Improvement */}
                    <div>
                      <div className="text-sm font-medium mb-2">Top 5 – Score Improvement</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Rank</th>
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Platoon</th>
                              <th className="text-left p-2 font-medium">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStats.topImprovements.map((trooper, index) => (
                              <tr key={trooper.user.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                                <td className="p-2">{index + 1}</td>
                                <td className="p-2">{trooper.user.fullName}</td>
                                <td className="p-2">{(trooper.user as any).mspName || 'N/A'}</td>
                                <td className="p-2 text-green-600">+{trooper.scoreChange}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Station Leaders */}
                    <div>
                      <div className="text-sm font-medium mb-2">Station Leaders</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Category</th>
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-t">
                              <td className="p-2">Top Sit-ups</td>
                              <td className="p-2">{filteredStats.stationLeaders.topSitups?.user.fullName || 'N/A'}</td>
                              <td className="p-2">{filteredStats.stationLeaders.topSitups?.bestAttempt?.situps || 0} reps</td>
                            </tr>
                            <tr className="border-t bg-muted/30">
                              <td className="p-2">Top Push-ups</td>
                              <td className="p-2">{filteredStats.stationLeaders.topPushups?.user.fullName || 'N/A'}</td>
                              <td className="p-2">{filteredStats.stationLeaders.topPushups?.bestAttempt?.pushups || 0} reps</td>
                            </tr>
                            <tr className="border-t">
                              <td className="p-2">Fastest 2.4km</td>
                              <td className="p-2">{filteredStats.stationLeaders.fastestRun?.user.fullName || 'N/A'}</td>
                              <td className="p-2">{filteredStats.stationLeaders.fastestRun?.bestAttempt?.runTimeSeconds ? 
                                `${Math.floor(filteredStats.stationLeaders.fastestRun.bestAttempt.runTimeSeconds / 60)}:${(filteredStats.stationLeaders.fastestRun.bestAttempt.runTimeSeconds % 60).toString().padStart(2, '0')}` 
                                : '0:00'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* IPPT Sessions */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">IPPT Sessions (Example)</CardTitle>
                  <CardDescription>Total sessions: {commanderStats?.sessions.length || 0}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Session</th>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Attendees</th>
                          <th className="text-left p-3 font-medium">Avg Score</th>
                          <th className="text-left p-3 font-medium">Gold</th>
                          <th className="text-left p-3 font-medium">Silver</th>
                          <th className="text-left p-3 font-medium">Pass</th>
                          <th className="text-left p-3 font-medium">Fail</th>
                          <th className="text-left p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commanderStats?.sessions.map((session, index) => (
                          <tr key={session.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                            <td className="p-3">{session.name}</td>
                            <td className="p-3">{new Date(session.date).toLocaleDateString()}</td>
                            <td className="p-3">{session.totalAttendees}</td>
                            <td className="p-3">{session.avgScore}</td>
                            <td className="p-3">{session.goldCount}</td>
                            <td className="p-3">{session.silverCount}</td>
                            <td className="p-3">{session.passCount}</td>
                            <td className="p-3">{session.failCount}</td>
                            <td className="p-3">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedSessionId(session.id);
                                  setDetailView("session");
                                }}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Session Details Modal */}
              {detailView === "session" && sessionDetails && (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Session Details: {sessionDetails.name}</CardTitle>
                        <CardDescription>
                          {new Date(sessionDetails.date).toLocaleDateString()} · {sessionDetails.statistics.totalAttendees} participants
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setDetailView("none")}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Session Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{sessionDetails.statistics.averageScore}</div>
                        <div className="text-sm text-muted-foreground">Average Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{sessionDetails.statistics.goldCount}</div>
                        <div className="text-sm text-muted-foreground">Gold Awards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{sessionDetails.statistics.silverCount}</div>
                        <div className="text-sm text-muted-foreground">Silver Awards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {sessionDetails.statistics.goldCount + sessionDetails.statistics.silverCount + sessionDetails.statistics.passCount}
                        </div>
                        <div className="text-sm text-muted-foreground">Passed</div>
                      </div>
                    </div>

                    {/* All Participants */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">All Participants</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Rank</th>
                              <th className="text-left p-2 font-medium">Platoon</th>
                              <th className="text-left p-2 font-medium">Score</th>
                              <th className="text-left p-2 font-medium">Result</th>
                              <th className="text-left p-2 font-medium">Sit-ups</th>
                              <th className="text-left p-2 font-medium">Push-ups</th>
                              <th className="text-left p-2 font-medium">2.4km</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sessionDetails.attempts.map((attempt: any, index: number) => (
                              <tr key={attempt.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                                <td className="p-2">{attempt.user?.fullName || 'N/A'}</td>
                                <td className="p-2">{attempt.user?.rank || 'N/A'}</td>
                                <td className="p-2">{attempt.user?.mspName || 'N/A'}</td>
                                <td className="p-2 font-medium">{attempt.totalScore || 'N/A'}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    attempt.result === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                                    attempt.result === 'Silver' ? 'bg-gray-100 text-gray-800' :
                                    attempt.result === 'Pass' ? 'bg-blue-100 text-blue-800' :
                                    attempt.result === 'Fail' ? 'bg-red-100 text-red-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {attempt.result || 'YTT'}
                                  </span>
                                </td>
                                <td className="p-2">{attempt.situps || '-'}</td>
                                <td className="p-2">{attempt.pushups || '-'}</td>
                                <td className="p-2">
                                  {attempt.runTimeSeconds ? 
                                    `${Math.floor(attempt.runTimeSeconds / 60)}:${(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}` 
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Individual History Modal */}
              {detailView === "individual" && individualHistory && (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Individual IPPT History: {individualHistory.fullName}</CardTitle>
                        <CardDescription>
                          {individualHistory.rank} · {individualHistory.mspName} · {individualHistory.totalAttempts} attempts
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={() => setDetailView("none")}>
                        Close
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Individual Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{individualHistory.statistics.averageScore}</div>
                        <div className="text-sm text-muted-foreground">Average Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {individualHistory.statistics.bestScore || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Best Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {individualHistory.statistics.scoreChange !== undefined ? 
                            (individualHistory.statistics.scoreChange >= 0 ? `+${individualHistory.statistics.scoreChange}` : `${individualHistory.statistics.scoreChange}`) 
                            : 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">Score Change</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {individualHistory.statistics.totalAttempts}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Attempts</div>
                      </div>
                    </div>

                    {/* All Attempts History */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">All IPPT Attempts</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Date</th>
                              <th className="text-left p-2 font-medium">Session</th>
                              <th className="text-left p-2 font-medium">Score</th>
                              <th className="text-left p-2 font-medium">Result</th>
                              <th className="text-left p-2 font-medium">Sit-ups</th>
                              <th className="text-left p-2 font-medium">Push-ups</th>
                              <th className="text-left p-2 font-medium">2.4km</th>
                            </tr>
                          </thead>
                          <tbody>
                            {individualHistory.attempts.map((attempt: any, index: number) => (
                              <tr key={attempt.id} className={`border-t ${index % 2 === 1 ? 'bg-muted/30' : ''}`}>
                                <td className="p-2">{new Date(attempt.date).toLocaleDateString()}</td>
                                <td className="p-2">{individualHistory.sessions.find((s: any) => s.id === attempt.sessionId)?.name || 'N/A'}</td>
                                <td className="p-2 font-medium">{attempt.totalScore || 'N/A'}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    attempt.result === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                                    attempt.result === 'Silver' ? 'bg-gray-100 text-gray-800' :
                                    attempt.result === 'Pass' ? 'bg-blue-100 text-blue-800' :
                                    attempt.result === 'Fail' ? 'bg-red-100 text-red-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {attempt.result || 'YTT'}
                                  </span>
                                </td>
                                <td className="p-2">{attempt.situps || '-'}</td>
                                <td className="p-2">{attempt.pushups || '-'}</td>
                                <td className="p-2">
                                  {attempt.runTimeSeconds ? 
                                    `${Math.floor(attempt.runTimeSeconds / 60)}:${(attempt.runTimeSeconds % 60).toString().padStart(2, '0')}` 
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Trooper View */}
          {view === "trooper" && (
            <div>
              <div className="text-center py-16">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold">Trooper View</h2>
                  <p className="text-muted-foreground max-w-md">
                    Individual trooper IPPT tracking and progress monitoring.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

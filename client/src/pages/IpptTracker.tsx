import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { SafeUser } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp, Target, Activity, Users, Award, Medal } from "lucide-react";

export default function IpptTracker() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const [selectedGroup, setSelectedGroup] = useState("ALL");

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
    <div className="min-h-screen bg-background">
      <Navbar user={user} pageTitle="IPPT Tracker" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">IPPT Tracker</h1>
              <p className="text-muted-foreground mt-1 text-sm">Commander view for IPPT statistics and analytics</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Group (Excel-style)</label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">MSC Overall</SelectItem>
                    <SelectItem value="COMD">MSC Comds</SelectItem>
                    <SelectItem value="TROOPERS">MSC Troopers</SelectItem>
                    <SelectItem value="PLT:MSP 1">MSP 1</SelectItem>
                    <SelectItem value="PLT:MSP 2">MSP 2</SelectItem>
                    <SelectItem value="PLT:MSP 3">MSP 3</SelectItem>
                    <SelectItem value="PLT:MSP 4">MSP 4</SelectItem>
                  </SelectContent>
                </Select>
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
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-2">Total Eligible (Group)</div>
                <div className="text-2xl font-bold">5</div>
                <div className="text-sm text-muted-foreground mt-1">
                  MSC Overall · Eligible troopers in this group
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-2">Best Result Breakdown</div>
                <div className="text-sm text-muted-foreground">
                  Gold: <strong>1</strong> ·
                  Silver: <strong>2</strong> ·
                  Pass: <strong>1</strong> ·
                  Fail: <strong>0</strong> ·
                  YTT: <strong>1</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-2">Initial Result Breakdown</div>
                <div className="text-sm text-muted-foreground">
                  Gold: <strong>0</strong> ·
                  Silver: <strong>0</strong> ·
                  Pass: <strong>2</strong> ·
                  Fail: <strong>1</strong> ·
                  YTT: <strong>2</strong>
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
                  Gold: +1 (+100.0%)<br/>
                  Silver: +2 (+200.0%)<br/>
                  Pass (Gold+Silver+Pass): +3 (+60.0%)<br/>
                  Fail: -1 (-100.0%)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium mb-2">Average Best Stations</div>
                <div className="text-sm text-muted-foreground">
                  Sit-ups (best avg): <strong>36.0</strong><br/>
                  Push-ups (best avg): <strong>40.0</strong><br/>
                  2.4km (best avg): <strong>12:35</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-2">Average Best Score</div>
                <div className="text-2xl font-bold">73.3</div>
                <div className="text-sm text-muted-foreground mt-1">
                  MSC Overall · Average of troopers' best scores
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trooper Overview Table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Trooper Scores Overview</CardTitle>
              <CardDescription>One row per trooper · Best / Latest / Initial scores and improvement</CardDescription>
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
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-3">MSP 1</td>
                      <td className="p-3">3SG</td>
                      <td className="p-3">SABITIA WOON KOK HWEE</td>
                      <td className="p-3 font-medium">75 <Badge className="bg-gray-100 text-gray-700">Silver</Badge></td>
                      <td className="p-3">75 <Badge className="bg-gray-100 text-gray-700">Silver</Badge></td>
                      <td className="p-3">68 <Badge className="bg-green-100 text-green-700">Pass</Badge></td>
                      <td className="p-3 text-green-600">+7</td>
                      <td className="p-3">2</td>
                    </tr>
                    <tr className="border-t bg-muted/30">
                      <td className="p-3">MSP 1</td>
                      <td className="p-3">CPL</td>
                      <td className="p-3">MOHAMED FIRDANI</td>
                      <td className="p-3 font-medium">72 <Badge className="bg-green-100 text-green-700">Pass</Badge></td>
                      <td className="p-3">72 <Badge className="bg-green-100 text-green-700">Pass</Badge></td>
                      <td className="p-3">62 <Badge className="bg-green-100 text-green-700">Pass</Badge></td>
                      <td className="p-3 text-green-600">+10</td>
                      <td className="p-3">2</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-3">MSP 2</td>
                      <td className="p-3">PTE</td>
                      <td className="p-3">NICHOLAS CHONG LIWEI</td>
                      <td className="p-3 font-medium">78 <Badge className="bg-gray-100 text-gray-700">Silver</Badge></td>
                      <td className="p-3">78 <Badge className="bg-gray-100 text-gray-700">Silver</Badge></td>
                      <td className="p-3">55 <Badge className="bg-red-100 text-red-700">Fail</Badge></td>
                      <td className="p-3 text-green-600">+23</td>
                      <td className="p-3">3</td>
                    </tr>
                    <tr className="border-t bg-muted/30">
                      <td className="p-3">MSP 1</td>
                      <td className="p-3">3SG</td>
                      <td className="p-3">LEE EE HANK</td>
                      <td className="p-3 font-medium">90 <Badge className="bg-yellow-100 text-yellow-700">Gold</Badge></td>
                      <td className="p-3">90 <Badge className="bg-yellow-100 text-yellow-700">Gold</Badge></td>
                      <td className="p-3">88 <Badge className="bg-yellow-100 text-yellow-700">Gold</Badge></td>
                      <td className="p-3 text-green-600">+2</td>
                      <td className="p-3">2</td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-3">MSP 4</td>
                      <td className="p-3">PTE</td>
                      <td className="p-3">ALLAN CHAN</td>
                      <td className="p-3 font-medium">-</td>
                      <td className="p-3">-</td>
                      <td className="p-3">-</td>
                      <td className="p-3">-</td>
                      <td className="p-3">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leaderboards & Extra Stats</CardTitle>
              <CardDescription>Top performers and station leaders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                Avg best score per trooper: <strong>73.3</strong> · 
                Pass+ rate (best result): <strong>80.0%</strong><br/>
                Overall improvement rate (any Δ>0): <strong>75.0%</strong>
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
                          <th className="text-left p-2 font-medium">Plt</th>
                          <th className="text-left p-2 font-medium">Best</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-2">1</td>
                          <td className="p-2">LEE EE HANK</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2">90 <Badge className="bg-yellow-100 text-yellow-700 text-xs">Gold</Badge></td>
                        </tr>
                        <tr className="border-t bg-muted/30">
                          <td className="p-2">2</td>
                          <td className="p-2">NICHOLAS CHONG LIWEI</td>
                          <td className="p-2">MSP 2</td>
                          <td className="p-2">78 <Badge className="bg-gray-100 text-gray-700 text-xs">Silver</Badge></td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">3</td>
                          <td className="p-2">SABITIA WOON KOK HWEE</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2">75 <Badge className="bg-gray-100 text-gray-700 text-xs">Silver</Badge></td>
                        </tr>
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
                          <th className="text-left p-2 font-medium">Plt</th>
                          <th className="text-left p-2 font-medium">Δ Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-2">1</td>
                          <td className="p-2">NICHOLAS CHONG LIWEI</td>
                          <td className="p-2">MSP 2</td>
                          <td className="p-2 text-green-600">+23</td>
                        </tr>
                        <tr className="border-t bg-muted/30">
                          <td className="p-2">2</td>
                          <td className="p-2">MOHAMED FIRDANI</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2 text-green-600">+10</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">3</td>
                          <td className="p-2">SABITIA WOON KOK HWEE</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2 text-green-600">+7</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Station Leaders */}
                <div>
                  <div className="text-sm font-medium mb-2">Station Leaders (Best & Improvement)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Category</th>
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Plt</th>
                          <th className="text-left p-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-2">Top Sit-ups</td>
                          <td className="p-2">LEE EE HANK</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2">43 reps</td>
                        </tr>
                        <tr className="border-t bg-muted/30">
                          <td className="p-2">Top Push-ups</td>
                          <td className="p-2">LEE EE HANK</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2">46 reps</td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-2">Fastest 2.4km</td>
                          <td className="p-2">LEE EE HANK</td>
                          <td className="p-2">MSP 1</td>
                          <td className="p-2">11:50</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

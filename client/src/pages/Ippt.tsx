import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { SafeUser } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp, Target, Activity, Users, Award } from "lucide-react";

export default function IPPT() {
  const { data: user, isLoading } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const [view, setView] = useState<"trooper" | "commander">("trooper");

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
      <Navbar user={user} pageTitle="IPPT Dashboard" />
      
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">IPPT Dashboard</h1>
              <p className="text-muted-foreground mt-1 text-sm">Track Individual Physical Proficiency Test status and results</p>
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

                  {view === "trooper" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Trooper</label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select trooper" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">MSP 1 · 3SG SABITIA WOON KOK HWEE</SelectItem>
                          <SelectItem value="2">MSP 1 · CPL MOHAMED FIRDANI</SelectItem>
                          <SelectItem value="3">MSP 2 · PTE NICHOLAS CHONG LIWEI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {view === "commander" && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Group (Excel-style)</label>
                      <Select>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">MSC Overall</SelectItem>
                          <SelectItem value="COMD">MSC Comds</SelectItem>
                          <SelectItem value="TROOPERS">MSC Troopers</SelectItem>
                          <SelectItem value="PLT:MSP 1">MSP 1</SelectItem>
                          <SelectItem value="PLT:MSP 2">MSP 2</SelectItem>
                          <SelectItem value="PLT:MSP 3">MSP 3</SelectItem>
                          <SelectItem value="PLT:MSP 4">MSP 4</SelectItem>
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

          {/* Content based on view */}
          {view === "trooper" ? (
            <div>
              {/* Trooper Header */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">3SG SABITIA WOON KOK HWEE</div>
                      <div className="text-sm text-muted-foreground">
                        Platoon: MSP 1 · Rank Category: Comd · PES: B1 · Eligible: Yes
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Attempts recorded: <strong>2</strong>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Best IPPT Result</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      75
                      <Badge className="bg-gray-100 text-gray-700">Silver</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Best on 2025-03-05 (1 SIR Reg IPPT 2)
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Latest Attempt</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      75
                      <Badge className="bg-gray-100 text-gray-700">Silver</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Latest on 2025-03-05 (1 SIR Reg IPPT 2)
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground mb-2">Initial Attempt</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      68
                      <Badge className="bg-green-100 text-green-700">Pass</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Initial on 2025-01-10 (1 SIR Reg IPPT 1)
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-2">Best Stations</div>
                    <div className="text-sm text-muted-foreground">
                      Sit-ups: <strong>36</strong><br />
                      Push-ups: <strong>41</strong><br />
                      2.4km (best): <strong>12:30</strong>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-2">Progress Summary</div>
                    <div className="text-sm text-muted-foreground">
                      Improved by +7 points from initial to best.<br />
                      Latest score: 75.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-2">Attempt Notes</div>
                    <div className="text-sm text-muted-foreground">
                      Total attempts: 2. Best: 75, Initial: 68, Latest: 75.
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Attempts Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">All Attempts</CardTitle>
                  <CardDescription>Latest first.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Activity</th>
                          <th className="text-left p-3 font-medium">Total Score</th>
                          <th className="text-left p-3 font-medium">Result</th>
                          <th className="text-left p-3 font-medium">Sit-ups</th>
                          <th className="text-left p-3 font-medium">Push-ups</th>
                          <th className="text-left p-3 font-medium">2.4km</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-3">2025-03-05</td>
                          <td className="p-3">1 SIR Reg IPPT 2</td>
                          <td className="p-3 font-medium">75</td>
                          <td className="p-3">
                            <Badge className="bg-gray-100 text-gray-700">Silver</Badge>
                          </td>
                          <td className="p-3">36</td>
                          <td className="p-3">41</td>
                          <td className="p-3">12:30</td>
                        </tr>
                        <tr className="border-t bg-muted/30">
                          <td className="p-3">2025-01-10</td>
                          <td className="p-3">1 SIR Reg IPPT 1</td>
                          <td className="p-3 font-medium">68</td>
                          <td className="p-3">
                            <Badge className="bg-green-100 text-green-700">Pass</Badge>
                          </td>
                          <td className="p-3">32</td>
                          <td className="p-3">38</td>
                          <td className="p-3">12:50</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div>
              {/* Commander View Content */}
              <div className="text-center py-16">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold">Commander View</h2>
                  <p className="text-muted-foreground max-w-md">
                    Commander dashboard with group statistics, leaderboards, and IPPT sessions management.
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
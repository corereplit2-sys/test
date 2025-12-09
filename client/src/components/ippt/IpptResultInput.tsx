import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SafeUser, type IpptSession } from "@shared/schema";
import { Plus, Trash2, Save, Users, Clock, Target, Upload, FileText, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const attemptSchema = z.object({
  userId: z.string().min(1, "User is required"),
  situps: z.number().min(0).max(80, "Sit-ups must be between 0-80"),
  pushups: z.number().min(0).max(80, "Push-ups must be between 0-80"),
  runTimeMinutes: z.number().min(0).max(30, "Minutes must be 0-30"),
  runTimeSeconds: z.number().min(0).max(59, "Seconds must be 0-59"),
});

const sessionSchema = z.object({
  name: z.string().min(1, "Session name is required"),
  date: z.string().min(1, "Date is required"),
});

type AttemptFormData = z.infer<typeof attemptSchema>;
type SessionFormData = z.infer<typeof sessionSchema>;

interface ParticipantResult {
  userId: string;
  user: SafeUser;
  situps: number;
  pushups: number;
  runTimeMinutes: number;
  runTimeSeconds: number;
  calculatedScore?: number;
  result?: string;
}

interface IpptResultInputProps {
  sessionId?: string;
  onSaveComplete?: () => void;
}

export function IpptResultInput({ sessionId, onSaveComplete }: IpptResultInputProps) {
  const { toast } = useToast();
  const { data: user } = useQuery<SafeUser>({
    queryKey: ["/api/auth/me"],
    enabled: true,
  });
  const [participants, setParticipants] = useState<ParticipantResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [inputMode, setInputMode] = useState<"single" | "batch">("single");
  const [batchData, setBatchData] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessionId || "");
  const [showCreateSession, setShowCreateSession] = useState(false);

  // Get all users for participant selection
  const { data: users, isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: true,
  });

  // Get IPPT sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery<IpptSession[]>({
    queryKey: ["/api/ippt/sessions"],
    enabled: true,
  });

  const form = useForm<AttemptFormData>({
    resolver: zodResolver(attemptSchema),
    defaultValues: {
      userId: "",
      situps: 0,
      pushups: 0,
      runTimeMinutes: 10,
      runTimeSeconds: 0,
    },
  });

  const sessionForm = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      name: "",
      date: new Date().toISOString().split('T')[0],
    },
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const response = await apiRequest("POST", "/api/ippt/sessions", {
        ...data,
        date: new Date(data.date),
        createdBy: user?.id,
      });
      return response.json();
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ippt/sessions"] });
      setSelectedSessionId(newSession.id);
      setShowCreateSession(false);
      sessionForm.reset();
      toast({
        title: "Session Created",
        description: `${newSession.name} has been created`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
    },
  });

  const handleCreateSession = (data: SessionFormData) => {
    createSessionMutation.mutate(data);
  };

  // Parse batch input
  const parseBatchInput = () => {
    const lines = batchData.trim().split('\n');
    const parsedParticipants: ParticipantResult[] = [];
    
    for (const line of lines) {
      // Expected format: Name, Situps, Pushups, RunMin:RunSec
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 4) continue;
      
      const [name, situps, pushups, runTime] = parts;
      const user = users?.find(u => 
        u.fullName.toLowerCase().includes(name.toLowerCase()) ||
        u.username.toLowerCase().includes(name.toLowerCase())
      );
      
      if (!user) {
        toast({
          title: "User Not Found",
          description: `${name} - skipping`,
          variant: "destructive",
        });
        continue;
      }
      
      const [runMin, runSec] = runTime.split(':').map(t => parseInt(t) || 0);
      
      const participant: ParticipantResult = {
        userId: user.id,
        user,
        situps: parseInt(situps) || 0,
        pushups: parseInt(pushups) || 0,
        runTimeMinutes: runMin,
        runTimeSeconds: runSec,
      };
      
      parsedParticipants.push(participant);
    }
    
    return parsedParticipants;
  };

  // Process batch input
  const processBatchInput = async () => {
    const parsedParticipants = parseBatchInput();
    if (parsedParticipants.length === 0) {
      toast({
        title: "No Valid Data",
        description: "Please check your batch input format",
        variant: "destructive",
      });
      return;
    }
    
    setIsCalculating(true);
    const processedParticipants: ParticipantResult[] = [];
    
    for (const participant of parsedParticipants) {
      const scoreData = await calculateScore(participant);
      if (scoreData) {
        participant.calculatedScore = scoreData.totalScore;
        participant.result = scoreData.result;
        processedParticipants.push(participant);
      }
    }
    
    setParticipants([...participants, ...processedParticipants]);
    setBatchData("");
    setInputMode("single");
    setIsCalculating(false);
    
    toast({
      title: "Batch Processed",
      description: `${processedParticipants.length} participants added`,
    });
  };

  // Calculate score for a participant
  const calculateScore = async (participant: ParticipantResult) => {
    setIsCalculating(true);
    try {
      // Get user DOB for age calculation
      const userResponse = await apiRequest("GET", `/api/admin/users/${participant.userId}`);
      const user = await userResponse.json();
      
      if (!user.dob) {
        toast({
          title: "Error",
          description: "Participant must have a date of birth set for scoring",
          variant: "destructive",
        });
        return null;
      }

      // Calculate score using backend API
      const scoreResponse = await apiRequest("POST", "/api/ippt/calculate-score", {
        situps: participant.situps,
        pushups: participant.pushups,
        runTimeSeconds: participant.runTimeMinutes * 60 + participant.runTimeSeconds,
        dob: user.dob,
      });

      const scoreData = await scoreResponse.json();
      return scoreData;
    } catch (error) {
      toast({
        title: "Calculation Error",
        description: "Failed to calculate score",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  // Add participant to list
  const addParticipant = async (data: AttemptFormData) => {
    const selectedUser = users?.find(u => u.id === data.userId);
    if (!selectedUser) return;

    // Check if participant already exists
    if (participants.find(p => p.userId === data.userId)) {
      toast({
        title: "Duplicate Participant",
        description: "This participant is already in the list",
        variant: "destructive",
      });
      return;
    }

    const newParticipant: ParticipantResult = {
      userId: data.userId,
      user: selectedUser,
      situps: data.situps,
      pushups: data.pushups,
      runTimeMinutes: data.runTimeMinutes,
      runTimeSeconds: data.runTimeSeconds,
    };

    // Calculate score
    const scoreData = await calculateScore(newParticipant);
    if (scoreData) {
      newParticipant.calculatedScore = scoreData.totalScore;
      newParticipant.result = scoreData.result;
    }

    setParticipants([...participants, newParticipant]);
    form.reset();
    toast({
      title: "Participant Added",
      description: `${selectedUser.fullName} added to the list`,
    });
  };

  // Remove participant
  const removeParticipant = (userId: string) => {
    setParticipants(participants.filter(p => p.userId !== userId));
  };

  // Save all attempts
  const saveAttemptsMutation = useMutation({
    mutationFn: async () => {
      const attempts = participants.map(p => ({
        userId: p.userId,
        situps: p.situps,
        pushups: p.pushups,
        runTimeSeconds: p.runTimeMinutes * 60 + p.runTimeSeconds,
        sessionId: selectedSessionId || null,
      }));

      // Save each attempt
      const results = await Promise.all(
        attempts.map(attempt => 
          apiRequest("POST", "/api/ippt/attempts", attempt)
        )
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ippt/commander-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ippt/attempts"] });
      
      toast({
        title: "Success",
        description: `${participants.length} IPPT attempts saved successfully`,
      });
      
      setParticipants([]);
      onSaveComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save IPPT attempts",
        variant: "destructive",
      });
    },
  });

  const getResultColor = (result: string) => {
    switch (result) {
      case "Gold": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Silver": return "bg-gray-100 text-gray-800 border-gray-200";
      case "Pass": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-red-100 text-red-800 border-red-200";
    }
  };

  if (usersLoading) {
    return <div>Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Session Selection and Input Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            IPPT Session & Input Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">IPPT Session</Label>
              <div className="flex gap-2 mt-1">
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions?.map(session => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name} - {new Date(session.date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateSession(true)}
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Input Mode</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={inputMode === "single" ? "default" : "outline"}
                  onClick={() => setInputMode("single")}
                  size="sm"
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Single Entry
                </Button>
                <Button
                  variant={inputMode === "batch" ? "default" : "outline"}
                  onClick={() => setInputMode("batch")}
                  size="sm"
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Batch Entry
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Input Mode */}
      {inputMode === "batch" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Batch Entry
            </CardTitle>
            <CardDescription>
              Enter multiple participants at once. Format: Name, Sit-ups, Pushups, RunMin:RunSec (one per line)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="John Doe, 45, 35, 12:30&#10;Jane Smith, 50, 40, 11:45&#10;Bob Wilson, 38, 30, 13:15"
                value={batchData}
                onChange={(e) => setBatchData(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={processBatchInput}
                  disabled={!batchData.trim() || isCalculating}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Process Batch Data
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setBatchData("")}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Entry Mode */}
      {inputMode === "single" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Add Participant
            </CardTitle>
            <CardDescription>
              Enter IPPT results for each participant
            </CardDescription>
          </CardHeader>
          <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(addParticipant)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Participant</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select participant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users?.filter(u => u.role === "soldier").map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName} - {user.rank}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="situps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sit-ups (reps)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="80"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pushups"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Push-ups (reps)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="80"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="runTimeMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Run (min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="runTimeSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Run (sec)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="59"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Participant
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      )}

      {/* Participants List */}
      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Participants ({participants.length})
              </span>
              <Button
                onClick={() => saveAttemptsMutation.mutate()}
                disabled={saveAttemptsMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Save All Attempts
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{participant.user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{participant.user.rank}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Sit-ups: {participant.situps}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Push-ups: {participant.pushups}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Run: {participant.runTimeMinutes}:{participant.runTimeSeconds.toString().padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.calculatedScore && (
                      <Badge className={getResultColor(participant.result || "Fail")}>
                        {participant.calculatedScore} pts - {participant.result}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeParticipant(participant.userId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isCalculating && (
        <div className="p-4 border rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Calculating age-based scores...</p>
        </div>
      )}

      {/* Create Session Dialog */}
      {showCreateSession && (
        <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create IPPT Session</DialogTitle>
              <DialogDescription>
                Create a new IPPT session to organize attempts
              </DialogDescription>
            </DialogHeader>
            <Form {...sessionForm}>
              <form onSubmit={sessionForm.handleSubmit(handleCreateSession)} className="space-y-4">
                <FormField
                  control={sessionForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Q1 IPPT Test, Annual Fitness Assessment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={sessionForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateSession(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createSessionMutation.isPending}
                  >
                    {createSessionMutation.isPending ? "Creating..." : "Create Session"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

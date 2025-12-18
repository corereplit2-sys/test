import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SafeUser } from "@shared/schema";
import { RefreshCw } from "lucide-react";

interface OnboardingRequest {
  id: string;
  fullName: string;
  username: string;
  email: string;
  rank: string;
  serviceNumber: string;
  doe: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export default function AdminOnboarding() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<OnboardingRequest | null>(null);
  const [approvalForm, setApprovalForm] = useState({
    accountType: "soldier" as "soldier" | "commander" | "admin",
    mspName: "",
  });

  const { data: requests, isLoading } = useQuery<OnboardingRequest[]>({
    queryKey: ["/api/admin/onboarding-requests"],
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: any }) => {
      const response = await fetch(`/api/admin/onboarding-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to approve request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] });
      setSelectedRequest(null);
      alert("Request approved successfully!");
    },
    onError: (error: any) => {
      alert(`Error approving request: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      const response = await fetch(`/api/admin/onboarding-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reject request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] });
      setSelectedRequest(null);
      alert("Request rejected successfully!");
    },
    onError: (error: any) => {
      alert(`Error rejecting request: ${error.message}`);
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;

    if (!approvalForm.accountType) {
      alert("Please select an account type");
      return;
    }

    approveMutation.mutate({
      requestId: selectedRequest.id,
      data: {
        accountType: approvalForm.accountType,
      },
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;

    rejectMutation.mutate({
      requestId: selectedRequest.id,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading onboarding requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Onboarding Requests</h1>
          <Button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["/api/admin/onboarding-requests"] })
            }
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {requests?.filter((r) => r.status === "pending").length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending requests</p>
                ) : (
                  <div className="space-y-4">
                    {requests
                      ?.filter((r) => r.status === "pending")
                      .map((request) => (
                        <div
                          key={request.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedRequest?.id === request.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedRequest(request);
                            setApprovalForm({
                              accountType: "soldier",
                              mspName: "",
                            });
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{request.fullName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {request.username} • {request.rank}
                              </p>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                            <Badge variant="outline">Pending</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            {selectedRequest ? (
              <Card>
                <CardHeader>
                  <CardTitle>Review Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Request Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Name:</strong> {selectedRequest.fullName}
                      </div>
                      <div>
                        <strong>Username:</strong> {selectedRequest.username}
                      </div>
                      <div>
                        <strong>Email:</strong> {selectedRequest.email}
                      </div>
                      <div>
                        <strong>Rank:</strong> {selectedRequest.rank}
                      </div>
                      <div>
                        <strong>Service Number:</strong> {selectedRequest.serviceNumber}
                      </div>
                      <div>
                        <strong>DOE:</strong> {new Date(selectedRequest.doe).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Submitted:</strong>{" "}
                        {new Date(selectedRequest.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="accountType">Account Type *</Label>
                      <Select
                        value={approvalForm.accountType}
                        onValueChange={(value: "soldier" | "commander" | "admin") =>
                          setApprovalForm((prev) => ({ ...prev, accountType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soldier">Soldier</SelectItem>
                          <SelectItem value="commander">Commander</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                    >
                      {approveMutation.isPending ? "Approving..." : "Approve"}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Select a request to review</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

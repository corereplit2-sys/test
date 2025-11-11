import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";

export function AdminCredits() {
  const { toast } = useToast();
  const [defaultCredits, setDefaultCredits] = useState(10);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetCredits = async () => {
    setIsResetting(true);
    try {
      await apiRequest("POST", "/api/admin/credits/reset", {
        defaultCredits,
      });

      toast({
        title: "Credits reset",
        description: `All soldiers now have ${defaultCredits} credits`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowResetDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reset credits",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Credit Management</CardTitle>
        <CardDescription>Configure default credits and perform monthly reset</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xl mx-auto space-y-8">
          <div className="border rounded-md p-6 bg-muted/50">
            <h3 className="text-sm font-medium uppercase tracking-wide mb-4">
              Monthly Credit Reset
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Set the default number of credits that all soldiers will receive when you perform a monthly reset.
              This will update all soldier accounts to have the specified number of credits.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="default-credits" className="text-sm font-medium mb-2">
                  Default Monthly Credits
                </Label>
                <Input
                  id="default-credits"
                  type="number"
                  min="0"
                  step="0.5"
                  value={defaultCredits}
                  onChange={(e) => setDefaultCredits(parseFloat(e.target.value))}
                  className="h-12"
                  data-testid="input-default-credits"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Each soldier will receive this many credits per month
                </p>
              </div>

              <Button
                onClick={() => setShowResetDialog(true)}
                className="w-full h-12"
                data-testid="button-reset-credits"
              >
                Reset All Soldier Credits
              </Button>
            </div>
          </div>

          <div className="border border-destructive/50 rounded-md p-4 bg-destructive/5">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-destructive mb-2">
                  Important Notes
                </h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Resetting credits will set ALL soldier accounts to the default value</li>
                  <li>• Admin accounts are not affected by credit resets</li>
                  <li>• This action cannot be undone</li>
                  <li>• Existing bookings will not be affected</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Credits</AlertDialogTitle>
            <AlertDialogDescription>
              This will set all soldier accounts to {defaultCredits} credits. Admin accounts will not be affected.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCredits}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? "Resetting..." : "Reset Credits"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

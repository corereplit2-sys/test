import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QrCode, CheckCircle, AlertCircle } from "lucide-react";

export function QRScanner() {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ vehicleNo: string; vehicleType: string } | null>(null);

  const handleScanQR = async () => {
    if (!qrCode.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a QR code" });
      return;
    }

    setIsScanning(true);
    try {
      const response = await apiRequest("POST", "/api/currency-drives/scan", { code: qrCode.trim() });
      
      setQrCode("");
      setSuccessDialog({
        vehicleNo: response.vehicleNo,
        vehicleType: response.vehicleType,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drive-logs"] });

      setTimeout(() => setSuccessDialog(null), 3000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: error.message || "Invalid or expired QR code",
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <CardTitle>Scan Currency Drive QR Code</CardTitle>
          </div>
          <CardDescription>Scan QR code to auto-log 2km verified drive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">QR Code</label>
            <div className="flex gap-2">
              <Input
                placeholder="Scan or enter QR code..."
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScanQR()}
                disabled={isScanning}
                autoFocus
              />
              <Button onClick={handleScanQR} disabled={isScanning || !qrCode.trim()}>
                {isScanning ? "Scanning..." : "Scan"}
              </Button>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              💡 <strong>Tip:</strong> Use your phone camera to scan the QR code displayed by admin, or enter the code manually.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-6 h-6" />
              Drive Logged Successfully!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">Your 2km drive has been automatically recorded.</p>
            {successDialog && (
              <div className="bg-muted p-3 rounded text-sm">
                <p><strong>Vehicle:</strong> {successDialog.vehicleType} - {successDialog.vehicleNo}</p>
                <p><strong>Distance:</strong> 2.0 km</p>
                <p><strong>Status:</strong> ✓ Verified</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

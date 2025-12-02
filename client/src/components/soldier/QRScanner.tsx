import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QrCode, CheckCircle, Camera, X } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onClose?: () => void;
}

export function QRScanner({ onClose }: QRScannerProps = {}) {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ vehicleNo: string; vehicleType: string } | null>(null);
  const [useCameraMode, setUseCameraMode] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Initialize camera scanner
  useEffect(() => {
    if (useCameraMode && !cameraStarted) {
      startCameraScanner();
    }

    return () => {
      if (useCameraMode && cameraStarted) {
        stopCameraScanner();
      }
    };
  }, [useCameraMode, cameraStarted]);

  const startCameraScanner = async () => {
    try {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        async (decodedText: string) => {
          // Stop scanning and process the code
          await scanner.pause();
          await processQRCode(decodedText);
        },
        (error: any) => {
          // Silently ignore scanning errors
        }
      );

      scannerRef.current = scanner;
      setCameraStarted(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: error.message || "Could not access camera. Try manual entry instead.",
      });
      setUseCameraMode(false);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
      scannerRef.current = null;
      setCameraStarted(false);
    }
  };

  const processQRCode = async (code: string) => {
    setQrCode(code);
    await handleScanQR(code);
    setUseCameraMode(false);
  };

  const handleScanQR = async (code?: string) => {
    const codeToScan = code || qrCode.trim();

    if (!codeToScan) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a QR code" });
      return;
    }

    setIsScanning(true);
    try {
      const response = await apiRequest("POST", "/api/currency-drives/scan", { code: codeToScan });

      setQrCode("");
      setSuccessDialog({
        vehicleNo: response.vehicleNo,
        vehicleType: response.vehicleType,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drive-logs/my"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/qualifications/my"] });

      setTimeout(() => {
        setSuccessDialog(null);
        onClose?.();
      }, 2500);
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
          {useCameraMode ? (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <div id="qr-reader" className="w-full" style={{ minHeight: "300px" }}></div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setUseCameraMode(false)}
                  className="absolute top-2 right-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Point your camera at the QR code
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">QR Code</label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <Input
                    placeholder="Paste QR code or use camera..."
                    value={qrCode}
                    onChange={(e) => setQrCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScanQR()}
                    disabled={isScanning}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setUseCameraMode(true)} 
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      title="Use camera to scan"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Camera
                    </Button>
                    <Button 
                      onClick={() => handleScanQR()} 
                      disabled={isScanning || !qrCode.trim()}
                      className="flex-1 sm:flex-none"
                    >
                      {isScanning ? "Scanning..." : "Scan"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  💡 <strong>Tip:</strong> Click "Camera" to use your device camera, or manually paste the code.
                </p>
              </div>
            </>
          )}
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

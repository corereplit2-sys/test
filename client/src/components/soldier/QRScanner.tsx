import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Type } from "lucide-react";
import QrScanner from "qr-scanner";

interface QRScannerProps {
  onClose?: () => void;
}

export function QRScanner({ onClose }: QRScannerProps = {}) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  // Auto-start camera when component mounts
  useEffect(() => {
    startCameraScanner();
    return () => stopCameraScanner();
  }, []);

  const startCameraScanner = async () => {
    try {
      if (videoRef.current && !scannerRef.current) {
        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            await scanner.pause();
            await processQRCode(result.data);
          },
          {
            onDecodeError: () => {},
            preferredCamera: "environment",
            maxScansPerSecond: 5,
          }
        );

        scannerRef.current = scanner;
        await scanner.start();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Could not access camera. Use manual entry instead.",
      });
      setShowManualInput(true);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.destroy();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
      scannerRef.current = null;
    }
  };

  const processQRCode = async (code: string) => {
    await submitCode(code);
  };

  const submitCode = async (code: string) => {
    if (!code.trim()) return;

    setIsScanning(true);
    try {
      const response = await apiRequest("POST", "/api/currency-drives/scan", { code });

      toast({
        title: "✓ Drive Logged",
        description: `${response.vehicleType} - ${response.vehicleNo}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drive-logs/my"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/qualifications/my"] });

      setManualCode("");
      setTimeout(() => onClose?.(), 1500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Invalid QR Code",
        description: error.message || "Try another code",
      });
      // Resume scanning on error
      if (scannerRef.current) {
        await scannerRef.current.start();
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Camera Feed */}
      {!showManualInput && (
        <div className="relative rounded-lg overflow-hidden bg-black border border-muted">
          <video 
            ref={videoRef} 
            className="w-full aspect-square object-cover"
          />
          <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs font-medium pointer-events-none">
            Point camera at QR code
          </div>
        </div>
      )}

      {/* Manual Entry */}
      {showManualInput ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Paste code:</label>
          <div className="flex gap-2">
            <Input
              placeholder="QR code..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCode(manualCode)}
              disabled={isScanning}
              autoFocus
            />
            <Button 
              onClick={() => submitCode(manualCode)}
              disabled={isScanning || !manualCode.trim()}
              size="sm"
            >
              {isScanning ? "..." : "Go"}
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setShowManualInput(false);
              startCameraScanner();
            }}
            className="w-full text-xs"
          >
            Back to camera
          </Button>
        </div>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowManualInput(true)}
          className="w-full text-xs text-muted-foreground"
        >
          <Type className="w-3 h-3 mr-1" />
          Or enter manually
        </Button>
      )}
    </div>
  );
}

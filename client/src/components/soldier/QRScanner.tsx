import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { X, Type } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onClose?: () => void;
}

export function QRScanner({ onClose }: QRScannerProps = {}) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-start camera when component mounts
  useEffect(() => {
    startCameraScanner();
    return () => stopCameraScanner();
  }, []);

  const startCameraScanner = async () => {
    try {
      if (containerRef.current) {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );

        scanner.render(
          async (decodedText: string) => {
            await scanner.pause();
            await processQRCode(decodedText);
          },
          (error: any) => {
            // Silent error handling
          }
        );

        scannerRef.current = scanner;
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
        await scannerRef.current.clear();
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
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera Reader */}
      <div 
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden border border-muted"
        style={{ minHeight: "400px" }}
      >
        <div id="qr-reader" className="w-full h-full"></div>
        {!showManualInput && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-center text-white text-sm">
            Point camera at QR code
          </div>
        )}
      </div>

      {/* Manual Entry Toggle */}
      {!showManualInput ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowManualInput(true)}
          className="w-full text-muted-foreground"
        >
          <Type className="w-4 h-4 mr-2" />
          Enter code manually
        </Button>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Or paste code here:</label>
          <div className="flex gap-2">
            <Input
              placeholder="Paste QR code..."
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
            onClick={() => setShowManualInput(false)}
            className="w-full text-xs"
          >
            Back to camera
          </Button>
        </div>
      )}
    </div>
  );
}

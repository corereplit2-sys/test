import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QrCode, Trash2, Copy, Download, Eye } from "lucide-react";
import { format, addDays } from "date-fns";
import type { CurrencyDrive } from "@shared/schema";
import QRCode from "qrcode";
import jsPDF from "jspdf";

export function AdminCurrencyDrives() {
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState<"TERREX" | "BELREX">("TERREX");
  const [driveDate, setDriveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);

  const { data: drives = [], refetch } = useQuery<CurrencyDrive[]>({
    queryKey: ["/api/currency-drives"],
  });

  const { data: scanDetails = [] } = useQuery({
    queryKey: [`/api/currency-drives/${selectedDriveId}/scans`],
    enabled: !!selectedDriveId,
  });

  const handleCreateQR = async () => {
    if (!driveDate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a drive date" });
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest("POST", "/api/currency-drives", {
        vehicleType,
        date: new Date(driveDate),
      });

      toast({ title: "✓ QR Code Generated", description: `${vehicleType} - ${format(new Date(driveDate), "dd MMM yyyy")} (Expires today at 11:59 PM)` });
      setDriveDate(format(new Date(), "yyyy-MM-dd"));
      refetch();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to generate QR code" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: "QR code copied to clipboard" });
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/currency-drives/${id}`);
      toast({ title: "Deleted", description: "QR code deactivated" });
      refetch();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleDownloadPDF = async (drive: CurrencyDrive) => {
    try {
      const canvas = document.createElement("canvas");
      
      // Generate QR code to canvas
      await QRCode.toCanvas(canvas, drive.code, {
        width: 200,
        errorCorrectionLevel: "H"
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Add title with vehicle type
      pdf.setFontSize(18);
      pdf.text(`${drive.vehicleType} Currency Drive`, 105, 30, { align: "center" });
      
      // Add drive date
      pdf.setFontSize(14);
      pdf.text(format(new Date(drive.date), "dd MMM yyyy"), 105, 45, { align: "center" });

      // Add QR code image
      const qrImage = canvas.toDataURL("image/png");
      pdf.addImage(qrImage, "PNG", 40, 70, 130, 130);

      // Add code at bottom for reference
      pdf.setFontSize(10);
      pdf.text(`Code: ${drive.code}`, 105, 200, { align: "center" });

      // Save PDF
      pdf.save(`Currency-Drive-${drive.vehicleType}-${format(new Date(drive.date), "dd-MMM-yyyy")}.pdf`);
      toast({ title: "✓ PDF Downloaded", description: `${drive.vehicleType} - ${format(new Date(drive.date), "dd MMM yyyy")}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            <CardTitle>Generate Currency Drive QR Codes</CardTitle>
          </div>
          <CardDescription>Create QR codes for soldiers to scan and auto-log 2km drives. All QR codes expire at the end of the day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Vehicle Type</label>
              <Select value={vehicleType} onValueChange={(v: any) => setVehicleType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TERREX">TERREX</SelectItem>
                  <SelectItem value="BELREX">BELREX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Drive Date</label>
              <Input type="date" value={driveDate} onChange={(e) => setDriveDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreateQR} disabled={isCreating} className="w-full md:w-auto">
            {isCreating ? "Generating..." : "Generate QR Code"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active QR Codes</CardTitle>
          <CardDescription>{drives.length} active code{drives.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
                    {drives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No active QR codes</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="space-y-3 md:hidden">
                {drives.map((drive) => (
                  <div key={drive.id} className="border rounded-md p-4 hover:bg-accent">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold">{drive.vehicleType}</p>
                        <p className="text-xs text-muted-foreground">Date: {format(new Date(drive.date), "dd MMM yyyy")}</p>
                        <p className="text-xs text-muted-foreground">Scans: {drive.scans}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">{drive.code}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedDriveId(drive.id)} className="flex-1">
                        <Eye className="w-4 h-4 mr-1" />
                        Scans
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(drive)} className="flex-1">
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCopyCode(drive.code)} className="flex-1">
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(drive.id)} className="flex-1">
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-md overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left text-xs font-semibold px-4 py-2">Vehicle</th>
                      <th className="text-left text-xs font-semibold px-4 py-2">Date</th>
                      <th className="text-left text-xs font-semibold px-4 py-2">QR Code</th>
                      <th className="text-left text-xs font-semibold px-4 py-2">Scans</th>
                      <th className="text-right text-xs font-semibold px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drives.map((drive) => (
                      <tr key={drive.id} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2 font-medium">{drive.vehicleType}</td>
                        <td className="px-4 py-2 text-sm">{format(new Date(drive.date), "dd MMM yyyy")}</td>
                        <td className="px-4 py-2 font-mono text-sm">{drive.code}</td>
                        <td className="px-4 py-2">{drive.scans}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedDriveId(drive.id)} title="View scans">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(drive)} title="Download PDF">
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCopyCode(drive.code)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(drive.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Scans Detail Modal */}
      <Dialog open={!!selectedDriveId} onOpenChange={(open) => !open && setSelectedDriveId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Details</DialogTitle>
            <DialogDescription>
              Users who scanned: {(scanDetails as any[]).length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(scanDetails as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No scans yet</p>
            ) : (
              (scanDetails as any[]).map((scan: any, idx: number) => (
                <div key={idx} className="border rounded-md p-3 bg-muted/30">
                  <p className="font-medium text-sm">{scan.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(scan.scannedAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

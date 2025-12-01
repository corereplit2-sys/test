import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface MessRulesModalProps {
  open: boolean;
  onAgree: () => void;
}

const MESS_RULES = `MSC MESS & INTERVIEW ROOM – RULES AND REGULATIONS

Duty Platoon Responsibilities
Every Friday, the Duty Platoon is to incorporate Mess and Interview Room cleaning into the SBA roster to ensure both rooms remain clean, tidy, and presentable throughout the weekend.

Occupancy Limits
At any one time, the Mess is limited to a maximum of 20 personnel, and the Interview Room (cooking area) is limited to a maximum of 5 personnel.

Booking Requirement
All personnel entering the Mess must have a valid Mess booking. Personnel found occupying the Mess for an extended period without a valid booking may be barred from future entry.

Cleanliness & Waste Management
Littering is strictly prohibited. All trash is to be disposed of properly. Use the green bins where applicable.

Noise Discipline
Maintain an appropriate volume at all times. Be mindful of others utilising the space.

Consumption of Food & Drinks
Light snacks and drinks may be consumed in the Mess. Consumption must be responsible and hygienic.

Cooking Regulations
Cooking that requires the use of the microwave or stoves is authorised only in the Interview Room. Cooked food may thereafter be brought into the Mess.

Use of Cooking Appliances
Muslim and Non-Muslim cooking appliances are to be used correctly and strictly for their intended groups. Any misuse is prohibited.

Post-Use Cleanliness
All cooking appliances used must be washed or cleaned immediately after use.

Personal Hygiene Standards
Entry into the Mess is strictly prohibited for personnel who are sweaty, wet, or have not cooled down after physical activities. Personnel are to clean up and ensure they are presentable before entering.

Personal Electronic Devices (PEDs) & Music Devices
PEDs such as laptops and Chromebooks, and music devices such as guitars, are permitted in the Mess. Devices are to be stowed in lockers when not in use. Owners bear full responsibility for any loss or damage.

Cables and Extension Cords
Use cables and extension cords considerately. They are not to be placed across walkways or high-traffic areas where they may pose a tripping hazard.

Resting Protocols
Lying down is permitted on carpeted areas only. Do not lie down on non-carpeted flooring.

Clearance Before Lights Out
All personnel are to vacate both the Mess and Interview Room at least 15 minutes prior to Lights Out.

Footwear Discipline
Footwear is not permitted inside the Mess. Personnel are to enter barefoot or with socks only.`;

export function MessRulesModal({ open, onAgree }: MessRulesModalProps) {
  const [agreed, setAgreed] = useState(false);

  const handleAgree = () => {
    if (agreed) {
      onAgree();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>MSC Mess & Interview Room Rules</DialogTitle>
          <DialogDescription>
            Please read and agree to the following rules before proceeding
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {MESS_RULES}
          </div>
        </ScrollArea>

        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
            />
            <label
              htmlFor="agree"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and agree to comply with all the above rules and regulations
            </label>
          </div>

          <Button
            onClick={handleAgree}
            disabled={!agreed}
            className="w-full"
          >
            Agree & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

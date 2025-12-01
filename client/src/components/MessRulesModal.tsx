import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const hideCloseButtonStyle = `
  #mess-rules-modal > button.absolute {
    display: none !important;
  }
`;

interface MessRulesModalProps {
  open: boolean;
  onAgree: () => void;
}

const MESS_RULES = [
  "Duty Platoon Responsibilities: Every Friday, the Duty Platoon is to incorporate Mess and Interview Room cleaning into the SBA roster to ensure both rooms remain clean, tidy, and presentable throughout the weekend.",
  
  "Occupancy Limits: At any one time, the Mess is limited to a maximum of 20 personnel, and the Interview Room (cooking area) is limited to a maximum of 5 personnel.",
  
  "Booking Requirement: All personnel entering the Mess must have a valid Mess booking. Personnel found occupying the Mess for an extended period without a valid booking may be barred from future entry.",
  
  "Cleanliness & Waste Management: Littering is strictly prohibited. All trash is to be disposed of properly. Use the green bins where applicable.",
  
  "Noise Discipline: Maintain an appropriate volume at all times. Be mindful of others utilising the space.",
  
  "Consumption of Food & Drinks: Light snacks and drinks may be consumed in the Mess. Consumption must be responsible and hygienic.",
  
  "Cooking Regulations: Cooking that requires the use of the microwave or stoves is authorised only in the Interview Room. Cooked food may thereafter be brought into the Mess.",
  
  "Use of Cooking Appliances: Muslim and Non-Muslim cooking appliances are to be used correctly and strictly for their intended groups. Any misuse is prohibited.",
  
  "Post-Use Cleanliness: All cooking appliances used must be washed or cleaned immediately after use.",
  
  "Personal Hygiene Standards: Entry into the Mess is strictly prohibited for personnel who are sweaty, wet, or have not cooled down after physical activities. Personnel are to clean up and ensure they are presentable before entering.",
  
  "Personal Electronic Devices (PEDs) & Music Devices: PEDs such as laptops and Chromebooks, and music devices such as guitars, are permitted in the Mess. Devices are to be stowed in lockers when not in use. Owners bear full responsibility for any loss or damage.",
  
  "Cables and Extension Cords: Use cables and extension cords considerately. They are not to be placed across walkways or high-traffic areas where they may pose a tripping hazard.",
  
  "Resting Protocols: Lying down is permitted on carpeted areas only. Do not lie down on non-carpeted flooring.",
  
  "Clearance Before Lights Out: All personnel are to vacate both the Mess and Interview Room at least 15 minutes prior to Lights Out.",
  
  "Footwear Discipline: Footwear is not permitted inside the Mess. Personnel are to enter barefoot or with socks only."
];

export function MessRulesModal({ open, onAgree }: MessRulesModalProps) {
  const [fullyScrolled, setFullyScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFullyScrolled(false);
  }, [open]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const distanceToBottom = element.scrollHeight - (element.scrollTop + element.clientHeight);
      const isAtBottom = distanceToBottom < 20;
      setFullyScrolled(isAtBottom);
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{hideCloseButtonStyle}</style>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent id="mess-rules-modal" className="max-w-2xl max-h-[80vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <DialogTitle>MSC Mess & Interview Room Rules</DialogTitle>
              <DialogDescription>
                Please read all rules before proceeding
              </DialogDescription>
            </div>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto pr-4 space-y-3">
            {MESS_RULES.map((rule, index) => (
              <div key={index} className="text-sm text-foreground leading-relaxed">
                <span className="font-semibold">{index + 1}. </span>
                {rule}
              </div>
            ))}
          </div>

          <Button
            onClick={onAgree}
            disabled={!fullyScrolled}
            className="w-full mt-4"
          >
            {fullyScrolled ? "Agree & Continue" : "Scroll to bottom to continue"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

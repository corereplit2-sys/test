# Folder Structure Standardization

## Current Structure (Type-Based) ❌

The current structure is organized by **technical type** (components, pages, hooks):

```
client/src/
├── components/
│   ├── admin/
│   │   ├── AdminBookings.tsx
│   │   ├── AdminCurrencyDrives.tsx
│   │   ├── AdminSchedule.tsx
│   │   ├── AdminSettings.tsx
│   │   ├── AdminUserCredits.tsx
│   │   └── AdminUsers.tsx
│   ├── soldier/
│   │   └── QRScanner.tsx
│   ├── ui/
│   │   └── [30+ shadcn components]
│   ├── ChangePasswordDialog.tsx
│   ├── MessRulesModal.tsx
│   ├── Navbar.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
├── pages/
│   ├── AdminDashboard.tsx
│   ├── AdminOnboarding.tsx
│   ├── CalendarPage.tsx
│   ├── CreateConduct.tsx
│   ├── Credits.tsx
│   ├── CurrencyTracker.tsx
│   ├── DriveQR.tsx
│   ├── Ippt.tsx
│   ├── IpptTracker.tsx
│   ├── Login.tsx
│   ├── MessBooking.tsx
│   ├── MyCurrency.tsx
│   ├── Onboarding.tsx
│   ├── OnboardingSuccess.tsx
│   ├── SoldierDashboard.tsx
│   └── Users.tsx
├── hooks/
│   └── use-toast.ts
├── lib/
│   ├── ippt/
│   │   ├── calculations.ts
│   │   ├── constants.ts
│   │   └── index.ts
│   ├── queryClient.ts
│   └── utils.ts
└── types/
    └── jscanify.d.ts
```

### Problems with Current Structure:
1. ❌ **Hard to find related code** - IPPT features scattered across pages, components, and lib
2. ❌ **No clear boundaries** - Everything can import everything
3. ❌ **Difficult to understand** - New developers don't know where to look
4. ❌ **Hard to test** - Features not isolated
5. ❌ **Merge conflicts** - Many people editing same directories
6. ❌ **No code ownership** - Can't assign teams to features

---

## Proposed Structure (Feature-Based) ✅

Organize by **business feature/domain**:

```
client/src/
├── features/
│   ├── ippt/
│   │   ├── components/
│   │   │   ├── IpptAttemptForm.tsx
│   │   │   ├── IpptLeaderboard.tsx
│   │   │   ├── IpptPhotoUpload.tsx
│   │   │   ├── IpptScoreCard.tsx
│   │   │   ├── IpptSessionList.tsx
│   │   │   └── IpptStatsCard.tsx
│   │   ├── hooks/
│   │   │   ├── useIpptScoring.ts
│   │   │   ├── useIpptSessions.ts
│   │   │   └── usePhotoOCR.ts
│   │   ├── lib/
│   │   │   ├── calculations.ts
│   │   │   ├── constants.ts
│   │   │   ├── types.ts
│   │   │   └── validation.ts
│   │   ├── pages/
│   │   │   ├── IpptPage.tsx
│   │   │   └── IpptTrackerPage.tsx
│   │   └── index.ts
│   │
│   ├── bookings/
│   │   ├── components/
│   │   │   ├── BookingCalendar.tsx
│   │   │   ├── BookingList.tsx
│   │   │   ├── BookingModal.tsx
│   │   │   └── BookingStats.tsx
│   │   ├── hooks/
│   │   │   ├── useBookings.ts
│   │   │   └── useBookingSchedule.ts
│   │   ├── lib/
│   │   │   ├── constants.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── CalendarPage.tsx
│   │   │   └── MessBookingPage.tsx
│   │   └── index.ts
│   │
│   ├── currency/
│   │   ├── components/
│   │   │   ├── CurrencyCard.tsx
│   │   │   ├── CurrencyDriveList.tsx
│   │   │   ├── CurrencyHistory.tsx
│   │   │   ├── CurrencyStats.tsx
│   │   │   └── DriveQRCode.tsx
│   │   ├── hooks/
│   │   │   ├── useCurrencyDrives.ts
│   │   │   └── useCurrencyCalculations.ts
│   │   ├── lib/
│   │   │   ├── calculations.ts
│   │   │   └── constants.ts
│   │   ├── pages/
│   │   │   ├── CurrencyTrackerPage.tsx
│   │   │   ├── DriveQRPage.tsx
│   │   │   └── MyCurrencyPage.tsx
│   │   └── index.ts
│   │
│   ├── conduct/
│   │   ├── components/
│   │   │   ├── ConductForm.tsx
│   │   │   ├── ConductPhotoUpload.tsx
│   │   │   ├── ConductPreview.tsx
│   │   │   ├── ConductSignature.tsx
│   │   │   └── ConductSubmit.tsx
│   │   ├── lib/
│   │   │   ├── types.ts
│   │   │   └── validation.ts
│   │   ├── pages/
│   │   │   └── CreateConductPage.tsx
│   │   └── index.ts
│   │
│   ├── onboarding/
│   │   ├── components/
│   │   │   ├── OnboardingForm.tsx
│   │   │   ├── OnboardingList.tsx (admin)
│   │   │   └── OnboardingSuccess.tsx
│   │   ├── pages/
│   │   │   ├── AdminOnboardingPage.tsx
│   │   │   ├── OnboardingPage.tsx
│   │   │   └── OnboardingSuccessPage.tsx
│   │   └── index.ts
│   │
│   ├── credits/
│   │   ├── components/
│   │   │   ├── CreditsList.tsx
│   │   │   └── CreditsStats.tsx
│   │   ├── pages/
│   │   │   └── CreditsPage.tsx
│   │   └── index.ts
│   │
│   ├── auth/
│   │   ├── components/
│   │   │   ├── ChangePasswordDialog.tsx
│   │   │   └── LoginForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── pages/
│   │   │   └── LoginPage.tsx
│   │   └── index.ts
│   │
│   ├── users/
│   │   ├── components/
│   │   │   ├── UserList.tsx
│   │   │   ├── UserDetails.tsx
│   │   │   └── UserCreditsManager.tsx
│   │   ├── pages/
│   │   │   └── UsersPage.tsx
│   │   └── index.ts
│   │
│   └── dashboard/
│       ├── components/
│       │   ├── AdminDashboard.tsx
│       │   └── SoldierDashboard.tsx
│       ├── pages/
│       │   ├── AdminDashboardPage.tsx
│       │   └── SoldierDashboardPage.tsx
│       └── index.ts
│
├── shared/
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── ThemeProvider.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ui/
│   │       └── [shadcn components]
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── queryClient.ts
│   │   └── utils.ts
│   └── types/
│       └── jscanify.d.ts
│
├── App.tsx
├── index.css
└── main.tsx
```

---

## Benefits of Feature-Based Structure ✅

### 1. **Better Organization**
- All IPPT-related code in one place
- Easy to find what you need
- Clear feature boundaries

### 2. **Improved Collaboration**
- Teams can own features
- Less merge conflicts
- Parallel development easier

### 3. **Easier Onboarding**
- New developers find features quickly
- Clear where to add new code
- Self-documenting structure

### 4. **Better Testing**
- Features isolated and testable
- Mock dependencies at feature level
- Integration tests per feature

### 5. **Scalability**
- Easy to add new features
- Can extract features to packages
- Microservices-ready

### 6. **Code Reuse**
- Shared components clearly separated
- Feature-specific code stays local
- Barrel exports make imports clean

---

## Migration Strategy

### Phase 1: Create Structure ✅ (This Step)
1. Create new `features/` directory
2. Create subdirectories for each feature
3. Document the new structure

### Phase 2: Move Shared Code
1. Move `ui/` components to `shared/components/ui/`
2. Move `Navbar`, `ThemeToggle` to `shared/components/`
3. Move `use-toast` to `shared/hooks/`
4. Update imports

### Phase 3: Move Features (One at a Time)
1. **Start with smallest**: Auth feature
   - Move `LoginPage.tsx` → `features/auth/pages/`
   - Move `ChangePasswordDialog.tsx` → `features/auth/components/`
   - Add barrel export
   - Update imports
   - Test thoroughly

2. **Then Credits** (small feature)
   - Move `Credits.tsx` → `features/credits/pages/`
   - Add barrel export
   - Update imports

3. **Then larger features**: IPPT, Currency, Bookings, etc.
   - Move pages
   - Move components
   - Move hooks
   - Move utilities
   - Add barrel exports
   - Update all imports

### Phase 4: Update tsconfig Paths
Add path aliases for cleaner imports:

```json
{
  "paths": {
    "@/*": ["./client/src/*"],
    "@shared/*": ["./client/src/shared/*"],
    "@features/*": ["./client/src/features/*"],
    "@ippt/*": ["./client/src/features/ippt/*"],
    "@bookings/*": ["./client/src/features/bookings/*"],
    "@currency/*": ["./client/src/features/currency/*"]
  }
}
```

### Phase 5: Documentation
1. Update README with new structure
2. Document import patterns
3. Add feature ownership
4. Create contribution guide

---

## Import Patterns

### Before (Type-Based):
```typescript
import { IpptTracker } from "@/pages/IpptTracker";
import { IpptAttemptForm } from "@/components/ippt/IpptAttemptForm";
import { useIpptSessions } from "@/hooks/useIpptSessions";
import { calculateScore } from "@/lib/ippt/calculations";
```

### After (Feature-Based):
```typescript
// Option 1: Direct imports
import { 
  IpptTrackerPage,
  IpptAttemptForm,
  useIpptSessions,
  calculateScore 
} from "@/features/ippt";

// Option 2: With path alias
import { 
  IpptTrackerPage,
  IpptAttemptForm,
  useIpptSessions,
  calculateScore 
} from "@ippt";

// Shared components
import { Navbar } from "@shared/components";
import { Button } from "@shared/components/ui";
```

---

## Barrel Exports Example

Each feature should have an `index.ts` that exports public API:

```typescript
// features/ippt/index.ts

// Pages
export { IpptPage } from "./pages/IpptPage";
export { IpptTrackerPage } from "./pages/IpptTrackerPage";

// Components
export { IpptAttemptForm } from "./components/IpptAttemptForm";
export { IpptLeaderboard } from "./components/IpptLeaderboard";
export { IpptScoreCard } from "./components/IpptScoreCard";

// Hooks
export { useIpptSessions } from "./hooks/useIpptSessions";
export { useIpptScoring } from "./hooks/useIpptScoring";

// Utils (only if needed externally)
export { 
  calculateIpptScore,
  getAge,
  parseRunTimeToSeconds 
} from "./lib/calculations";

export { 
  IPPT_THRESHOLDS,
  IPPT_RESULTS 
} from "./lib/constants";

// Types (if shared)
export type {
  IpptAttempt,
  IpptSession,
  IpptScore
} from "./lib/types";
```

---

## Feature Ownership

Once restructured, features can have clear owners:

| Feature | Team/Owner | Lines | Status |
|---------|-----------|-------|--------|
| **ippt** | Training Team | 6000+ | 🔴 Needs refactoring |
| **bookings** | Logistics Team | 1000+ | 🟡 Good |
| **currency** | Admin Team | 1700+ | 🟡 Good |
| **conduct** | Discipline Team | 2500+ | 🟠 Needs work |
| **onboarding** | HR Team | 800+ | 🟢 Clean |
| **auth** | Security Team | 300+ | 🟢 Clean |
| **users** | Admin Team | 500+ | 🟢 Clean |

---

## Migration Timeline

### Immediate (This Step):
- ✅ Create structure documentation
- ✅ Propose new organization
- ⏳ Get team buy-in

### Week 1:
- Create `features/` directory structure
- Move shared components
- Update tsconfig paths

### Week 2-3:
- Migrate small features (auth, credits)
- Test thoroughly
- Update documentation

### Week 4-6:
- Migrate large features (IPPT, bookings, currency)
- Refactor during migration
- Update all imports

### Week 7:
- Clean up old directories
- Update documentation
- Final testing

**Total Time:** ~7 weeks (with careful, incremental migration)

---

## Risks & Mitigation

### Risks:
1. **Breaking changes** - Imports will break
2. **Merge conflicts** - Many files moving
3. **Testing overhead** - Everything needs retesting
4. **Team confusion** - New structure to learn

### Mitigation:
1. **Incremental migration** - One feature at a time
2. **Communication** - Team meetings, documentation
3. **Automated testing** - Ensure nothing breaks
4. **Pair programming** - Help team learn new structure
5. **Code freeze** - During major migrations
6. **Rollback plan** - Keep old structure until confirmed working

---

## Success Metrics

### Before:
- Files organized by type
- Hard to find related code
- No clear feature boundaries
- Difficult to test features

### After:
- Files organized by feature
- Easy to find related code
- Clear feature boundaries
- Easy to test features
- Better code ownership
- Faster development

---

## Example Feature Structure

Here's what the IPPT feature would look like fully implemented:

```
features/ippt/
├── components/
│   ├── IpptAttemptForm.tsx          # Form for recording attempts
│   ├── IpptAttemptForm.test.tsx     # Unit tests
│   ├── IpptLeaderboard.tsx          # Leaderboard display
│   ├── IpptLeaderboard.test.tsx
│   ├── IpptPhotoUpload.tsx          # OCR photo upload
│   ├── IpptScoreCard.tsx            # Individual score card
│   ├── IpptSessionList.tsx          # List of sessions
│   └── IpptStatsCard.tsx            # Statistics display
├── hooks/
│   ├── useIpptScoring.ts            # Score calculation hook
│   ├── useIpptScoring.test.ts
│   ├── useIpptSessions.ts           # Sessions CRUD hook
│   └── usePhotoOCR.ts               # OCR processing hook
├── lib/
│   ├── calculations.ts              # Score calculations
│   ├── calculations.test.ts
│   ├── constants.ts                 # IPPT constants
│   ├── types.ts                     # TypeScript types
│   └── validation.ts                # Input validation
├── pages/
│   ├── IpptPage.tsx                 # Simple IPPT page
│   └── IpptTrackerPage.tsx          # Main tracker page
├── index.ts                         # Barrel export
└── README.md                        # Feature documentation
```

---

## Next Steps

### Immediate:
1. Review this proposal with team
2. Get approval for migration
3. Create migration plan

### This PR:
1. Create basic structure
2. Move one small feature as example
3. Update documentation

### Future PRs:
1. Migrate features incrementally
2. Update imports gradually
3. Test thoroughly at each step

---

**Created:** December 16, 2025  
**Status:** Proposal ready for review  
**Estimated Time:** 7 weeks for full migration  
**Priority:** Medium (can do incrementally)

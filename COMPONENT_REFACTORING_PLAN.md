# Component Simplification & Refactoring Plan

## Overview
This document outlines the strategy for breaking down large, monolithic components into smaller, more maintainable pieces.

---

## Priority Files for Refactoring

### 1. IpptTracker.tsx (5,864 lines) 🔴 CRITICAL
**Current State:**
- Single massive component with everything mixed together
- Helper functions, business logic, and UI all in one file
- Difficult to maintain, test, and debug
- 25+ TypeScript errors concentrated here

**Target Structure:**
```
client/src/
├── pages/
│   └── IpptTracker.tsx (main page, ~500 lines)
├── components/ippt/
│   ├── IpptSessionList.tsx
│   ├── IpptAttemptForm.tsx
│   ├── IpptStatsCard.tsx
│   ├── IpptLeaderboard.tsx
│   ├── IpptPhotoUpload.tsx
│   └── IpptScoreCalculator.tsx
├── lib/ippt/
│   ├── calculations.ts ✅ CREATED
│   ├── constants.ts ✅ CREATED
│   ├── types.ts
│   └── index.ts ✅ CREATED
└── hooks/
    ├── useIpptSessions.ts
    ├── useIpptScoring.ts
    └── usePhotoOCR.ts
```

**Extraction Plan:**

#### Phase 1: Extract Utilities (✅ DONE)
- [x] Create `lib/ippt/calculations.ts`
  - `getAge()` - Calculate age from DOB
  - `parseRunTimeToSeconds()` - Convert time string to seconds
  - `formatRunTime()` - Convert seconds to MM:SS
  - `calculateIpptScore()` - Fetch and calculate scores
  - `validateIpptAttempt()` - Validate input values
- [x] Create `lib/ippt/constants.ts`
  - Azure configuration
  - IPPT thresholds and results
  - Maximum values
  - Color helpers
- [x] Create barrel export `lib/ippt/index.ts`

#### Phase 2: Extract Custom Hooks (TODO)
- [ ] Create `hooks/useIpptSessions.ts`
  - Fetch sessions query
  - Create session mutation
  - Delete session mutation
  - Update session mutation
- [ ] Create `hooks/useIpptScoring.ts`
  - Calculate score logic
  - Validate attempt logic
  - Score matrix caching
- [ ] Create `hooks/usePhotoOCR.ts`
  - Azure OCR integration
  - Photo upload logic
  - Text extraction

#### Phase 3: Extract Components (TODO)
- [ ] Create `IpptSessionList.tsx` (~300 lines)
  - Display list of IPPT sessions
  - Session cards with attempts
  - Edit/delete functionality
- [ ] Create `IpptAttemptForm.tsx` (~200 lines)
  - Form for creating/editing attempts
  - Input validation
  - Score calculation preview
- [ ] Create `IpptStatsCard.tsx` (~150 lines)
  - Individual stats display
  - Best scores
  - Average scores
  - Trends
- [ ] Create `IpptLeaderboard.tsx` (~200 lines)
  - Top performers
  - Group rankings
  - Improvement tracking
- [ ] Create `IpptPhotoUpload.tsx` (~150 lines)
  - Camera/file input
  - OCR processing
  - Result preview

#### Phase 4: Refactor Main Component (TODO)
- [ ] Update `IpptTracker.tsx` to use extracted pieces
- [ ] Remove duplicated code
- [ ] Fix TypeScript errors
- [ ] Add proper types

---

### 2. CreateConduct.tsx (2,445 lines) 🟠 HIGH PRIORITY
**Current State:**
- Complex form with many fields
- Multiple modals and dialogs
- Photo upload and processing
- Signature collection

**Target Structure:**
```
client/src/
├── pages/
│   └── CreateConduct.tsx (main page, ~400 lines)
├── components/conduct/
│   ├── ConductForm.tsx
│   ├── ConductPhotoUpload.tsx
│   ├── ConductSignature.tsx
│   ├── ConductPreview.tsx
│   └── ConductSubmit.tsx
└── lib/conduct/
    ├── validation.ts
    └── types.ts
```

**Benefits:**
- Easier form testing
- Reusable photo upload component
- Cleaner validation logic
- Better type safety

---

### 3. CurrencyTracker.tsx (1,701 lines) 🟡 MEDIUM PRIORITY
**Current State:**
- Currency calculation logic mixed with UI
- Multiple views (admin/soldier/commander)
- Complex state management

**Target Structure:**
```
client/src/
├── pages/
│   └── CurrencyTracker.tsx (main page, ~300 lines)
├── components/currency/
│   ├── CurrencyList.tsx
│   ├── CurrencyCard.tsx
│   ├── CurrencyStats.tsx
│   └── CurrencyHistory.tsx
└── lib/currency/
    ├── calculations.ts
    └── constants.ts
```

---

### 4. MessBooking.tsx (1,019 lines) 🟢 LOWER PRIORITY
**Current State:**
- Calendar integration
- Booking management
- Credit system

**Target Structure:**
```
client/src/
├── pages/
│   └── MessBooking.tsx (main page, ~400 lines)
├── components/booking/
│   ├── BookingCalendar.tsx
│   ├── BookingModal.tsx
│   ├── BookingList.tsx
│   └── BookingStats.tsx
└── lib/booking/
    └── utils.ts
```

---

## Refactoring Principles

### 1. Single Responsibility
Each component should do ONE thing well:
- ✅ Good: `IpptAttemptForm` - handles form input
- ❌ Bad: `IpptTracker` - does everything

### 2. Extract from Bottom Up
Start with the smallest, most isolated pieces:
1. Utility functions → `lib/`
2. Custom hooks → `hooks/`
3. Leaf components → `components/`
4. Container components → `pages/`

### 3. Keep Components Small
**Target sizes:**
- Utility functions: <50 lines
- Components: <200 lines
- Pages: <500 lines
- Hooks: <100 lines

### 4. Use Barrel Exports
Make imports cleaner:
```typescript
// Before
import { getAge } from "@/pages/IpptTracker";
import { calculateScore } from "@/pages/IpptTracker";

// After
import { getAge, calculateScore } from "@/lib/ippt";
```

### 5. Co-locate Related Code
Keep related files together:
```
components/ippt/
├── IpptCard.tsx
├── IpptCard.test.tsx
├── IpptCard.stories.tsx
└── IpptCard.module.css
```

---

## Testing Strategy

### After Extraction
Each extracted piece should be testable:

```typescript
// lib/ippt/calculations.test.ts
describe("getAge", () => {
  it("calculates age correctly", () => {
    const dob = new Date("1990-01-01");
    expect(getAge(dob)).toBe("34");
  });
});

// components/ippt/IpptAttemptForm.test.tsx
describe("IpptAttemptForm", () => {
  it("validates sit-up input", () => {
    // Test form validation
  });
});
```

---

## Migration Path

### Step-by-Step Process:

1. **Extract utilities first** ✅ DONE
   - No dependencies
   - Easy to test
   - Immediate benefit

2. **Create new components**
   - Build alongside existing code
   - Test thoroughly
   - Don't break existing functionality

3. **Gradually replace old code**
   - One section at a time
   - Keep app working
   - Run tests after each change

4. **Remove old code**
   - Once new code is stable
   - All tests passing
   - Team review completed

### Example Migration:

```typescript
// IpptTracker.tsx - Before
function IpptTracker() {
  const getAge = (dob: Date) => { ... }
  const calculateScore = () => { ... }
  
  return (
    <div>
      {/* 5000 lines of JSX */}
    </div>
  );
}

// IpptTracker.tsx - After Phase 1
import { getAge, calculateScore } from "@/lib/ippt";

function IpptTracker() {
  return (
    <div>
      {/* Still 5000 lines but using utilities */}
    </div>
  );
}

// IpptTracker.tsx - After Full Refactor
import { IpptSessionList, IpptStatsCard, IpptLeaderboard } from "@/components/ippt";
import { useIpptSessions } from "@/hooks/useIpptSessions";

function IpptTracker() {
  const { sessions, isLoading } = useIpptSessions();
  
  return (
    <div>
      <IpptStatsCard />
      <IpptSessionList sessions={sessions} />
      <IpptLeaderboard />
    </div>
  );
}
```

---

## Benefits of Refactoring

### Immediate Benefits:
- ✅ **Easier to understand** - Each file has clear purpose
- ✅ **Faster to locate bugs** - Smaller files, clearer logic
- ✅ **Better IDE performance** - Smaller files load faster
- ✅ **Cleaner imports** - Barrel exports, no circular dependencies

### Long-term Benefits:
- ✅ **Testable code** - Each piece can be unit tested
- ✅ **Reusable components** - Use across different pages
- ✅ **Easier onboarding** - New developers can understand quickly
- ✅ **Better type safety** - Proper types for each module
- ✅ **Faster development** - Less cognitive load

---

## Estimated Timeline

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1 | Extract IPPT utilities | 30 min | ✅ DONE |
| 2 | Extract IPPT hooks | 1 hour | HIGH |
| 3 | Extract IPPT components | 2 hours | HIGH |
| 4 | Refactor IpptTracker main | 1 hour | HIGH |
| 5 | Extract Conduct components | 2 hours | MEDIUM |
| 6 | Extract Currency components | 1.5 hours | MEDIUM |
| 7 | Extract Booking components | 1 hour | LOW |
| **TOTAL** | | **9 hours** | |

**Recommended Approach:** 
- Do incrementally over multiple PRs
- 1-2 hours per session
- Test thoroughly between changes

---

## Success Metrics

### Before Refactoring:
- IpptTracker.tsx: 5,864 lines
- 25 TypeScript errors in this file
- Hard to test
- Hard to maintain

### After Refactoring:
- IpptTracker.tsx: <500 lines
- 0 TypeScript errors
- 90%+ test coverage
- Easy to maintain

---

## Next Steps

### Immediate (This Session):
1. ✅ Extract utility functions
2. ✅ Extract constants
3. ✅ Create documentation

### Short-term (Next PR):
1. Extract custom hooks
2. Create first component extraction
3. Update imports in main file

### Long-term (Future PRs):
1. Complete all component extractions
2. Add comprehensive tests
3. Document component API
4. Create Storybook stories

---

**Created:** December 16, 2025  
**Status:** Phase 1 complete, utilities extracted  
**Next:** Extract custom hooks and begin component extraction

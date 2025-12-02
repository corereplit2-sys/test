# MSC DRIVr v2

## Project Overview
Dual-purpose platform combining mess room booking and driver currency tracking for Army company personnel. Soldiers can book time slots using credits AND maintain vehicle qualifications through drive logs. Admins manage both systems comprehensively.

## Architecture
- **Frontend**: React SPA with TanStack Query, Wouter routing, Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Storage**: PostgreSQL database with Drizzle ORM
- **Calendar**: FullCalendar for interactive booking interface

## Key Features
1. **User Authentication**: Session-based auth for soldiers and admins
2. **Credit System**: 1 credit = 1 hour, automatic deduction on booking
3. **Smart Cancellation**: >24h = full refund, ≤24h = no refund
4. **Capacity Management**: 20-person limit per time slot with color-coded availability
5. **Admin Dashboard**: User management, booking oversight, credit resets
6. **Interactive Calendar**: FullCalendar with drag-to-book functionality

## User Roles
- **Soldier**: Book mess room, view credits, manage own bookings
- **Commander**: View-only access to admin-level data (currency tracker, all bookings), cannot edit/create bookings or modify credits
- **Admin**: Full system management, user CRUD, credit adjustments, view all bookings, booking cancellation

## Default Accounts
- Admin: `admin` / `admin123`
- Soldiers: `soldier1`, `soldier2`, `soldier3` / `password123` (each with 10 credits)

## Driver Currency Tracker
The system now includes comprehensive driver qualification management:

### Features
1. **88-Day Rolling Window**: Currency calculated from qualified date, extended by ≥2km cumulative driving within the validity period
2. **Multi-Vehicle Support**: Tracks Terrex and Belrex qualifications separately per soldier
3. **Real-Time Status**: GREEN (>30 days), AMBER (15-30 days), RED (<15 days/expired)
4. **Drive Log Management**: Soldiers submit drives with initial/final mileage for audit trail
5. **Automatic Recalculation**: Currency updates immediately when drive logs are added/deleted

### Soldier Features (My Currency Page)
- View all vehicle qualifications with status badges
- See days remaining until currency expiry
- Submit drive logs with vehicle details (type, vehicle no., date, initial/final mileage, remarks)
- View complete drive history sorted by date

### Admin Features (Currency Tracker Page)
- Company-wide qualification table with filters:
  - MSP dropdown (filter by unit)
  - Vehicle Type (TERREX/BELREX/All)
  - Status (CURRENT/EXPIRING_SOON/EXPIRED/All)
  - Name search
- Click any qualification to view detailed drive log history
- Add/delete drive logs for any soldier
- Create new qualifications with qualified date (auto-calculates 88-day expiry)
- Dashboard shows currency stats: Total Qualifications, Current, Expiring Soon, Expired (with percentages)

### Currency Calculation Logic
- **Initial Currency**: 88 days from qualified date
- **Extension**: Logging ≥2km cumulative distance within validity period extends currency by 88 days from last drive
- **Status Thresholds**:
  - CURRENT (Green): >30 days remaining
  - EXPIRING_SOON (Amber): 15-30 days remaining
  - EXPIRED (Red): <15 days or past expiry date
- Currency automatically recalculates on drive log changes (add/delete)

## Recent Changes (December 2025)
- **Currency Tracker UI Reorganization** (Latest):
  - **Tabbed Interface**: Split Currency Tracker page into two main tabs:
    - **Tab 1: Driver Qualifications** - All qualifications, filters, search, and MSP/Vehicle breakdowns
    - **Tab 2: QR Code Generator** (admins only) - Dedicated space for QR code management
  - **Cleaner Layout**: QR code manager moved to separate tab for less visual clutter
  - **Better UX**: Users can focus on either qualifications OR QR codes without distraction
  - Tabs use Shadcn UI Tabs component with smooth transitions
  - QR Code tab only visible to admin users
- **QR Code Currency Drive System - Enhanced**:
  - **Double-scan Prevention**: Created `currencyDriveScans` table to track which soldier scanned which QR code
    - Unique constraint prevents same user from scanning same QR twice
    - Returns error "You have already scanned this QR code" on duplicate attempts
    - Persists across sessions/devices (stored in database, not browser)
  - **Scan Count Sync**: Database query ensures card count always matches popup list
    - Queries actual currencyDriveScans table records instead of incremented counter
    - Updated on every scan to reflect real state
  - **Confirmation Page**: Beautiful green success screen displays after scanning showing:
    - ✓ Drive Logged Successfully message
    - Vehicle Type (TERREX/BELREX)
    - MID (vehicle number)
    - "Show this screen to your commander" instruction
  - **Auto-Deletion**: Expired QR codes and their scan logs automatically delete when next accessed
    - Cascade delete removes all related scan records
    - Saves database space without manual intervention
  - **PDF Download**: Generate printable QR codes with title format:
    - Line 1: TERREX/BELREX Currency Drive
    - Line 2: Date (dd MMM yyyy)
    - Line 3: MID [vehicle number]
    - Large QR code (130x130mm) for easy scanning
  - **Scan Count Tracking**: Admin view shows total scans per QR code
  - Admin can generate QR codes with vehicle type, number, and expiration dates
  - Soldiers access QR scanner via icon button on "My Currency" page (opens in modal)
  - Scanning auto-logs 2km verified drive with immediate currency recalculation
  - API endpoints: POST /api/currency-drives (create), GET /api/currency-drives (list), POST /api/currency-drives/scan (verify), DELETE /api/currency-drives/:id
  - QRScanner component accepts onClose prop for modal integration
  - Cleaner UI: QR scanner button in header next to "Log Drive" button

## Previous Changes (November 2025)
- **Commander Bookings Access**:
  - Commanders can now access the "Bookings" tab in Mess Booking page (view-only)
  - Removed "How to book" instructions and booking rules for admin/commander roles
  - Removed capacity legend for admin/commander roles (only visible for soldiers)
  - AdminBookings component shows all bookings with search functionality for commanders
- **Driver Currency Tracker Integration**:
  - Added 3 new database tables: MSP, DriverQualification, DriveLog
  - Extended users table with MSP assignment and rank fields
  - Built 88-day rolling window currency calculator with ≥2km threshold
  - Created "My Currency" page for soldiers to view qualifications and submit drive logs
  - Created "Currency Tracker" admin page with filters, drill-down views, and full management
  - Reorganized navigation: Soldiers (Dashboard, Calendar, My Currency), Admins (Dashboard, Calendar, Currency Tracker, Mess Booking, Users)
  - Separated Mess Booking management into dedicated admin page
  - Updated both dashboards to show mess booking AND driver currency statistics
  - Seeded 6 MSPs (MSP 1-5 + HQ) in database
- **Purple Brand Color & Calendar Fixes** (Latest):
  - Changed primary/button color to purple (270° hue) - all buttons now purple
  - Fixed calendar timezone issue: Now correctly shows 06:00-22:00 instead of 16:00-23:00
  - Fixed capacity background colors visibility on calendar (green/yellow/red indicators)
  - Added `timeZone="local"` to FullCalendar for proper local time display
  - Calendar now uses 24-hour format without colons (1800 instead of 6:00 PM)
  - Increased capacity indicator opacity to 0.6 for better visibility in both light and dark modes
  - Fixed calendar header text visibility in dark mode
- **Dark Mode & Purple Accent**:
  - Implemented dark mode with ThemeProvider and ThemeToggle (Moon/Sun icons)
  - Default theme set to dark mode
  - Changed accent color to purple (270° hue) for both light and dark modes
  - Theme persists in localStorage with SSR safety guards
- **UI Enhancements**:
  - Added color-coded capacity legend to calendar page
  - Rebranded from "Coy Mess Room Booking System" to "MSC DRIVr v2 Booking Platform"
  - Fixed apiRequest return type to properly handle JSON responses
- **Weekly Booking Release Schedule**:
  - Calendar restricted to show only ONE week at a time (week view only)
  - **Week structure: Sunday-Saturday** (7 days starting from Sunday)
  - Admin-configurable release day (Sunday-Saturday) determines when next week becomes visible
  - Logic: Before release day = view current week; On/after release day = view next week
  - Removed month/day views and all calendar navigation (prev/next/today buttons)
  - New "Schedule" tab in admin dashboard to configure release day
  - **Today shows capacity-based colors** (green/yellow/red) instead of uniform yellow
  - Double-booking prevention: Users cannot book the same time slot twice
- **Database Migration**: Migrated from in-memory storage to PostgreSQL with Drizzle ORM for data persistence
- **Capacity System**: Implemented 20-person concurrent booking limit per time slot
- **Duration Enforcement**: Strict 60-minute booking validation (rejects 90+ minute bookings)
- **1-Hour Booking Blocks**: Calendar enforces exactly 1-hour time slots (users can only select 1-hour increments)
- **Visual Capacity Indicators**: 
  - Color-coded availability badges in booking modal (green <15, yellow 15-19, red 20/full)
  - Color-coded calendar backgrounds showing availability directly on FullCalendar view
- **Overlap Detection**: Fixed to allow back-to-back bookings while preventing true overlaps
- Dark mode support with purple accent color scheme (270° hue)
- Material Design-inspired UI with military aesthetic
- Responsive design across all breakpoints
- Complete admin panel with tabs for Users, Bookings, Credits, Schedule
- Capacity legend on calendar showing availability indicators

## Technical Decisions
- PostgreSQL database with Drizzle ORM for persistent, production-ready storage
- Strict overlap detection: `booking.start < new.end AND booking.end > new.start`
- Exclusion filter uses `ne()` operator to allow concurrent booking counts during updates
- Inter font for professional look, Roboto Mono for data/numbers
- **Purple theme**: Primary/button color (270° hue), accent backgrounds for cards
- FullCalendar configured with `timeZone="local"` and 24-hour format (hour12: false)
- Dark mode as default theme with localStorage persistence
- Credits rounded up to nearest whole hour

## Booking Rules
- **Duration**: Exactly 60 minutes (validated with `differenceInMinutes === 60`)
- **Capacity**: Maximum 20 concurrent bookings per time slot
- **Overlap**: No overlapping bookings; back-to-back allowed (e.g., 15:00-16:00 then 16:00-17:00)
- **Future Only**: Bookings must be in the future
- **Credits**: 1 credit deducted immediately on booking creation
- **Refund Policy**: >24h cancellation = full refund, ≤24h = no refund

## Calendar Features
- **1-Hour Time Blocks**: Calendar displays 1-hour slots only (6:00-22:00), users can only book in 1-hour increments
- **Real-Time Capacity Colors**: Background colors on calendar show availability at a glance
  - **Green background** (rgba(34, 197, 94, 0.15)): <15 bookings - Good availability
  - **Yellow background** (rgba(234, 179, 8, 0.15)): 15-19 bookings - Limited availability
  - **Red background** (rgba(239, 68, 68, 0.15)): 20 bookings - Full slot
- **Auto-Updates**: Background colors refresh automatically when:
  - User navigates to different week/day/month
  - New bookings are created
  - Bookings are cancelled
- **Performance**: Capacity calculated locally from loaded bookings (no API spam)

## Capacity Display (Booking Modal)
- **Green Badge (<15 bookings)**: "Good availability - X spots available" with green color (text, icon, border, background)
- **Yellow Badge (15-19 bookings)**: "Limited availability - only X spots remaining!" with yellow/secondary color
- **Red Badge (20 bookings)**: "This time slot is full" with red/destructive color, booking button disabled

## Monthly Credit Reset
Admins can configure default monthly credits and reset all soldier accounts to that value. This is useful for monthly allowance management.

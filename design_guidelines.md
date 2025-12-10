# Design Guidelines: Army Company Mess Room Booking System

## Design Approach: System-Based (Utilitarian)

**Selected System**: Material Design with enterprise modifications
**Rationale**: This is a functional booking tool for military personnel requiring clarity, efficiency, and quick task completion. The design prioritizes usability over aesthetics, with clean data presentation and straightforward workflows.

**Core Principles**:
- Clarity over decoration
- Efficient information density
- Consistent, predictable patterns
- Professional military aesthetic
- Maximum readability and accessibility

---

## Typography System

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: 'Roboto Mono' for data/numbers

**Hierarchy**:
- Page Titles: text-3xl font-bold (soldiers/admin dashboard headers)
- Section Headers: text-xl font-semibold (table headers, card titles)
- Subsection/Labels: text-sm font-medium uppercase tracking-wide
- Body Text: text-base font-normal (tables, descriptions)
- Small Text: text-sm (metadata, timestamps)
- Data/Numbers: text-lg font-mono font-semibold (credits display, booking counts)

---

## Layout & Spacing System

**Container Strategy**:
- Max-width: `max-w-7xl mx-auto` for main content areas
- Narrow forms: `max-w-2xl mx-auto` for login, user creation
- Full-width: Calendar and admin tables use full container width

**Spacing Primitives** (Tailwind units):
- Micro spacing: `2, 3` (between related elements)
- Standard spacing: `4, 6` (cards, form fields)
- Section spacing: `8, 12` (between major sections)
- Page padding: `px-4 md:px-6` horizontal, `py-6 md:py-8` vertical

**Grid Systems**:
- Admin dashboard cards: `grid grid-cols-1 md:grid-cols-3 gap-6`
- User list: Full-width responsive table
- Forms: Single column, label-above-input pattern

---

## Component Library

### Navigation
**Top Navbar** (All pages):
- Fixed top, full width with subtle border-bottom
- Left: "Coy Mess Room" wordmark (text-lg font-bold)
- Center: Current page title (hidden on mobile)
- Right: User info dropdown showing name + role badge + credits (soldiers only) + logout
- Height: `h-16`, padding: `px-6`

### Authentication
**Login Page**:
- Centered card layout: `max-w-md mx-auto mt-20`
- Military-themed header with unit designation placeholder
- Username and password fields with clear labels
- Full-width submit button
- No hero image - keep it functional and fast-loading

### Soldier Dashboard
**Layout Structure**:
- Top stats bar: Single row showing "Mess Credits" in large data display (text-4xl font-mono)
- Two-column grid below stats:
  - Left (60%): "Upcoming Bookings" table
  - Right (40%): Quick actions card with "Book Mess Room" button + booking rules summary
- Mobile: Stack to single column

**Upcoming Bookings Table**:
- Columns: Date, Time Range, Duration, Status, Actions
- Status badges: Small pills with "Active" or "Cancelled" text
- Action: "Cancel" button (only if >24h away)
- Empty state: Centered message "No upcoming bookings"

### Calendar Page (FullCalendar)
**Layout**:
- Full-width calendar with toolbar showing month/week/day views
- Calendar takes majority of viewport height (`min-h-[600px]`)
- Top instruction banner: "Click and drag to create a booking" (dismissible)
- Event display: Show soldier name (if admin) or just time range (if soldier viewing)

**Booking Modal**:
- Bootstrap modal, `max-w-lg`
- Header: "Confirm Booking"
- Body: Start time, end time (readonly displays), duration calculation, credits required
- Footer: "Cancel" and "Confirm Booking" buttons
- Credit warning if insufficient: Red alert box above footer

**Event Details Modal** (on click):
- Show: Time range, soldier name (if admin), credits charged, status
- Footer: "Cancel Booking" button (if allowed) with refund policy reminder text

### Admin Dashboard
**Stats Cards** (top of page):
- 3-column grid: Total Users | Active Bookings Today | Credits Issued This Month
- Each card: Large number (text-3xl), small label below (text-sm uppercase)
- Card padding: `p-6`, border and subtle shadow

**Navigation Tabs**:
- Horizontal tab bar below stats: Users | Bookings | Credits
- Active tab highlighted with bottom border

### Admin: User Management
**User Table**:
- Columns: Name, Username, Role Badge, Credits (mono font), Actions
- Role badge: Small colored pill (Admin in gold, Soldier in blue)
- Actions: Edit icon, Delete icon
- Top-right: "+ Add User" button
- Search/filter bar above table

**User Form** (Create/Edit):
- Two-column layout on desktop: Left (personal info), Right (account settings)
- Fields: Full Name, Username, Password, Role (dropdown), Initial Credits
- Mobile: Stack to single column

### Admin: Bookings View
**Filter Bar**:
- Date range picker (start/end), Soldier dropdown (multi-select), Status filter
- "Apply Filters" button, "Clear" link

**Bookings Table**:
- Columns: Soldier, Date, Start Time, End Time, Duration, Credits, Status, Actions
- Sortable headers
- Cancel button in actions column
- Pagination at bottom if many bookings

### Admin: Credits Management
**Configuration Section**:
- Single centered card `max-w-xl`
- Input: "Default Monthly Credits" (number field)
- Large "Reset All Credits" button with confirmation modal
- Warning text explaining reset action

**Credit Adjustment** (per user):
- Integrated into user edit form
- Current credits display + adjustment input (can add/subtract)
- Transaction log below showing recent adjustments

---

## Forms & Inputs

**Standard Form Field**:
- Label: `text-sm font-medium mb-2` above input
- Input: `h-12` height, `px-4` padding, border with focus state
- Helper text: `text-sm` below field
- Error state: Red border + red helper text

**Buttons**:
- Primary: Large, full visual weight for main actions
- Secondary: Outlined style for cancel/back actions  
- Danger: Red variant for delete/cancel booking
- Sizes: Default `h-12 px-6`, Small `h-10 px-4`

---

## Data Display

**Tables**:
- Header row: Slightly elevated background, `text-sm font-semibold uppercase`
- Row padding: `py-3 px-4`
- Borders: Horizontal borders between rows
- Hover state: Subtle background change on row hover
- Alternating rows: No striping (cleaner look)

**Status Badges**:
- Small rounded pills: `px-3 py-1 text-xs font-medium rounded-full`
- Active: Green background
- Cancelled: Gray background
- Admin role: Gold/yellow background
- Soldier role: Blue background

**Empty States**:
- Centered vertically in container
- Icon + message + action button (if applicable)
- Example: "No bookings found" with "Create Booking" button

---

## Interaction Patterns

**Loading States**:
- Spinner overlays for form submissions
- Skeleton screens for table loading
- Button disabled state with loading spinner

**Confirmations**:
- Bootstrap modals for destructive actions (delete user, cancel booking, reset credits)
- Clear warning text explaining consequences
- Two-button footer: Cancel (secondary) + Confirm (danger)

**Notifications**:
- Toast notifications (top-right): Success, error, info
- Auto-dismiss after 4 seconds
- Can manually dismiss

**Animations**:
- Minimal: Only fade-in for modals, subtle transitions on hover states
- No page transitions or elaborate effects
- Keep interactions instant and responsive

---

## Accessibility

- All forms with proper label associations
- Focus visible states on all interactive elements
- Sufficient contrast ratios throughout
- Keyboard navigation support for calendar and tables
- ARIA labels for icon-only buttons
- Table headers properly marked up

---

## Icons

**Library**: Heroicons (via CDN)
**Usage**:
- Navigation: user-circle, logout, calendar
- Actions: pencil (edit), trash (delete), plus (add)
- Status: check-circle (success), x-circle (error), clock (pending)
- Size: `w-5 h-5` for inline, `w-6 h-6` for buttons
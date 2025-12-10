# Army Company Mess Room Booking System

A credit-based booking system for military unit personnel to reserve the company mess room. Built with React, Express, and in-memory storage.

## Features

### For Soldiers
- View available credits and upcoming bookings
- Interactive calendar to book mess room time slots
- Credit-based system (1 credit = 1 hour)
- Smart cancellation policy with automatic refunds

### For Administrators
- User management (create, edit, delete soldiers)
- View all bookings across the unit
- Adjust individual user credits
- Monthly credit reset functionality
- Dashboard with key statistics

## Booking Rules

- **Credit Cost**: 1 credit = 1 hour of booking
- **Time Increments**: 30-minute minimum increments
- **Cancellation Policy**:
  - Cancel >24 hours before start: Full credit refund
  - Cancel ≤24 hours before start: No refund
- **Overlap Prevention**: Only one booking at any given time

## Default Login Credentials

### Admin Account
- Username: `admin`
- Password: `admin123`

### Sample Soldier Accounts
- Username: `soldier1`, Password: `password123` (10 credits)
- Username: `soldier2`, Password: `password123` (10 credits)
- Username: `soldier3`, Password: `password123` (10 credits)

## How to Run

The application starts automatically on Replit. If running locally:

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5000`

## Monthly Credit Management

Administrators can configure and execute monthly credit resets:

1. Go to Admin Dashboard → Credits tab
2. Set the "Default Monthly Credits" value (e.g., 10)
3. Click "Reset All Soldier Credits"
4. All soldiers will receive the configured credit amount
5. Admin accounts are not affected by resets

## Technical Stack

- **Frontend**: React, TanStack Query, Wouter Router, Shadcn UI
- **Backend**: Express.js, TypeScript
- **Storage**: In-memory (resets on server restart)
- **Calendar**: FullCalendar
- **Styling**: Tailwind CSS

## Project Structure

```
├── client/
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Page components
│       └── lib/             # Utilities and configs
├── server/
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # Data storage interface
└── shared/
    └── schema.ts           # Shared types and schemas
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Bookings (Soldiers & Admins)
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/my` - Get current user's bookings
- `POST /api/bookings` - Create booking
- `POST /api/bookings/:id/cancel` - Cancel booking

### Admin Only
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/credits/reset` - Reset all soldier credits

## Notes

- This is a demonstration system using in-memory storage
- Data will be lost when the server restarts
- For production use, integrate with a persistent database
- All times are in the server's local timezone

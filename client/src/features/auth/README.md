# Auth Feature

## Overview
Handles user authentication, login, logout, and password management.

## Structure
```
auth/
├── components/
│   └── ChangePasswordDialog.tsx  # Dialog for changing user password
├── pages/
│   └── LoginPage.tsx              # Login page with form
├── hooks/
│   └── useAuth.ts                 # Authentication hook (future)
├── index.ts                       # Barrel export
└── README.md                      # This file
```

## Components

### ChangePasswordDialog
Dialog component for users to change their password.

**Props:**
- `open: boolean` - Whether dialog is open
- `onOpenChange: (open: boolean) => void` - Callback when dialog state changes

**Usage:**
```tsx
import { ChangePasswordDialog } from '@/features/auth';

<ChangePasswordDialog 
  open={isOpen} 
  onOpenChange={setIsOpen} 
/>
```

## Pages

### LoginPage
Main login page with authentication form.

**Route:** `/login`

## Hooks

### useAuth (Future)
Hook for managing authentication state.

**Usage:**
```tsx
import { useAuth } from '@/features/auth';

const { user, login, logout, isLoading } = useAuth();
```

## API Endpoints Used
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/change-password` - Change password

## Dependencies
- `@/shared/components/ui` - UI components
- `@/shared/hooks/use-toast` - Toast notifications
- `@/shared/lib/queryClient` - API client

## Testing
```bash
# Run auth feature tests
npm test -- --testPathPattern=features/auth
```

## Migration Status
- [ ] Move LoginPage from pages/
- [ ] Move ChangePasswordDialog from components/
- [ ] Create useAuth hook
- [ ] Update all imports
- [ ] Add comprehensive tests

## Owner
**Team:** Security Team  
**Contact:** security@example.com  
**Last Updated:** December 16, 2025

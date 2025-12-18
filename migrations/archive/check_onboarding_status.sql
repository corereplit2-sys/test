-- Diagnostic Script to Check Onboarding Status
-- Run this to see what's currently in your database

-- Check if onboarding_requests table exists and has data
SELECT 'onboarding_requests table' as table_name, COUNT(*) as record_count
FROM onboarding_requests

UNION ALL

SELECT 'users table' as table_name, COUNT(*) as record_count
FROM users

UNION ALL

SELECT 'driver_qualifications table' as table_name, COUNT(*) as record_count
FROM driver_qualifications;

-- Show all onboarding requests with their status
SELECT 
    id,
    full_name,
    username,
    rank,
    status,
    created_at
FROM onboarding_requests 
ORDER BY created_at DESC;

-- Show all users
SELECT 
    id,
    username,
    full_name,
    role,
    rank,
    msp_id
FROM users 
ORDER BY username;

-- Check if any users match onboarding usernames
SELECT 
    'Users matching onboarding requests' as description,
    COUNT(*) as count
FROM users u
INNER JOIN onboarding_requests o ON u.username = o.username;

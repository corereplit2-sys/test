-- SQL Script to Approve All Pending Onboarding Requests
-- Run this directly in your Neon database console

-- First, let's see what pending requests we have
SELECT 
    id,
    full_name,
    username,
    rank,
    dob,
    doe,
    msp_id,
    status,
    created_at
FROM onboarding_requests 
WHERE status = 'pending'
ORDER BY created_at;

-- Approve all pending requests by:
-- 1. Creating users from the onboarding requests
-- 2. Updating the onboarding request status to 'approved'

-- Step 1: Create users from all pending onboarding requests
INSERT INTO users (
    id,
    username,
    password_hash,
    full_name,
    role,
    credits,
    rank,
    msp_id,
    dob,
    doe
)
SELECT 
    gen_random_uuid() as id,  -- Generate new UUID for user
    username,
    password_hash,
    full_name,
    'commander' as role,  -- Commander role for all accounts
    0 as credits,         -- Default credits
    rank,
    msp_id,
    dob,
    doe
FROM onboarding_requests 
WHERE status = 'pending'
AND username NOT IN (SELECT username FROM users);  -- Avoid duplicates
ON CONFLICT (username) DO NOTHING;  -- Skip if username already exists

-- Step 2: Update all pending requests to 'approved' status
UPDATE onboarding_requests 
SET status = 'approved', 
    updated_at = NOW()
WHERE status = 'pending';

-- Step 3: Verify the results
-- Show updated onboarding requests
SELECT 
    id,
    full_name,
    username,
    rank,
    status,
    created_at,
    updated_at
FROM onboarding_requests 
WHERE status = 'approved'
ORDER BY updated_at DESC;

-- Show newly created users
SELECT 
    id,
    username,
    full_name,
    role,
    rank,
    msp_id,
    created_at
FROM users 
WHERE username IN (
    SELECT username FROM onboarding_requests WHERE status = 'approved'
)
ORDER BY created_at DESC;

-- Summary counts
SELECT 
    'Total onboarding requests' as description,
    COUNT(*) as count
FROM onboarding_requests

UNION ALL

SELECT 
    'Approved requests' as description,
    COUNT(*) as count
FROM onboarding_requests 
WHERE status = 'approved'

UNION ALL

SELECT 
    'Pending requests' as description,
    COUNT(*) as count
FROM onboarding_requests 
WHERE status = 'pending'

UNION ALL

SELECT 
    'Total users' as description,
    COUNT(*) as count
FROM users;

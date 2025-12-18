-- SQL Script to Add TERREX Qualifications for Onboarding Users
-- Run this after approving onboarding requests

-- First, let's see all users (including the newly created ones from onboarding)
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.rank,
    u.msp_id,
    u.role,
    o.created_at as user_created_at,
    o.full_name as onboarding_name,
    o.status as onboarding_status
FROM users u
LEFT JOIN onboarding_requests o ON u.username = o.username
WHERE o.status = 'approved'  -- Only users from approved onboarding requests
ORDER BY o.created_at DESC;

-- Add TERREX qualification specifically for users from approved onboarding requests
-- Qualified on September 12, 2025
-- Currency expiry will be calculated as 88 days from qualification date

INSERT INTO driver_qualifications (
    id,
    user_id,
    vehicle_type,
    qualified_on_date,
    last_drive_date,
    currency_expiry_date
)
SELECT 
    gen_random_uuid() as id,
    u.id as user_id,
    'TERREX' as vehicle_type,
    '2025-09-12'::date as qualified_on_date,  -- September 12, 2025
    '2025-09-12'::date as last_drive_date,    -- Same day as qualification
    '2025-09-12'::date + interval '88 days' as currency_expiry_date  -- 88 days after qualification
FROM users u
INNER JOIN onboarding_requests o ON u.username = o.username
WHERE o.status = 'approved'  -- Only users from approved onboarding requests
AND u.id NOT IN (  -- Avoid duplicates
    SELECT user_id 
    FROM driver_qualifications 
    WHERE vehicle_type = 'TERREX'
);

-- Verify the qualifications were added
SELECT 
    dq.id,
    dq.user_id,
    u.username,
    u.full_name,
    dq.vehicle_type,
    dq.qualified_on_date,
    dq.last_drive_date,
    dq.currency_expiry_date,
    u.role
FROM driver_qualifications dq
INNER JOIN users u ON dq.user_id = u.id
INNER JOIN onboarding_requests o ON u.username = o.username
WHERE dq.vehicle_type = 'TERREX'
AND o.status = 'approved'
ORDER BY o.created_at DESC;

-- Summary counts
SELECT 
    'Total users from approved onboarding' as description,
    COUNT(*) as count
FROM users u
INNER JOIN onboarding_requests o ON u.username = o.username
WHERE o.status = 'approved'

UNION ALL

SELECT 
    'TERREX qualifications added' as description,
    COUNT(*) as count
FROM driver_qualifications dq
INNER JOIN users u ON dq.user_id = u.id
INNER JOIN onboarding_requests o ON u.username = o.username
WHERE dq.vehicle_type = 'TERREX'
AND o.status = 'approved';

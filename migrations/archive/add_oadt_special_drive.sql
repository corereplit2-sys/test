-- SQL Script to Add OADT Special Drive for Approved Onboarding Users
-- Run this after approving onboarding requests and adding TERREX qualifications

-- First, let's see the approved onboarding users who will get the drive
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.rank,
    u.role,
    o.created_at as onboarding_date
FROM users u
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE o.status = 'approved'
ORDER BY o.created_at DESC;

-- Add special OADT drive for approved onboarding users
-- Event: OADT (stored in remarks)
-- Last TERREX drive: 2km on October 3rd
-- Date: October 3, 2025

INSERT INTO drive_logs (
    id,
    user_id,
    vehicle_type,
    distance_km,
    date,
    remarks,
    created_at
)
SELECT 
    gen_random_uuid() as id,
    u.id as user_id,
    'TERREX' as vehicle_type,
    2.0 as distance_km,
    '2025-10-03'::date as date,
    'OADT' as remarks,  -- Store event name in remarks
    NOW() as created_at
FROM users u
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE o.status = 'approved'
AND u.id NOT IN (  -- Avoid duplicates - check if they already have an OADT drive
    SELECT dl.user_id 
    FROM drive_logs dl 
    WHERE dl.remarks = 'OADT'
);

-- Verify the drives were added
SELECT 
    dl.id,
    dl.user_id,
    u.username,
    u.full_name,
    u.rank,
    u.role,
    dl.vehicle_type,
    dl.distance_km,
    dl.date,
    dl.remarks,
    dl.created_at
FROM drive_logs dl
INNER JOIN users u ON dl.user_id = u.id
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE dl.remarks = 'OADT'
AND o.status = 'approved'
ORDER BY u.username;

-- Update the last drive date for TERREX qualifications to reflect this drive
UPDATE driver_qualifications dq
SET last_drive_date = '2025-10-03'::date
WHERE dq.vehicle_type = 'TERREX'
AND dq.user_id IN (
    SELECT u.id
    FROM users u
    INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
    WHERE o.status = 'approved'
);

-- Verify the qualifications were updated
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
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE dq.vehicle_type = 'TERREX'
AND o.status = 'approved'
ORDER BY u.username;

-- Summary counts
SELECT 
    'Total users from approved onboarding' as description,
    COUNT(*) as count
FROM users u
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE o.status = 'approved'

UNION ALL

SELECT 
    'OADT drives added' as description,
    COUNT(*) as count
FROM drive_logs dl
INNER JOIN users u ON dl.user_id = u.id
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE dl.remarks = 'OADT'
AND o.status = 'approved'

UNION ALL

SELECT 
    'TERREX qualifications updated' as description,
    COUNT(*) as count
FROM driver_qualifications dq
INNER JOIN users u ON dq.user_id = u.id
INNER JOIN onboarding_requests o ON TRIM(u.full_name) = TRIM(o.full_name)
WHERE dq.vehicle_type = 'TERREX'
AND dq.last_drive_date = '2025-10-03'
AND o.status = 'approved';

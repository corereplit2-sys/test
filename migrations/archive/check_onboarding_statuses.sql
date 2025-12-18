-- Check the status of all onboarding requests
SELECT 
    status,
    COUNT(*) as count
FROM onboarding_requests 
GROUP BY status
ORDER BY count DESC;

-- Show the first 10 onboarding requests to see their details
SELECT 
    id,
    full_name,
    username,
    rank,
    status,
    created_at,
    updated_at
FROM onboarding_requests 
ORDER BY created_at DESC
LIMIT 10;

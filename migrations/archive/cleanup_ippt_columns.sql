-- Clean up redundant columns from ippt_attempts table
-- Run this after the migration to remove unwanted columns

-- Step 1: Remove redundant user info columns
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS name;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS dob;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS rank;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS platoon;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS is_initial;

-- Step 2: Verify columns were removed
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts'
ORDER BY ordinal_position;

-- Step 3: Show final table structure
SELECT 
    'Final table structure' as info,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts';

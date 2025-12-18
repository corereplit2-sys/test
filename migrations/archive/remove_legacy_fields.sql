-- Remove legacy fields from ippt_attempts table
-- This cleans up the redundant old field names

-- Step 1: Drop dependent objects first
DROP VIEW IF EXISTS ippt_attempts_with_user_info;

-- Step 2: Drop legacy columns
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS situps;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS pushups;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS run_time_seconds;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS date;

-- Step 3: Recreate the view with new field names
CREATE OR REPLACE VIEW ippt_attempts_with_user_info AS
SELECT 
    ia.*,
    u.full_name as user_name,
    u.rank as user_rank,
    u.msp_id as user_msp_id,
    CASE WHEN ia.ippt_date = (SELECT MIN(ippt_date) 
                            FROM ippt_attempts 
                            WHERE user_id = ia.user_id) 
         THEN true ELSE false END as is_initial
FROM ippt_attempts ia
LEFT JOIN users u ON u.id = ia.user_id;

-- Step 4: Verify final table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts'
ORDER BY ordinal_position;

-- Step 5: Show final count
SELECT 
    'Final clean table structure' as info,
    COUNT(*) as total_columns
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts';

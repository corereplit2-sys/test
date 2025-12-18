-- Remove redundant activity column from ippt_attempts table
-- Since activity is now stored in ippt_sessions and linked via session_id

-- Check current table structure
\d ippt_attempts;

-- Remove the redundant activity column
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS activity;

-- Verify the change
\d ippt_attempts;

-- Show sample data to confirm structure is correct
SELECT * FROM ippt_attempts LIMIT 3;

-- Cleanup redundant columns from ippt_sessions table
-- Step 1: Check current structure
SELECT column_name, ordinal_position 
FROM information_schema.columns 
WHERE table_name = 'ippt_sessions' 
ORDER BY ordinal_position;

-- Step 2: Create backup of ippt_sessions
CREATE TABLE ippt_sessions_backup AS SELECT * FROM ippt_sessions;

-- Step 3: Drop and recreate ippt_sessions with minimal columns
DROP TABLE ippt_sessions;

-- Step 4: Recreate with minimal structure (3 columns only)
CREATE TABLE ippt_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date DATE NOT NULL
);

-- Step 5: Restore data from backup (only 3 columns)
INSERT INTO ippt_sessions 
SELECT id, name, date
FROM ippt_sessions_backup;

-- Step 6: Verify the cleanup
SELECT column_name, ordinal_position 
FROM information_schema.columns 
WHERE table_name = 'ippt_sessions' 
ORDER BY ordinal_position;

-- Step 7: Show sample data
SELECT * FROM ippt_sessions LIMIT 5;

-- Step 8: Clean up backup (uncomment when verified)
-- DROP TABLE ippt_sessions_backup;

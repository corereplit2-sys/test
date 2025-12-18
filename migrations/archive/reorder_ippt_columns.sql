-- Reorder ippt_attempts table columns in logical order
-- This recreates the table with proper column ordering

-- Step 1: Create a backup of the data
CREATE TABLE ippt_attempts_backup AS SELECT * FROM ippt_attempts;

-- Step 2: Drop the old table and dependent objects
DROP VIEW IF EXISTS ippt_attempts_with_user_info;
DROP TABLE ippt_attempts;

-- Step 3: Recreate table with logical column order
CREATE TABLE ippt_attempts (
    -- Core identifiers
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    
    -- Test metadata
    activity TEXT NOT NULL DEFAULT 'IPPT Test',
    ippt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    age_as_of_ippt INTEGER NOT NULL DEFAULT 25,
    
    -- Performance data
    situp_reps INTEGER NOT NULL DEFAULT 0,
    situp_score INTEGER NOT NULL DEFAULT 0,
    pushup_reps INTEGER NOT NULL DEFAULT 0,
    pushup_score INTEGER NOT NULL DEFAULT 0,
    run_time TEXT NOT NULL DEFAULT '00:00',
    run_score INTEGER NOT NULL DEFAULT 0,
    
    -- Results
    total_score INTEGER NOT NULL DEFAULT 0,
    result TEXT NOT NULL DEFAULT 'Fail',
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 4: Restore data from backup
INSERT INTO ippt_attempts (
    id, user_id, session_id, activity, ippt_date, age_as_of_ippt,
    situp_reps, situp_score, pushup_reps, pushup_score, run_time, run_score,
    total_score, result, created_at
)
SELECT 
    id, user_id, session_id, activity, ippt_date, age_as_of_ippt,
    situp_reps, situp_score, pushup_reps, pushup_score, run_time, run_score,
    total_score, result, created_at
FROM ippt_attempts_backup;

-- Step 5: Recreate the view
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

-- Step 6: Verify the new order
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts'
ORDER BY ordinal_position;

-- Step 7: Clean up backup (optional - uncomment when verified)
-- DROP TABLE ippt_attempts_backup;

SELECT 'Table reordered successfully' as status;

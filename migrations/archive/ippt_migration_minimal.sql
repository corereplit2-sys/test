-- Minimal PostgreSQL migration for ippt_attempts table
-- Removes redundant columns, keeps only essential data

-- Step 1: Add essential new columns if they don't exist
DO $$
BEGIN
    -- Essential columns to add
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='activity') THEN
        ALTER TABLE ippt_attempts ADD COLUMN activity TEXT NOT NULL DEFAULT 'IPPT Test';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='ippt_date') THEN
        ALTER TABLE ippt_attempts ADD COLUMN ippt_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='age_as_of_ippt') THEN
        ALTER TABLE ippt_attempts ADD COLUMN age_as_of_ippt INTEGER NOT NULL DEFAULT 25;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='situp_reps') THEN
        ALTER TABLE ippt_attempts ADD COLUMN situp_reps INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='situp_score') THEN
        ALTER TABLE ippt_attempts ADD COLUMN situp_score INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='pushup_reps') THEN
        ALTER TABLE ippt_attempts ADD COLUMN pushup_reps INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='pushup_score') THEN
        ALTER TABLE ippt_attempts ADD COLUMN pushup_score INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='run_time') THEN
        ALTER TABLE ippt_attempts ADD COLUMN run_time TEXT NOT NULL DEFAULT '00:00';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='run_score') THEN
        ALTER TABLE ippt_attempts ADD COLUMN run_score INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Step 2: Populate essential fields from existing data
UPDATE ippt_attempts 
SET 
    activity = COALESCE(activity, 'IPPT Test'),
    ippt_date = COALESCE(ippt_date, date),
    situp_reps = COALESCE(situp_reps, situps, 0),
    pushup_reps = COALESCE(pushup_reps, pushups, 0),
    run_time = COALESCE(run_time, 
        CASE WHEN COALESCE(run_time_seconds, 0) > 0 
            THEN FLOOR(run_time_seconds / 60)::TEXT || ':' || 
                 CASE WHEN (run_time_seconds % 60) < 10 THEN '0' || (run_time_seconds % 60)::TEXT
                      ELSE (run_time_seconds % 60)::TEXT END
            ELSE '00:00' END)
WHERE activity IS NULL OR situp_reps = 0;

-- Step 3: Calculate age as of IPPT date
UPDATE ippt_attempts 
SET 
    age_as_of_ippt = DATE_PART('year', AGE(COALESCE(ippt_date, date), u.dob))
FROM users u 
WHERE u.id = ippt_attempts.user_id 
AND ippt_attempts.age_as_of_ippt = 25; -- Only update default values

-- Step 4: Calculate individual scores (simplified)
UPDATE ippt_attempts 
SET 
    situp_score = CASE WHEN situp_score > 0 THEN situp_score ELSE GREATEST(0, LEAST(25, situp_reps)) END,
    pushup_score = CASE WHEN pushup_score > 0 THEN pushup_score ELSE GREATEST(0, LEAST(25, pushup_reps)) END,
    run_score = CASE WHEN run_score > 0 THEN run_score ELSE 
        CASE WHEN run_time_seconds <= 480 THEN 50
             WHEN run_time_seconds <= 540 THEN 45
             WHEN run_time_seconds <= 600 THEN 40
             WHEN run_time_seconds <= 660 THEN 35
             WHEN run_time_seconds <= 720 THEN 30
             WHEN run_time_seconds <= 780 THEN 25
             WHEN run_time_seconds <= 840 THEN 20
             WHEN run_time_seconds <= 900 THEN 15
             WHEN run_time_seconds <= 960 THEN 10
             ELSE 5 END END
WHERE situp_score = 0 OR pushup_score = 0 OR run_score = 0;

-- Step 5: Sync legacy fields for backward compatibility
UPDATE ippt_attempts 
SET 
    situps = situp_reps,
    pushups = pushup_reps,
    run_time_seconds = CASE 
        WHEN run_time ~ '^[0-9]{1,2}:[0-9]{2}$' THEN
            (CAST(SPLIT_PART(run_time, ':', 1) AS INTEGER) * 60) + 
            CAST(SPLIT_PART(run_time, ':', 2) AS INTEGER)
        ELSE COALESCE(run_time_seconds, 0)
    END,
    date = ippt_date;

-- Step 6: Remove redundant columns that can be gotten from users table
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS name;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS dob;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS rank;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS platoon;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS is_initial;

-- Step 7: Optional - Remove legacy columns after confirming everything works (UNCOMMENT WHEN READY)
/*
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS situps;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS pushups;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS run_time_seconds;
ALTER TABLE ippt_attempts DROP COLUMN IF EXISTS date;
*/

-- Step 8: Create view for easy access with user data
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

-- Step 9: Verify migration
SELECT 
    'Migration completed' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN activity IS NOT NULL THEN 1 END) as has_activity,
    COUNT(CASE WHEN situp_reps > 0 THEN 1 END) as has_situp_reps,
    COUNT(CASE WHEN pushup_reps > 0 THEN 1 END) as has_pushup_reps,
    COUNT(CASE WHEN run_time != '00:00' THEN 1 END) as has_run_time
FROM ippt_attempts;

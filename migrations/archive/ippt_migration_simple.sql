-- Simple PostgreSQL migration for ippt_attempts table
-- Step 1: Add columns if they don't exist
DO $$
BEGIN
    -- Add new columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='activity') THEN
        ALTER TABLE ippt_attempts ADD COLUMN activity TEXT NOT NULL DEFAULT 'IPPT Test';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='ippt_date') THEN
        ALTER TABLE ippt_attempts ADD COLUMN ippt_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='name') THEN
        ALTER TABLE ippt_attempts ADD COLUMN name TEXT NOT NULL DEFAULT 'Unknown';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ippt_attempts' AND column_name='dob') THEN
        ALTER TABLE ippt_attempts ADD COLUMN dob DATE NOT NULL DEFAULT CURRENT_DATE;
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

-- Step 2: Populate new fields from existing data
UPDATE ippt_attempts 
SET 
    activity = 'IPPT Test',
    ippt_date = COALESCE(ippt_date, date),
    name = COALESCE(name, 'Unknown'),
    situp_reps = COALESCE(situp_reps, situps, 0),
    pushup_reps = COALESCE(pushup_reps, pushups, 0),
    run_time = COALESCE(run_time, 
        CASE WHEN COALESCE(run_time_seconds, 0) > 0 
            THEN FLOOR(run_time_seconds / 60)::TEXT || ':' || 
                 CASE WHEN (run_time_seconds % 60) < 10 THEN '0' || (run_time_seconds % 60)::TEXT
                      ELSE (run_time_seconds % 60)::TEXT END
            ELSE '00:00' END)
WHERE activity IS NULL OR name IS NULL OR situp_reps = 0;

-- Step 3: Get user data
UPDATE ippt_attempts 
SET 
    name = u.full_name,
    dob = u.dob,
    age_as_of_ippt = DATE_PART('year', AGE(COALESCE(ippt_date, date), u.dob))
FROM users u 
WHERE u.id = ippt_attempts.user_id 
AND (ippt_attempts.name = 'Unknown' OR ippt_attempts.dob IS NULL);

-- Step 4: Calculate scores (simplified)
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

-- Step 5: Verify
SELECT 'Migration completed' as status, COUNT(*) as total_records FROM ippt_attempts;

-- Safe migration script to update ippt_attempts table structure
-- This will only add columns that don't already exist

-- Add new columns only if they don't exist
ALTER TABLE ippt_attempts 
ADD COLUMN IF NOT EXISTS activity TEXT NOT NULL DEFAULT 'IPPT Test',
ADD COLUMN IF NOT EXISTS ippt_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS platoon TEXT,
ADD COLUMN IF NOT EXISTS rank TEXT,
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS dob DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS age_as_of_ippt INTEGER NOT NULL DEFAULT 25,
ADD COLUMN IF NOT EXISTS situp_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS situp_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pushup_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pushup_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS run_time TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN IF NOT EXISTS run_score INTEGER NOT NULL DEFAULT 0;

-- Add legacy fields for backward compatibility if they don't exist
ALTER TABLE ippt_attempts 
ADD COLUMN IF NOT EXISTS situps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pushups INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS run_time_seconds INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Populate new fields from existing data (only if they're empty)
UPDATE ippt_attempts 
SET 
    activity = COALESCE(activity, 'IPPT Test'),
    ippt_date = COALESCE(ippt_date, date),
    name = COALESCE(name, 
        (SELECT u.full_name FROM users u WHERE u.id = ippt_attempts.user_id), 
        'Unknown'
    ),
    dob = COALESCE(dob,
        (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id), 
        CURRENT_DATE
    ),
    age_as_of_ippt = COALESCE(age_as_of_ippt, CASE 
        WHEN (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id) IS NOT NULL 
        THEN DATE_PART('year', AGE(COALESCE(ippt_date, date), (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id)))
        ELSE 25
    END),
    situp_reps = COALESCE(situp_reps, situps, 0),
    pushup_reps = COALESCE(pushup_reps, pushups, 0),
    run_time = COALESCE(run_time, CASE 
        WHEN COALESCE(run_time_seconds, 0) > 0 THEN 
            (FLOOR(COALESCE(run_time_seconds, 0) / 60) || ':' || LPAD(COALESCE(run_time_seconds, 0) % 60, 2, '0'))
        ELSE '00:00'
    END)
WHERE activity IS NULL OR ippt_date IS NULL OR name IS NULL OR situp_reps = 0;

-- Calculate and store individual scores (only if scores are 0)
UPDATE ippt_attempts 
SET 
    situp_score = CASE 
        WHEN situp_score > 0 THEN situp_score  -- Keep existing score
        WHEN situp_reps >= 60 THEN 25
        ELSE GREATEST(0, FLOOR((situp_reps - 1) * 0.5))
    END,
    pushup_score = CASE 
        WHEN pushup_score > 0 THEN pushup_score  -- Keep existing score
        WHEN pushup_reps >= 60 THEN 25
        ELSE GREATEST(0, FLOOR((pushup_reps - 1) * 0.5))
    END,
    run_score = CASE 
        WHEN run_score > 0 THEN run_score  -- Keep existing score
        WHEN run_time_seconds <= 480 THEN 50  -- 8:00
        WHEN run_time_seconds <= 540 THEN 45  -- 9:00
        WHEN run_time_seconds <= 600 THEN 40  -- 10:00
        WHEN run_time_seconds <= 660 THEN 35  -- 11:00
        WHEN run_time_seconds <= 720 THEN 30  -- 12:00
        WHEN run_time_seconds <= 780 THEN 25  -- 13:00
        WHEN run_time_seconds <= 840 THEN 20  -- 14:00
        WHEN run_time_seconds <= 900 THEN 15  -- 15:00
        WHEN run_time_seconds <= 960 THEN 10  -- 16:00
        ELSE 5
    END
WHERE situp_score = 0 OR pushup_score = 0 OR run_score = 0;

-- Get rank and platoon from user data (only if empty)
UPDATE ippt_attempts 
SET 
    rank = COALESCE(rank, (SELECT u.rank FROM users u WHERE u.id = ippt_attempts.user_id)),
    platoon = COALESCE(platoon, (SELECT u.msp_name FROM users u WHERE u.id = ippt_attempts.user_id))
WHERE rank IS NULL OR platoon IS NULL;

-- Sync legacy fields with new fields
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_ippt_fields_insert;
DROP TRIGGER IF EXISTS sync_ippt_fields_update;

-- Create triggers to keep legacy fields in sync with new fields
CREATE OR REPLACE FUNCTION sync_ippt_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW.situps := NEW.situp_reps;
    NEW.pushups := NEW.pushup_reps;
    NEW.run_time_seconds := CASE 
        WHEN NEW.run_time ~ '^[0-9]{1,2}:[0-9]{2}$' THEN
            (CAST(SPLIT_PART(NEW.run_time, ':', 1) AS INTEGER) * 60) + 
            CAST(SPLIT_PART(NEW.run_time, ':', 2) AS INTEGER)
        ELSE 0
    END;
    NEW.date := NEW.ippt_date;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_ippt_fields_insert 
BEFORE INSERT ON ippt_attempts
FOR EACH ROW
EXECUTE FUNCTION sync_ippt_fields();

CREATE TRIGGER sync_ippt_fields_update 
BEFORE UPDATE ON ippt_attempts
FOR EACH ROW
EXECUTE FUNCTION sync_ippt_fields();

-- Verify the migration
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN activity IS NOT NULL THEN 1 END) as has_activity,
    COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as has_name,
    COUNT(CASE WHEN situp_reps > 0 THEN 1 END) as has_situp_reps,
    COUNT(CASE WHEN pushup_reps > 0 THEN 1 END) as has_pushup_reps,
    COUNT(CASE WHEN run_time != '00:00' THEN 1 END) as has_run_time
FROM ippt_attempts;

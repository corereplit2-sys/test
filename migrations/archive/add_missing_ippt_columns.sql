-- Add missing columns to ippt_attempts table
-- Run this script to update the database schema

-- Add new columns that were added to the schema but missing from the database
ALTER TABLE ippt_attempts 
ADD COLUMN IF NOT EXISTS ippt_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS platoon TEXT,
ADD COLUMN IF NOT EXISTS rank TEXT,
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS dob DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS age_as_of_ippt INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS situp_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS situp_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pushup_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS pushup_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS run_time TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN IF NOT EXISTS run_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_initial TEXT NOT NULL DEFAULT 'false' CHECK (is_initial IN ('true', 'false')),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have reasonable default values
UPDATE ippt_attempts 
SET 
    ippt_date = COALESCE(ippt_date, date),
    name = COALESCE(name, 'Unknown'),
    dob = COALESCE(dob, CURRENT_DATE),
    age_as_of_ippt = COALESCE(age_as_of_ippt, 0),
    situp_reps = COALESCE(situp_reps, situps),
    situp_score = COALESCE(situp_score, 0),
    pushup_reps = COALESCE(pushup_reps, pushups),
    pushup_score = COALESCE(pushup_score, 0),
    run_time = COALESCE(run_time, CASE 
        WHEN run_time_seconds > 0 THEN 
            FORMAT('%s:%s', FLOOR(run_time_seconds / 60), LPAD(run_time_seconds % 60::text, 2, '0'))
        ELSE '00:00'
    END),
    run_score = COALESCE(run_score, 0),
    is_initial = COALESCE(is_initial, 'false')
WHERE ippt_date IS NULL OR name IS NULL OR situp_reps IS NULL;

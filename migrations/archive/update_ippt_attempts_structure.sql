-- Migration script to update ippt_attempts table structure
-- This will add the new fields and populate them with existing data

-- Add new columns to ippt_attempts table
ALTER TABLE ippt_attempts 
ADD COLUMN activity TEXT NOT NULL DEFAULT 'IPPT Test',
ADD COLUMN ippt_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN platoon TEXT,
ADD COLUMN rank TEXT,
ADD COLUMN name TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN dob DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN age_as_of_ippt INTEGER NOT NULL DEFAULT 25,
ADD COLUMN situp_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN situp_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN pushup_reps INTEGER NOT NULL DEFAULT 0,
ADD COLUMN pushup_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN run_time TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN run_score INTEGER NOT NULL DEFAULT 0;

-- Populate new fields from existing data
UPDATE ippt_attempts 
SET 
    activity = 'IPPT Test',
    ippt_date = date,
    name = COALESCE(
        (SELECT u.full_name FROM users u WHERE u.id = ippt_attempts.user_id), 
        'Unknown'
    ),
    dob = COALESCE(
        (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id), 
        CURRENT_DATE
    ),
    age_as_of_ippt = CASE 
        WHEN (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id) IS NOT NULL 
        THEN FLOOR(DATEDIFF(date, (SELECT u.dob FROM users u WHERE u.id = ippt_attempts.user_id)) / 365.25)
        ELSE 25
    END,
    situp_reps = situps,
    pushup_reps = pushups,
    run_time = CASE 
        WHEN run_time_seconds > 0 THEN 
            CONCAT(FLOOR(run_time_seconds / 60), ':', LPAD(run_time_seconds % 60, 2, '0'))
        ELSE '00:00'
    END;

-- Calculate and store individual scores (this is a simplified calculation)
-- In a real scenario, you'd want to use the proper scoring matrix
UPDATE ippt_attempts 
SET 
    situp_score = CASE 
        WHEN situp_reps >= 60 THEN 25
        ELSE GREATEST(0, FLOOR((situp_reps - 1) * 0.5))
    END,
    pushup_score = CASE 
        WHEN pushup_reps >= 60 THEN 25
        ELSE GREATEST(0, FLOOR((pushup_reps - 1) * 0.5))
    END,
    run_score = CASE 
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
    END;

-- Get rank and platoon from user data
UPDATE ippt_attempts 
SET 
    rank = (SELECT u.rank FROM users u WHERE u.id = ippt_attempts.user_id),
    platoon = (SELECT u.msp_name FROM users u WHERE u.id = ippt_attempts.user_id);

-- Create triggers to keep legacy fields in sync with new fields
DELIMITER //
CREATE TRIGGER sync_ippt_fields_insert 
AFTER INSERT ON ippt_attempts
FOR EACH ROW
BEGIN
    UPDATE ippt_attempts SET
        situps = NEW.situp_reps,
        pushups = NEW.pushup_reps,
        run_time_seconds = CASE 
            WHEN NEW.run_time REGEXP '^[0-9]{1,2}:[0-9]{2}$' THEN
                CAST(SUBSTRING_INDEX(NEW.run_time, ':', 1) AS UNSIGNED) * 60 + 
                CAST(SUBSTRING_INDEX(NEW.run_time, ':', -1) AS UNSIGNED)
            ELSE 0
        END,
        date = NEW.ippt_date
    WHERE id = NEW.id;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER sync_ippt_fields_update 
AFTER UPDATE ON ippt_attempts
FOR EACH ROW
BEGIN
    UPDATE ippt_attempts SET
        situps = NEW.situp_reps,
        pushups = NEW.pushup_reps,
        run_time_seconds = CASE 
            WHEN NEW.run_time REGEXP '^[0-9]{1,2}:[0-9]{2}$' THEN
                CAST(SUBSTRING_INDEX(NEW.run_time, ':', 1) AS UNSIGNED) * 60 + 
                CAST(SUBSTRING_INDEX(NEW.run_time, ':', -1) AS UNSIGNED)
            ELSE 0
        END,
        date = NEW.ippt_date
    WHERE id = NEW.id;
END//
DELIMITER ;

-- Note: You can optionally drop the triggers and legacy columns later after updating all frontend code
-- DROP TRIGGER sync_ippt_fields_insert;
-- DROP TRIGGER sync_ippt_fields_update;
-- ALTER TABLE ippt_attempts DROP COLUMN situps;
-- ALTER TABLE ippt_attempts DROP COLUMN pushups;
-- ALTER TABLE ippt_attempts DROP COLUMN run_time_seconds;
-- ALTER TABLE ippt_attempts DROP COLUMN date;

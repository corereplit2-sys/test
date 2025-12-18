-- Import Excel IPPT data into ippt_attempts and ippt_sessions tables
-- Step 0: Clean up any existing temp table only
DROP TABLE IF EXISTS temp_ippt_import;

-- Note: We don't delete existing import data to allow cumulative imports

-- Step 1: Create temporary table for Excel data
CREATE TABLE temp_ippt_import (
    activity TEXT,
    ippt_date DATE,
    name TEXT,
    age_as_of_ippt INTEGER,
    result TEXT,
    total_score INTEGER,
    situp_reps INTEGER,
    situp_score INTEGER,
    pushup_reps INTEGER,
    pushup_score INTEGER,
    run_time TEXT,
    run_score INTEGER
);

-- Step 2: Insert your Excel data here (only 12 columns from 19-column CSV)
INSERT INTO temp_ippt_import VALUES
('MS Coy IPPT 3', '2025-10-30', 'CALEB TAN JIA LE', 20, 'Pass', 68, 45, 21, 37, 19, '12:49', 28),
('MS Coy IPPT 3', '2025-10-30', 'MOHAMAD IYSHRAQ JADULHAQ BIN MOHAMMAD YUSMAN', 22, 'Silver', 79, 40, 20, 57, 24, '11:42', 35),
('MS Coy IPPT 3', '2025-10-30', 'KHO HAO EN, SHAUN', 19, 'Silver', 83, 56, 24, 73, 28, '12:20', 31),
('MS Coy IPPT 3', '2025-10-30', 'SEE JING KANG', 19, 'Silver', 75, 36, 18, 53, 23, '11:47', 34),
('MS Coy IPPT 3', '2025-10-30', 'TAN JUN YANG ARNOLD', 19, 'Silver', 84, 55, 23, 66, 26, '11:25', 35),
('MS Coy IPPT 3', '2025-10-30', 'LIM JIE EN JAYENN', 19, 'Pass', 64, 35, 17, 32, 17, '12:21', 30),
('MS Coy IPPT 3', '2025-10-30', 'MIKA OWAIS SHAYAN BIN MUHAMMAD IESA LEONG', 18, 'Fail', 32, 25, 9, 54, 23, '00:00', 0),
('MS Coy IPPT 3', '2025-10-30', 'ALLOYSIUS GOH WEI JIE', 20, 'Silver', 75, 49, 22, 58, 24, '12:40', 29),
('MS Coy IPPT 3', '2025-10-30', 'BRANDON LIM TJIN WEN', 19, 'Pass', 65, 33, 15, 54, 23, '12:58', 27),
('MS Coy IPPT 3', '2025-10-30', 'TAY SHAO YANG JOEL', 19, 'Pass', 61, 31, 14, 31, 17, '12:29', 30),
('MS Coy IPPT 3', '2025-10-30', 'XANDER LOH ZHI XIAN', 18, 'Fail', 53, 28, 12, 42, 20, '13:56', 21),
('MS Coy IPPT 3', '2025-10-30', 'GUNASEKAR KAVIN', 20, 'Pass', 63, 19, 5, 50, 22, '11:05', 36),
('MS Coy IPPT 3', '2025-10-30', 'KRISHAN SHASHIKANT SHIVLAL', 19, 'Pass', 69, 44, 21, 37, 19, '12:37', 29),
('MS Coy IPPT 3', '2025-10-30', 'SHELDON GOH JUN EN', 20, 'Pass', 70, 30, 13, 67, 26, '12:13', 31),
('MS Coy IPPT 3', '2025-10-30', 'KOH JIE MING, XAVIER', 19, 'Fail', 38, 40, 20, 34, 18, '00:00', 0),
('MS Coy IPPT 3', '2025-10-30', 'GOH TIM YANG', 19, 'Pass', 69, 37, 18, 44, 21, '12:26', 30),
('MS Coy IPPT 3', '2025-10-30', 'TAN KUAN YAN, ANDREAS', 19, 'Silver', 79, 47, 21, 66, 26, '12:08', 32),
('MS Coy IPPT 3', '2025-10-30', 'CHUA JUN WEI, JAYDEN GERARD', 19, 'Silver', 77, 56, 24, 60, 25, '12:41', 28),
('MS Coy IPPT 3', '2025-10-30', 'SHI YAN DYLAN', 19, 'Pass', 66, 39, 19, 40, 20, '13:00', 27),
('MS Coy IPPT 3', '2025-10-30', 'SEE CHEE YUNG', 18, 'Pass', 71, 34, 16, 54, 23, '12:05', 32),
('MS Coy IPPT 3', '2025-10-30', 'OON JIE RONG', 19, 'Silver', 75, 36, 18, 53, 23, '11:42', 34),
('MS Coy IPPT 3', '2025-10-30', 'YAP TZE YONG REUBEN', 19, 'Gold', 85, 48, 22, 44, 21, '09:46', 42),
('MS Coy IPPT 3', '2025-10-30', 'VADIVEL MUKESH VASANTH', 19, 'Silver', 83, 42, 20, 54, 23, '10:05', 40),
('MS Coy IPPT 3', '2025-10-30', 'SIA DING YANG JOSHUA', 19, 'Silver', 78, 43, 20, 59, 24, '11:44', 34),
('MS Coy IPPT 3', '2025-10-30', 'YAO BO, WILLIAM', 19, 'Pass', 63, 36, 18, 31, 17, '12:43', 28),
('MS Coy IPPT 3', '2025-10-30', 'MUHAMMAD SHARIQIE HAIL BIN MOHD SHAHRUL', 19, 'Pass', 67, 33, 15, 50, 22, '12:25', 30),
('MS Coy IPPT 3', '2025-10-30', 'JAYDEN HO JUNJIE', 18, 'Pass', 74, 40, 20, 62, 25, '12:32', 29),
('MS Coy IPPT 3', '2025-10-30', 'DUAN RAN', 19, 'Pass', 72, 37, 18, 43, 20, '11:49', 34),
('MS Coy IPPT 3', '2025-10-30', 'ONG JING JIE JUSTIN', 22, 'Pass', 69, 33, 16, 65, 26, '13:08', 27),
('MS Coy IPPT 3', '2025-10-30', 'WONG CHING HAN', 19, 'Pass', 61, 31, 14, 32, 17, '12:24', 30),
('MS Coy IPPT 3', '2025-10-30', 'ENRICO TAN HENG YU', 19, 'Pass', 68, 37, 18, 40, 20, '12:21', 30),
('MS Coy IPPT 3', '2025-10-30', 'TAN LI YU', 19, 'Silver', 78, 44, 21, 58, 24, '12:00', 33),
('MS Coy IPPT 3', '2025-10-30', 'LIEW ZHE QUAN DAWSON', 19, 'Silver', 75, 36, 18, 43, 20, '10:47', 37);

-- Step 3: Create sessions from unique IPPT dates and activities (only new ones)
INSERT INTO ippt_sessions (id, name, date)
SELECT 'session-' || MD5(ippt_date::TEXT || activity::TEXT) as id,
       activity as name,
       ippt_date as date
FROM temp_ippt_import
GROUP BY ippt_date, activity
ON CONFLICT (id) DO NOTHING;

-- Step 4: Match names to users and import into ippt_attempts with session linking
INSERT INTO ippt_attempts (id, user_id, session_id, ippt_date, age_as_of_ippt,
                          situp_reps, situp_score, pushup_reps, pushup_score, 
                          run_time, run_score, total_score, result, created_at)
SELECT 'import-' || MD5(t.name || t.ippt_date || t.run_time) as id,
       COALESCE(u.id, 'unknown-user-' || MD5(t.name)) as user_id,
       'session-' || MD5(t.ippt_date::TEXT || t.activity::TEXT) as session_id,
       t.ippt_date,
       t.age_as_of_ippt,
       t.situp_reps,
       t.situp_score,
       t.pushup_reps,
       t.pushup_score,
       t.run_time,
       t.run_score,
       t.total_score,
       t.result,
       CURRENT_TIMESTAMP as created_at
FROM temp_ippt_import t
LEFT JOIN users u ON u.full_name ILIKE t.name
WHERE u.id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Step 5: Show import results
SELECT 'Import Summary' as info,
       COUNT(DISTINCT t.ippt_date) as sessions_created,
       COUNT(*) as total_excel_rows,
       COUNT(CASE WHEN u.id IS NOT NULL THEN 1 END) as matched_users,
       COUNT(CASE WHEN u.id IS NULL THEN 1 END) as unmatched_users
FROM temp_ippt_import t
LEFT JOIN users u ON u.full_name ILIKE t.name;

-- Step 6: Show created sessions
SELECT 'Created Sessions' as info,
       id, name, date
FROM ippt_sessions
WHERE id LIKE 'session-%'
ORDER BY date;

-- Step 7: Show unmatched users (if any)
SELECT 'Unmatched Users' as info,
       name, age_as_of_ippt, result, total_score, ippt_date
FROM temp_ippt_import t
LEFT JOIN users u ON u.full_name ILIKE t.name
WHERE u.id IS NULL;

-- Step 8: Clean up temp table
DROP TABLE temp_ippt_import;

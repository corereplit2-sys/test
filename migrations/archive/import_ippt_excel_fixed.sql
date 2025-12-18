-- Import Excel IPPT data into ippt_attempts and ippt_sessions tables
-- Step 0: Clean up any existing temp table and previous import data
DROP TABLE IF EXISTS temp_ippt_import;

-- Remove any previously imported data to avoid duplicates
DELETE FROM ippt_attempts WHERE id LIKE 'import-%';
DELETE FROM ippt_sessions WHERE id LIKE 'session-%';

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

-- Step 2: Insert your Excel data here
INSERT INTO temp_ippt_import VALUES
('Ace IPPT', '2025-04-11', 'HEW SU JIAT', 30, 'Gold', 95, 61, 26, 63, 26, '10:17', 43),
('1 SIR Reg IPPT 1', '2025-05-02', 'YUJI MATSUMURA', 28, 'Gold', 87, 51, 23, 59, 25, '10:52', 39),
('1 SIR Reg IPPT 2', '2025-05-18', 'BRANDON WONG YONG XIANG', 27, 'Gold', 93, 54, 24, 60, 25, '09:43', 44),
('1 SIR Comd IPPT 2', '2025-06-16', 'MATTHEW YEO SUI LI', 20, 'Gold', 86, 60, 25, 70, 27, '11:50', 34),
('1 SIR Comd IPPT 2', '2025-06-16', 'MIN WAI PHYO', 22, 'Gold', 87, 60, 25, 60, 25, '10:53', 37),
('1 SIR Comd IPPT 2', '2025-06-16', 'NG KAI BOON', 19, 'Pass', 71, 46, 21, 56, 24, '13:04', 26),
('1 SIR Comd IPPT 2', '2025-06-16', 'CHEN QIUWEI', 21, 'Gold', 85, 51, 22, 72, 28, '11:24', 35),
('1 SIR Comd IPPT 2', '2025-06-16', 'HE YUXIANG RAYMOND', 19, 'Silver', 77, 42, 20, 44, 21, '11:05', 36),
('1 SIR Comd IPPT 2', '2025-06-16', 'IZZUL IMAN BIN KATMAN', 20, 'Silver', 83, 40, 20, 57, 24, '10:15', 39),
('1 SIR Comd IPPT 2', '2025-06-16', 'THAM MENG FONG KEITH', 20, 'Gold', 85, 51, 22, 62, 25, '10:35', 38),
('SP Coy IPPT (IVT)', '2025-06-30', 'TAN LI YU', 18, 'Pass', 68, 47, 21, 53, 23, '13:23', 24),
('SP Coy IPPT (IVT)', '2025-06-30', 'JAYDEN HO JUNJIE', 18, 'Pass', 67, 44, 21, 46, 21, '13:19', 25),
('SP Coy IPPT (IVT)', '2025-06-30', 'DUAN RAN', 19, 'Pass', 62, 35, 17, 35, 18, '12:54', 27),
('SP Coy IPPT (IVT)', '2025-06-30', 'SIA DING YANG JOSHUA', 18, 'Pass', 62, 44, 21, 48, 22, '14:11', 19),
('SP Coy IPPT (IVT)', '2025-06-30', 'ONG JING JIE JUSTIN', 21, 'Fail', 60, 33, 15, 54, 23, '13:41', 22),
('SP Coy IPPT (IVT)', '2025-06-30', 'CEDRIC TAN LI HENG', 18, 'Pass', 68, 40, 20, 40, 20, '12:43', 28),
('SP Coy IPPT (IVT)', '2025-06-30', 'LIEW ZHE QUAN DAWSON', 19, 'Pass', 73, 42, 20, 42, 20, '11:52', 33),
('SP Coy IPPT (IVT)', '2025-06-30', 'YEO JUN MING', 18, 'Pass', 69, 41, 20, 42, 20, '12:40', 29),
('SP Coy IPPT (IVT)', '2025-06-30', 'ZHENG YUANHENG', 19, 'Silver', 76, 52, 23, 49, 22, '12:17', 31),
('SP Coy IPPT (IVT)', '2025-06-30', 'YAO BO, WILLIAM', 19, 'Pass', 62, 37, 18, 29, 16, '12:43', 28),
('SP Coy IPPT (IVT)', '2025-06-30', 'VADIVEL MUKESH VASANTH', 18, 'Silver', 76, 44, 21, 42, 20, '11:27', 35),
('SP Coy IPPT (IVT)', '2025-06-30', 'WONG CHING HAN', 19, 'Fail', 52, 31, 14, 30, 16, '13:47', 22),
('SP Coy IPPT (IVT)', '2025-06-30', 'YAP TZE YONG REUBEN', 18, 'Pass', 72, 35, 17, 33, 17, '10:39', 38),
('A Coy IPPT (IVT)', '2025-07-23', 'AIDAN YING KA KIT', 19, 'Gold', 86, 48, 22, 64, 26, '10:35', 38),
('B Coy IPPT (IVT)', '2025-07-25', 'LAU LU WEI', 20, 'Gold', 90, 58, 24, 74, 28, '10:25', 38),
('SP Coy IPPT (IVT)', '2025-06-30', 'ENRICO TAN HENG YU', 18, 'Pass', 73, 40, 20, 40, 20, '11:52', 33),
('C Coy IPPT', '2025-07-25', 'MUHAMMAD SHARIQIE HAIL BIN MOHD SHAHRUL', 19, 'Pass', 63, 35, 17, 42, 20, '13:01', 26),
('C Coy IPPT', '2025-07-25', 'ONG JING JIE JUSTIN', 22, 'Pass', 67, 38, 19, 55, 24, '13:31', 24),
('C Coy IPPT', '2025-07-25', 'HE YUXIANG RAYMOND', 19, 'Pass', 74, 48, 22, 41, 20, '12:06', 32),
('MS Coy IPPT 1', '2025-08-20', 'CHIN YEN BEEN', 19, 'Silver', 80, 43, 20, 49, 22, '10:32', 38),
('MS Coy IPPT 1', '2025-08-20', 'KWAN ZHENG KIT', 19, 'Gold', 93, 60, 25, 60, 25, '09:39', 43),
('MS Coy IPPT 1', '2025-08-20', 'TEO YI KAI, RAYDEN', 18, 'Silver', 83, 53, 23, 57, 24, '11:14', 36),
('MS Coy IPPT 1', '2025-08-20', 'LEWIS LIOU', 19, 'Pass', 73, 34, 16, 44, 21, '11:10', 36),
('MS Coy IPPT 1', '2025-08-20', 'NICHOLAS CHONG LIWEI', 19, 'Pass', 61, 26, 10, 42, 20, '12:16', 31),
('MS Coy IPPT 1', '2025-08-20', 'BU RUI EN', 18, 'Gold', 89, 52, 23, 57, 24, '09:42', 42),
('MS Coy IPPT 1', '2025-08-20', 'MUHAMMAD EDRYAN BIN MUHAMMAD FAIZAL', 18, 'Fail', 60, 42, 20, 33, 17, '13:34', 23),
('MS Coy IPPT 1', '2025-08-20', 'RAPHAEL KANG', 19, 'Silver', 81, 38, 19, 60, 25, '10:58', 37),
('MS Coy IPPT 1', '2025-08-20', 'ADITYA JOSEPH ERNEST', 19, 'Silver', 83, 57, 24, 58, 24, '11:21', 35),
('MS Coy IPPT 1', '2025-08-20', 'CHAI MING REH, ALDRICK', 18, 'Silver', 79, 47, 21, 55, 23, '11:39', 35),
('MS Coy IPPT 1', '2025-08-20', 'KAYDEN LEE KE JUN', 18, 'Gold', 88, 62, 25, 74, 28, '11:39', 35),
('MS Coy IPPT 1', '2025-08-20', 'NYEIN CHAN KO', 19, 'Silver', 79, 53, 23, 38, 19, '10:50', 37),
('MS Coy IPPT 1', '2025-08-20', 'WONG FU MING', 19, 'Gold', 87, 52, 23, 68, 27, '10:55', 37),
('MS Coy IPPT 1', '2025-08-20', 'TAN CHEE YIAN', 19, 'Pass', 68, 29, 13, 44, 21, '11:43', 34),
('MS Coy IPPT 1', '2025-08-20', 'LIM VERNON', 18, 'Pass', 71, 52, 23, 29, 16, '12:06', 32),
('MS Coy IPPT 1', '2025-08-20', 'MOHAMAD IYSHRAQ JADULHAQ BIN MOHAMAD YUSMAN', 22, 'Pass', 67, 32, 15, 36, 19, '12:06', 33),
('MS Coy IPPT 1', '2025-08-20', 'GOH WEI YANG', 18, 'Fail', 50, 35, 17, 20, 9, '13:27', 24),
('MS Coy IPPT 1', '2025-08-20', 'HENG CHONG YU', 19, 'Pass', 68, 33, 15, 32, 17, '11:14', 36),
('MS Coy IPPT 1', '2025-08-20', 'ONG KAY-AN JONATHAN', 18, 'Silver', 76, 52, 23, 36, 18, '11:40', 35),
('MS Coy IPPT 1', '2025-08-20', 'LEE EE HANK', 18, 'Pass', 66, 46, 21, 45, 21, '13:30', 24),
('MS Coy IPPT 1', '2025-08-20', 'ZHOU WUYANG', 19, 'Silver', 77, 44, 21, 40, 20, '11:01', 36),
('MS Coy IPPT 1', '2025-08-20', 'LIM BRIEN', 18, 'Pass', 68, 39, 19, 27, 15, '11:46', 34),
('MS Coy IPPT 1', '2025-08-20', 'LIM MING IAN', 19, 'Silver', 78, 45, 21, 40, 20, '10:51', 37),
('MS Coy IPPT 1', '2025-08-20', 'MOHAMMAD NUR ISKANDAR BIN MOHAMMAD IDRIS', 18, 'Fail', 44, 50, 22, 51, 22, '18:00', 0),
('MS Coy IPPT 1', '2025-08-20', 'BRANDON LIM TJIN WEN', 19, 'Pass', 68, 39, 19, 53, 23, '13:06', 26),
('MS Coy IPPT 1', '2025-08-20', 'MIKA OWAIS SHAYAN BIN MUHAMMAD IESA LEONG', 18, 'Fail', 52, 20, 6, 50, 22, '13:27', 24),
('MS Coy IPPT 1', '2025-08-20', 'BRANDON SOH BING YI', 19, 'Gold', 85, 36, 18, 80, 30, '10:59', 37),
('MS Coy IPPT 1', '2025-08-20', 'TOH JUN YANG', 19, 'Gold', 87, 60, 25, 66, 26, '11:07', 36),
('MS Coy IPPT 1', '2025-08-20', 'TAN HONG KAI DAYLEN', 19, 'Silver', 78, 47, 21, 52, 23, '11:47', 34),
('MS Coy IPPT 1', '2025-08-20', 'CALEB TAN JIA LE', 20, 'Pass', 63, 40, 20, 32, 17, '13:06', 26),
('MS Coy IPPT 1', '2025-08-20', 'KHO HAO EN, SHAUN', 18, 'Pass', 70, 54, 23, 72, 28, '14:20', 19),
('MS Coy IPPT 1', '2025-08-20', 'SEE JING KANG', 18, 'Fail', 40, 40, 20, 42, 20, '18:00', 0),
('MS Coy IPPT 1', '2025-08-20', 'TAN JUN YANG ARNOLD', 19, 'Silver', 80, 54, 23, 58, 24, '11:53', 33),
('MS Coy IPPT 1', '2025-08-20', 'ALWIN TAY SENG HEE', 18, 'Pass', 69, 43, 20, 35, 18, '12:13', 31),
('MS Coy IPPT 1', '2025-08-20', 'LIM JIE EN JAYENN', 19, 'Pass', 64, 37, 18, 30, 16, '12:24', 30),
('MS Coy IPPT 1', '2025-08-20', 'KOAY XUKANG', 19, 'Silver', 83, 51, 22, 66, 26, '11:29', 35),
('MS Coy IPPT 1', '2025-08-20', 'TAY SHAO YANG JOEL', 19, 'Fail', 52, 28, 12, 26, 15, '13:12', 25),
('MS Coy IPPT 1', '2025-08-20', 'OON JIE RONG', 18, 'Silver', 80, 40, 20, 59, 24, '11:02', 36),
('MS Coy IPPT 1', '2025-08-20', 'NG JING XUN', 18, 'Silver', 84, 52, 23, 52, 23, '10:35', 38),
('MS Coy IPPT 1', '2025-08-20', 'ASCENDAS TEO YUE TENG FEI', 18, 'Pass', 70, 44, 21, 30, 16, '11:58', 33),
('MS Coy IPPT 1', '2025-08-20', 'TAN KUAN YAN, ANDREAS', 19, 'Silver', 81, 57, 24, 61, 25, '12:04', 32),
('MS Coy IPPT 1', '2025-08-20', 'GUNASEKAR KAVIN', 20, 'Pass', 68, 30, 13, 32, 17, '10:40', 38),
('MS Coy IPPT 1', '2025-08-20', 'SHELDON GOH JUN EN', 19, 'Pass', 72, 29, 13, 68, 27, '12:10', 32),
('MS Coy IPPT 1', '2025-08-20', 'KOH JIE MING, XAVIER', 19, 'Pass', 65, 40, 20, 41, 20, '13:14', 25),
('MS Coy IPPT 1', '2025-08-20', 'GOH TIM YANG', 18, 'Pass', 71, 40, 20, 40, 20, '12:14', 31),
('MS Coy IPPT 1', '2025-08-20', 'CHUA JUN WEI, JAYDEN GERARD', 19, 'Silver', 77, 52, 23, 57, 24, '12:30', 30),
('MS Coy IPPT 1', '2025-08-20', 'KRISHAN SHASHIKANT SHIVLAL', 18, 'Fail', 57, 35, 17, 27, 15, '13:15', 25),
('MS Coy IPPT 1', '2025-08-20', 'XANDER LOH ZHI XIAN', 18, 'Fail', 59, 35, 17, 35, 18, '13:23', 24),
('MS Coy IPPT 1', '2025-08-20', 'SHI YAN DYLAN', 19, 'Pass', 64, 36, 18, 39, 19, '12:53', 27),
('MS Coy IPPT 1', '2025-08-20', 'SEE CHEE YUNG', 18, 'Pass', 71, 35, 17, 53, 23, '12:20', 31),
('MS Coy IPPT 1', '2025-08-20', 'YEO JUN MING', 18, 'Silver', 77, 40, 20, 44, 21, '11:08', 36),
('MS Coy IPPT 1', '2025-08-20', 'YAO BO, WILLIAM', 19, 'Pass', 68, 40, 20, 22, 11, '10:54', 37),
('MS Coy IPPT 1', '2025-08-20', 'MUHAMMAD SHARIQIE HAIL BIN MOHD SHAHRUL', 19, 'Pass', 71, 31, 14, 52, 23, '11:45', 34),
('MS Coy IPPT 1', '2025-08-20', 'ENRICO TAN HENG YU', 19, 'Silver', 76, 40, 20, 40, 20, '11:16', 36),
('MS Coy IPPT 1', '2025-08-20', 'DUAN RAN', 19, 'Pass', 66, 35, 17, 31, 17, '12:04', 32),
('MS Coy IPPT 1', '2025-08-20', 'ONG JING JIE JUSTIN', 22, 'Pass', 70, 31, 14, 63, 26, '12:34', 30);

-- Step 3: Create sessions from unique IPPT dates and activities
INSERT INTO ippt_sessions (id, name, date)
SELECT 'session-' || MD5(ippt_date::TEXT || activity::TEXT) as id,
       activity as name,
       ippt_date as date
FROM temp_ippt_import
GROUP BY ippt_date, activity;

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
WHERE u.id IS NOT NULL;

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

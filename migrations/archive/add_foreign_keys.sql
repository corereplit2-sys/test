-- Add proper foreign key constraints for IPPT tables
-- This makes relationships clickable in database UI tools

-- Step 1: Add foreign key from ippt_attempts to ippt_sessions
ALTER TABLE ippt_attempts 
ADD CONSTRAINT fk_ippt_attempts_session_id 
FOREIGN KEY (session_id) REFERENCES ippt_sessions(id) 
ON DELETE SET NULL;

-- Step 2: Add foreign key from ippt_attempts to users (if not exists)
ALTER TABLE ippt_attempts 
ADD CONSTRAINT fk_ippt_attempts_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Step 3: Verify constraints
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND (tc.table_name = 'ippt_attempts' OR tc.table_name = 'ippt_sessions')
ORDER BY tc.table_name, tc.constraint_name;

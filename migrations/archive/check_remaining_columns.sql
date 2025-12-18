-- Check what columns remain in ippt_attempts table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ippt_attempts'
ORDER BY ordinal_position;

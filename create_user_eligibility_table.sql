-- Create user_eligibility table
CREATE TABLE IF NOT EXISTS user_eligibility (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_eligible TEXT NOT NULL DEFAULT 'true' CHECK (is_eligible IN ('true', 'false')),
    reason TEXT,
    ineligibility_type TEXT CHECK (ineligibility_type IN ('indefinite', 'until_date')),
    until_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_eligibility_user_id ON user_eligibility(user_id);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_user_eligibility_until_date ON user_eligibility(until_date) WHERE until_date IS NOT NULL;

-- Create onboarding_requests table
CREATE TABLE IF NOT EXISTS onboarding_requests (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL,
    rank TEXT NOT NULL,
    dob DATE NOT NULL,
    doe DATE NOT NULL,
    msp_id TEXT NOT NULL REFERENCES msps(id),
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_username ON onboarding_requests(username);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status ON onboarding_requests(status);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_created_at ON onboarding_requests(created_at DESC);

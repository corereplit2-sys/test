/*
  # Initial Schema for MSC DRIVr v2
  
  1. New Tables
    - `msps` - Military Sub-units/Sections
      - `id` (uuid, primary key)
      - `name` (text, unique) - MSP name (e.g., "HQ", "MSP 1")
    
    - `users` - System users (soldiers, commanders, admins)
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `password_hash` (text) - bcrypt hashed password
      - `full_name` (text) - User's full name
      - `role` (text) - "admin" | "soldier" | "commander"
      - `credits` (double precision) - Mess booking credits
      - `rank` (text, nullable) - Military rank (e.g., "CPT", "3SG", "PTE")
      - `msp_id` (uuid, foreign key to msps) - Assigned MSP/unit
    
    - `bookings` - Mess room reservations
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `start_time` (timestamp with timezone)
      - `end_time` (timestamp with timezone)
      - `credits_charged` (double precision)
      - `status` (text) - "active" | "cancelled"
      - `created_at` (timestamp with timezone)
      - `cancelled_at` (timestamp with timezone, nullable)
    
    - `config` - System configuration key-value store
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (text)
    
    - `driver_qualifications` - Driver currency tracking
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `vehicle_type` (text) - "TERREX" | "BELREX"
      - `qualified_on_date` (date)
      - `last_drive_date` (date, nullable)
      - `currency_expiry_date` (date)
    
    - `drive_logs` - Individual drive records
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `vehicle_type` (text) - "TERREX" | "BELREX"
      - `vehicle_no` (text) - 5-digit vehicle number
      - `date` (date) - Date of drive
      - `initial_mileage_km` (double precision)
      - `final_mileage_km` (double precision)
      - `distance_km` (double precision) - Calculated distance
      - `remarks` (text, nullable)
      - `created_at` (timestamp with timezone)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
*/

-- Create MSPs table
CREATE TABLE IF NOT EXISTS msps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL,
  credits double precision NOT NULL DEFAULT 10,
  rank text,
  msp_id uuid REFERENCES msps(id) ON DELETE SET NULL
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  credits_charged double precision NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

-- Create config table
CREATE TABLE IF NOT EXISTS config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL
);

-- Create driver_qualifications table
CREATE TABLE IF NOT EXISTS driver_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  qualified_on_date date NOT NULL,
  last_drive_date date,
  currency_expiry_date date NOT NULL
);

-- Create drive_logs table
CREATE TABLE IF NOT EXISTS drive_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL,
  vehicle_no text NOT NULL,
  date date NOT NULL,
  initial_mileage_km double precision NOT NULL,
  final_mileage_km double precision NOT NULL,
  distance_km double precision NOT NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE msps ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_logs ENABLE ROW LEVEL SECURITY;

-- Policies for msps (all authenticated users can read)
CREATE POLICY "Allow read access to all authenticated users" ON msps
  FOR SELECT TO authenticated USING (true);

-- Policies for users (session-based auth, not Supabase auth)
CREATE POLICY "Allow all operations for service role" ON users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for bookings (session-based auth, not Supabase auth)
CREATE POLICY "Allow all operations for service role" ON bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for config (session-based auth, not Supabase auth)
CREATE POLICY "Allow all operations for service role" ON config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for driver_qualifications (session-based auth, not Supabase auth)
CREATE POLICY "Allow all operations for service role" ON driver_qualifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policies for drive_logs (session-based auth, not Supabase auth)
CREATE POLICY "Allow all operations for service role" ON drive_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
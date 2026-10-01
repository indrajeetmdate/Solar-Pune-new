-- ========================================================
-- Solar Proposal Database Schema (PostgreSQL / Supabase)
-- ========================================================

-- 1. Create table with complete schema (all columns + JSONB state_data)
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  proposal_serial_no VARCHAR(100),
  customer_name VARCHAR(255),
  mobile_number VARCHAR(50),
  email_address VARCHAR(255),
  customer_address TEXT,
  sanctioned_load NUMERIC(10, 2),
  system_capacity_kw NUMERIC(10, 2),
  total_cost NUMERIC(12, 2),
  state_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_proposals_serial_no ON proposals(proposal_serial_no);
CREATE INDEX IF NOT EXISTS idx_proposals_customer_name ON proposals(customer_name);
CREATE INDEX IF NOT EXISTS idx_proposals_mobile_number ON proposals(mobile_number);
CREATE INDEX IF NOT EXISTS idx_proposals_email_address ON proposals(email_address);

-- 3. GIN index for high-speed indexing & querying inside state_data JSONB
-- (Allows instant search on rates, CAD objects, loan terms, multi-meter info, etc.)
CREATE INDEX IF NOT EXISTS idx_proposals_state_data_gin ON proposals USING GIN (state_data);

-- 4. Trigger to automatically update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_proposals_modtime ON proposals;

CREATE TRIGGER update_proposals_modtime 
BEFORE UPDATE ON proposals 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ========================================================
-- MIGRATION SCRIPT FOR EXISTING DATABASES
-- (Run this if you already created the proposals table earlier)
-- ========================================================
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS proposal_serial_no VARCHAR(100);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sanctioned_load NUMERIC(10, 2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS system_capacity_kw NUMERIC(10, 2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_proposals_serial_no ON proposals(proposal_serial_no);
CREATE INDEX IF NOT EXISTS idx_proposals_email_address ON proposals(email_address);
CREATE INDEX IF NOT EXISTS idx_proposals_state_data_gin ON proposals USING GIN (state_data);

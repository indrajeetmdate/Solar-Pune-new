-- ========================================================
-- Solar Proposal Database Schema (PostgreSQL / Supabase)
-- ========================================================

-- 1. Create table with complete schema (all columns + JSONB state_data)
CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_serial_no VARCHAR(100) UNIQUE NOT NULL,
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

-- 2. Enable Row Level Security (RLS) & Policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON proposals
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON proposals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON proposals
  FOR UPDATE USING (true) WITH CHECK (true);

-- 3. Indexes for fast search and filtering
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
-- (Run this in Supabase SQL Editor or psql)
-- ========================================================
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS proposal_serial_no VARCHAR(100);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sanctioned_load NUMERIC(10, 2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS system_capacity_kw NUMERIC(10, 2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_proposals_serial_no ON proposals(proposal_serial_no);
CREATE INDEX IF NOT EXISTS idx_proposals_email_address ON proposals(email_address);
CREATE INDEX IF NOT EXISTS idx_proposals_state_data_gin ON proposals USING GIN (state_data);

-- ========================================================
-- 1. HISTORICAL PROPOSALS BACKWARDS RENUMBERING FROM 1139
-- (Renumber existing historical proposals counting backwards
-- from 1139 down so new proposals will start cleanly at 1140)
-- ========================================================
DO $$
DECLARE
    r RECORD;
    curr_num INTEGER := 1139; -- Top historical anchor (new proposals start at 1140)
    calc_fy TEXT;
    formatted_serial TEXT;
    created_ts TIMESTAMP WITH TIME ZONE;
    m INTEGER;
    y INTEGER;
    fy_start INTEGER;
    fy_end INTEGER;
BEGIN
    -- Loop through all historical proposals ordered from newest to oldest
    FOR r IN (
        SELECT id, created_at, proposal_serial_no, state_data 
        FROM proposals 
        ORDER BY created_at DESC, id DESC
    ) LOOP
        created_ts := COALESCE(r.created_at, NOW());
        m := EXTRACT(MONTH FROM created_ts);
        y := EXTRACT(YEAR FROM created_ts);
        IF m >= 4 THEN
            fy_start := y;
        ELSE
            fy_start := y - 1;
        END IF;
        fy_end := (fy_start + 1) % 100;
        calc_fy := fy_start || '-' || LPAD(fy_end::TEXT, 2, '0');
        formatted_serial := 'DC/' || calc_fy || '/PROP-' || curr_num;

        -- Update proposal_serial_no and synchronize inside state_data JSONB
        UPDATE proposals
        SET 
            proposal_serial_no = formatted_serial,
            state_data = jsonb_set(
                jsonb_set(
                    jsonb_set(
                        COALESCE(state_data, '{}'::jsonb),
                        '{reportDisplay,proposalSerialNo}',
                        to_jsonb(formatted_serial),
                        true
                    ),
                    '{formValues,proposalSerialNo}',
                    to_jsonb(formatted_serial),
                    true
                ),
                '{input,proposalSerialNo}',
                to_jsonb(formatted_serial),
                true
            )
        WHERE id = r.id;

        curr_num := curr_num - 1;
    END LOOP;
END $$;

-- ========================================================
-- 2. ENFORCE UNIQUE CONSTRAINT TO AVOID DUPLICATES
-- ========================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposals_proposal_serial_no_key'
    ) THEN
        ALTER TABLE proposals ADD CONSTRAINT proposals_proposal_serial_no_key UNIQUE (proposal_serial_no);
    END IF;
END $$;

-- ========================================================
-- 3. HELPER FUNCTION: GET NEXT PROPOSAL SERIAL NUMBER
-- Returns the next serial number counting after the latest
-- proposal (starts at 1140 if no proposals >= 1140 exist).
-- ========================================================
CREATE OR REPLACE FUNCTION get_next_proposal_serial()
RETURNS TEXT AS $$
DECLARE
    max_num INTEGER := 1139;
    next_num INTEGER;
    cand_num INTEGER;
    rec RECORD;
    fy TEXT;
    m INTEGER := EXTRACT(MONTH FROM NOW());
    y INTEGER := EXTRACT(YEAR FROM NOW());
    fy_start INTEGER;
    fy_end INTEGER;
BEGIN
    IF m >= 4 THEN
        fy_start := y;
    ELSE
        fy_start := y - 1;
    END IF;
    fy_end := (fy_start + 1) % 100;
    fy := fy_start || '-' || LPAD(fy_end::TEXT, 2, '0');

    FOR rec IN SELECT proposal_serial_no FROM proposals WHERE proposal_serial_no IS NOT NULL LOOP
        cand_num := (regexp_match(rec.proposal_serial_no, '(\d+)$'))[1]::INTEGER;
        IF cand_num IS NOT NULL AND cand_num > max_num THEN
            max_num := cand_num;
        END IF;
    END LOOP;

    next_num := max_num + 1;
    RETURN 'DC/' || fy || '/PROP-' || next_num;
END;
$$ LANGUAGE plpgsql;

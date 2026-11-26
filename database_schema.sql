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

CREATE POLICY "Allow public delete" ON proposals
  FOR DELETE USING (true);

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
-- 2. ENFORCE UNIQUE CONSTRAINT & DELETE POLICY
-- ========================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposals_proposal_serial_no_key'
    ) THEN
        ALTER TABLE proposals ADD CONSTRAINT proposals_proposal_serial_no_key UNIQUE (proposal_serial_no);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'proposals' AND policyname = 'Allow public delete'
    ) THEN
        CREATE POLICY "Allow public delete" ON proposals FOR DELETE USING (true);
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

-- ========================================================
-- 4. SOLAR CRM LEADS & PIPELINE TRACKING
-- ========================================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(50),
  email_address VARCHAR(255),
  customer_address TEXT,
  monthly_units NUMERIC(10, 2),
  monthly_bill NUMERIC(12, 2),
  sanctioned_load NUMERIC(10, 2),
  system_capacity_kw NUMERIC(10, 2),
  estimated_cost NUMERIC(12, 2),
  status VARCHAR(50) DEFAULT 'lead', -- 'lead', 'site_visit_scheduled', 'site_visit_done', 'proposal_sent', 'won', 'lost'
  assigned_to VARCHAR(255),
  assigned_name VARCHAR(255),
  proposal_serial_no VARCHAR(100),
  proposal_id UUID,
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read crm_leads" ON crm_leads;
DROP POLICY IF EXISTS "Allow public insert crm_leads" ON crm_leads;
DROP POLICY IF EXISTS "Allow public update crm_leads" ON crm_leads;
DROP POLICY IF EXISTS "Allow public delete crm_leads" ON crm_leads;

CREATE POLICY "Allow public read crm_leads" ON crm_leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_leads" ON crm_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_leads" ON crm_leads FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete crm_leads" ON crm_leads FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created ON crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_customer_name ON crm_leads(customer_name);
CREATE INDEX IF NOT EXISTS idx_crm_leads_mobile ON crm_leads(mobile_number);
CREATE INDEX IF NOT EXISTS idx_crm_leads_proposal_serial_no ON crm_leads(proposal_serial_no);
CREATE INDEX IF NOT EXISTS idx_crm_leads_proposal_id ON crm_leads(proposal_id);

-- Add foreign key constraint with ON DELETE SET NULL
-- (Deleting a proposal detaches it from the lead without deleting customer contact info)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_crm_leads_proposal_id'
    ) THEN
        ALTER TABLE crm_leads 
        ADD CONSTRAINT fk_crm_leads_proposal_id 
        FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ========================================================
-- 5. AUTOMATIC BIDIRECTIONAL SYNC TRIGGERS
-- ========================================================

-- Trigger A: When a proposal is inserted or updated, auto-sync into crm_leads
CREATE OR REPLACE FUNCTION sync_proposal_to_crm_lead()
RETURNS TRIGGER AS $$
DECLARE
    matched_lead_id UUID;
BEGIN
    -- Prevent recursive trigger cascades with trg_sync_crm_lead_to_proposal
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- Check if lead exists by proposal_serial_no, proposal_id, or mobile_number
    SELECT id INTO matched_lead_id
    FROM crm_leads
    WHERE proposal_serial_no = NEW.proposal_serial_no
       OR (NEW.id IS NOT NULL AND proposal_id = NEW.id)
       OR (NEW.mobile_number IS NOT NULL AND mobile_number = NEW.mobile_number)
    LIMIT 1;

    IF matched_lead_id IS NOT NULL THEN
        -- Only promote 'lead' -> 'proposal_sent' the first time a proposal is attached
        UPDATE crm_leads
        SET
            customer_name = COALESCE(NEW.customer_name, customer_name),
            mobile_number = COALESCE(NEW.mobile_number, mobile_number),
            email_address = COALESCE(NEW.email_address, email_address),
            customer_address = COALESCE(NEW.customer_address, customer_address),
            sanctioned_load = COALESCE(NEW.sanctioned_load, sanctioned_load),
            system_capacity_kw = COALESCE(NEW.system_capacity_kw, system_capacity_kw),
            estimated_cost = COALESCE(NEW.total_cost, estimated_cost),
            proposal_serial_no = NEW.proposal_serial_no,
            proposal_id = NEW.id,
            status = CASE
                WHEN status = 'lead'
                 AND COALESCE(proposal_serial_no, '') = ''
                 AND proposal_id IS NULL
                THEN 'proposal_sent'
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = matched_lead_id;
    ELSE
        -- Insert new CRM Lead
        INSERT INTO crm_leads (
            customer_name,
            mobile_number,
            email_address,
            customer_address,
            sanctioned_load,
            system_capacity_kw,
            estimated_cost,
            status,
            assigned_to,
            assigned_name,
            proposal_serial_no,
            proposal_id,
            notes,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(NEW.customer_name, 'Customer'),
            NEW.mobile_number,
            NEW.email_address,
            COALESCE(NEW.customer_address, 'Pune, Maharashtra'),
            NEW.sanctioned_load,
            NEW.system_capacity_kw,
            NEW.total_cost,
            'proposal_sent',
            'indrajeet.date@cnergy.co.in',
            'Indrajeet Date',
            NEW.proposal_serial_no,
            NEW.id,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 'note_' || EXTRACT(EPOCH FROM NOW())::TEXT,
                    'text', 'Auto-created from Proposal ' || NEW.proposal_serial_no,
                    'author', 'Proposal Sync Engine',
                    'created_at', NOW()
                )
            ),
            COALESCE(NEW.created_at, NOW()),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_proposal_to_crm ON proposals;

CREATE TRIGGER trg_sync_proposal_to_crm
AFTER INSERT OR UPDATE ON proposals
FOR EACH ROW EXECUTE PROCEDURE sync_proposal_to_crm_lead();


-- Trigger B: When a proposal is deleted, clear reference on crm_leads and log note
CREATE OR REPLACE FUNCTION sync_proposal_deletion_to_crm()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE crm_leads
    SET
        proposal_serial_no = NULL,
        proposal_id = NULL,
        status = CASE WHEN status = 'proposal_sent' THEN 'lead' ELSE status END,
        notes = jsonb_build_array(
            jsonb_build_object(
                'id', 'note_' || EXTRACT(EPOCH FROM NOW())::TEXT,
                'text', 'Attached proposal ' || OLD.proposal_serial_no || ' was deleted.',
                'author', 'Proposal Sync Engine',
                'created_at', NOW()
            )
        ) || COALESCE(notes, '[]'::jsonb),
        updated_at = NOW()
    WHERE proposal_serial_no = OLD.proposal_serial_no
       OR proposal_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_proposal_deletion_to_crm ON proposals;

CREATE TRIGGER trg_sync_proposal_deletion_to_crm
AFTER DELETE ON proposals
FOR EACH ROW EXECUTE PROCEDURE sync_proposal_deletion_to_crm();


-- Trigger C: When CRM customer basic info is edited, sync to proposal table
CREATE OR REPLACE FUNCTION sync_crm_lead_to_proposal()
RETURNS TRIGGER AS $$
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.proposal_serial_no IS NOT NULL AND (
        OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
        OLD.mobile_number IS DISTINCT FROM NEW.mobile_number OR
        OLD.email_address IS DISTINCT FROM NEW.email_address OR
        OLD.customer_address IS DISTINCT FROM NEW.customer_address OR
        OLD.sanctioned_load IS DISTINCT FROM NEW.sanctioned_load OR
        OLD.system_capacity_kw IS DISTINCT FROM NEW.system_capacity_kw OR
        OLD.estimated_cost IS DISTINCT FROM NEW.estimated_cost
    ) THEN
        UPDATE proposals
        SET
            customer_name = NEW.customer_name,
            mobile_number = NEW.mobile_number,
            email_address = NEW.email_address,
            customer_address = NEW.customer_address,
            sanctioned_load = COALESCE(NEW.sanctioned_load, sanctioned_load),
            system_capacity_kw = COALESCE(NEW.system_capacity_kw, system_capacity_kw),
            total_cost = COALESCE(NEW.estimated_cost, total_cost),
            state_data = jsonb_set(
                jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            COALESCE(state_data, '{}'::jsonb),
                            '{input,customerName}',
                            to_jsonb(NEW.customer_name),
                            true
                        ),
                        '{input,mobileNumber}',
                        to_jsonb(COALESCE(NEW.mobile_number, '')),
                        true
                    ),
                    '{formValues,customerName}',
                    to_jsonb(NEW.customer_name),
                    true
                ),
                '{formValues,mobileNumber}',
                to_jsonb(COALESCE(NEW.mobile_number, '')),
                true
            ),
            updated_at = NOW()
        WHERE proposal_serial_no = NEW.proposal_serial_no
           OR id = NEW.proposal_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_crm_lead_to_proposal ON crm_leads;

CREATE TRIGGER trg_sync_crm_lead_to_proposal
AFTER UPDATE OF customer_name, mobile_number, email_address, customer_address, sanctioned_load, system_capacity_kw, estimated_cost ON crm_leads
FOR EACH ROW EXECUTE PROCEDURE sync_crm_lead_to_proposal();


-- ========================================================
-- 6. ONE-TIME HISTORICAL PROPOSALS BACKFILL TO CRM LEADS
-- (Run this once in Supabase SQL editor to sync past customers)
-- ========================================================
INSERT INTO crm_leads (
    customer_name,
    mobile_number,
    email_address,
    customer_address,
    sanctioned_load,
    system_capacity_kw,
    estimated_cost,
    status,
    assigned_to,
    assigned_name,
    proposal_serial_no,
    proposal_id,
    notes,
    created_at,
    updated_at
)
SELECT
    COALESCE(p.customer_name, 'Customer'),
    p.mobile_number,
    p.email_address,
    COALESCE(p.customer_address, 'Pune, Maharashtra'),
    p.sanctioned_load,
    p.system_capacity_kw,
    p.total_cost,
    'proposal_sent',
    'indrajeet.date@cnergy.co.in',
    'Indrajeet Date',
    p.proposal_serial_no,
    p.id,
    jsonb_build_array(
        jsonb_build_object(
            'id', 'note_mig_' || EXTRACT(EPOCH FROM NOW())::TEXT,
            'text', 'Historical proposal ' || p.proposal_serial_no || ' migrated into CRM lead pipeline.',
            'author', 'System Migration',
            'created_at', NOW()
        )
    ),
    COALESCE(p.created_at, NOW()),
    NOW()
FROM proposals p
WHERE NOT EXISTS (
    SELECT 1 FROM crm_leads l 
    WHERE l.proposal_serial_no = p.proposal_serial_no 
       OR (p.mobile_number IS NOT NULL AND l.mobile_number = p.mobile_number)
);



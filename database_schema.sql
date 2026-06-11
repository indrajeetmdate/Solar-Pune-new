-- Connect to your PostgreSQL database and run this to create the table.

CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(255),
  mobile_number VARCHAR(50),
  email_address VARCHAR(255),
  state_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index to make search faster when loading proposals
CREATE INDEX IF NOT EXISTS idx_proposals_customer_name ON proposals(customer_name);
CREATE INDEX IF NOT EXISTS idx_proposals_mobile_number ON proposals(mobile_number);

-- Optional: Create a trigger to automatically update the updated_at column
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

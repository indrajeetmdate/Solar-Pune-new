import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { search } = req.query;
    
    let query;
    let values = [];

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query = `
        SELECT id, customer_name, mobile_number, email_address, created_at, state_data
        FROM proposals
        WHERE customer_name ILIKE $1 
           OR mobile_number ILIKE $1 
           OR email_address ILIKE $1
        ORDER BY created_at DESC
        LIMIT 50;
      `;
      values = [searchTerm];
    } else {
      query = `
        SELECT id, customer_name, mobile_number, email_address, created_at, state_data
        FROM proposals
        ORDER BY created_at DESC
        LIMIT 50;
      `;
    }

    const result = await pool.query(query, values);
    
    return res.status(200).json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('Error loading proposals:', error);
    return res.status(500).json({ error: 'Failed to load proposals: ' + error.message });
  }
}

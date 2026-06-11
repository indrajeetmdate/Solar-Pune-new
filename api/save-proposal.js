import pg from 'pg';
const { Pool } = pg;

// Use standard PG environment variables like POSTGRES_URL
// If not present, it will try to use PGHOST, PGUSER, PGPASSWORD, PGDATABASE
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL ? { rejectUnauthorized: false } : false
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { customerName, mobileNumber, emailAddress, stateData } = req.body;

    if (!stateData) {
      return res.status(400).json({ error: 'stateData is required' });
    }

    const query = `
      INSERT INTO proposals (customer_name, mobile_number, email_address, state_data)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    
    const values = [
      customerName || '',
      mobileNumber || '',
      emailAddress || '',
      JSON.stringify(stateData)
    ];

    const result = await pool.query(query, values);
    
    return res.status(200).json({ 
      success: true, 
      id: result.rows[0].id,
      message: 'Proposal saved successfully'
    });
  } catch (error) {
    console.error('Error saving proposal:', error);
    return res.status(500).json({ error: 'Failed to save proposal' });
  }
}

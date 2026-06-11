import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { search } = req.query;
    let query = supabase
      .from('proposals')
      .select('id, customer_name, mobile_number, email_address, created_at, state_data')
      .order('created_at', { ascending: false })
      .limit(50);

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`customer_name.ilike.${searchTerm},mobile_number.ilike.${searchTerm},email_address.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    return res.status(200).json({ 
      success: true, 
      data: data 
    });
  } catch (error) {
    console.error('Error loading proposals:', error);
    return res.status(500).json({ error: 'Failed to load proposals: ' + error.message });
  }
}

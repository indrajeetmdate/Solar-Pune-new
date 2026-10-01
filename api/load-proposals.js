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

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      
      // Attempt search including proposal_serial_no
      const { data: advancedData, error: advancedError } = await supabase
        .from('proposals')
        .select('*')
        .or(`customer_name.ilike.${searchTerm},mobile_number.ilike.${searchTerm},email_address.ilike.${searchTerm},proposal_serial_no.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!advancedError) {
        return res.status(200).json({ success: true, data: advancedData });
      }

      // If proposal_serial_no column not yet migrated in database, fall back to core columns search
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('proposals')
        .select('*')
        .or(`customer_name.ilike.${searchTerm},mobile_number.ilike.${searchTerm},email_address.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fallbackError) throw fallbackError;
      return res.status(200).json({ success: true, data: fallbackData });
    }

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

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

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { customerName, mobileNumber, emailAddress, stateData } = req.body;

    if (!stateData) {
      return res.status(400).json({ error: 'stateData is required' });
    }

    const { data, error } = await supabase
      .from('proposals')
      .insert([
        {
          customer_name: customerName || '',
          mobile_number: mobileNumber || '',
          email_address: emailAddress || '',
          state_data: stateData
        }
      ])
      .select('id')
      .single();

    if (error) throw error;
    
    return res.status(200).json({ 
      success: true, 
      id: data.id,
      message: 'Proposal saved successfully'
    });
  } catch (error) {
    console.error('Error saving proposal:', error);
    return res.status(500).json({ error: 'Failed to save proposal: ' + error.message });
  }
}

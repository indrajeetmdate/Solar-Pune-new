import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  // Allow both POST and DELETE methods
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ 
      success: false, 
      message: 'Database environment variables not configured' 
    });
  }

  try {
    const body = req.body || {};
    const id = body.id || req.query.id;
    const proposalSerialNo = body.proposalSerialNo || body.proposal_serial_no || req.query.proposalSerialNo;

    if (!id && !proposalSerialNo) {
      return res.status(400).json({ 
        success: false, 
        error: 'Proposal ID or Proposal Serial Number is required for deletion' 
      });
    }

    let query = supabase.from('proposals').delete();

    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('proposal_serial_no', proposalSerialNo);
    }

    const { error, data } = await query;
    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Proposal deleted successfully from cloud database',
      id: id || null,
      proposalSerialNo: proposalSerialNo || null
    });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function getFinancialYear(d = new Date()) {
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  const start = m >= 4 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, '0')}`;
}

export function calculateLatestSerialInfo(proposalsList) {
  const fy = getFinancialYear();
  let maxNum = 1139; // Starting anchor: new proposals start with 1140 (1139 + 1)
  const prefixRegex = new RegExp(`^DC[/-]${fy}[/-]PROP-(\\d+)$`, "i");

  if (Array.isArray(proposalsList)) {
    proposalsList.forEach((p) => {
      const candidates = [
        p.proposal_serial_no,
        p.proposalSerialNo,
        p.state_data?.reportDisplay?.proposalSerialNo,
        p.state_data?.formValues?.proposalSerialNo,
        p.state_data?.input?.proposalSerialNo,
      ];
      candidates.forEach((cand) => {
        if (typeof cand === 'string') {
          const trimmed = cand.trim();
          const otherFyMatch = trimmed.match(/^DC[/-](\d{4}-\d{2})[/-]/i);
          if (otherFyMatch && otherFyMatch[1] !== fy) {
            // Belongs to a different financial year
            return;
          }
          let num = null;
          const mFy = trimmed.match(prefixRegex);
          if (mFy && mFy[1]) {
            num = parseInt(mFy[1], 10);
          } else {
            const mGeneric = trimmed.match(/PROP-(\d+)/i) || trimmed.match(/^(\d{3,})$/);
            if (mGeneric && mGeneric[1]) {
              num = parseInt(mGeneric[1], 10);
            }
          }
          if (num !== null && !isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
    });
  }

  return {
    latestSerialNum: maxNum,
    nextSerialNum: maxNum + 1,
    latestProposalSerialNo: `DC/${fy}/PROP-${maxNum}`,
    nextProposalSerialNo: `DC/${fy}/PROP-${maxNum + 1}`,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    const fallbackInfo = calculateLatestSerialInfo([]);
    return res.status(200).json({ 
      success: false, 
      data: [], 
      message: 'Database environment variables not configured',
      ...fallbackInfo 
    });
  }

  try {
    const { search, latest } = req.query;

    // Fast-path: Auto-recognise latest proposal number on app load
    if (latest === 'true') {
      const { data: recentProposals, error: recentError } = await supabase
        .from('proposals')
        .select('id, proposal_serial_no, customer_name, mobile_number, email_address, created_at, state_data')
        .order('created_at', { ascending: false })
        .limit(100);

      if (recentError) throw recentError;
      const serialInfo = calculateLatestSerialInfo(recentProposals || []);
      return res.status(200).json({
        success: true,
        data: recentProposals || [],
        ...serialInfo
      });
    }

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
        const serialInfo = calculateLatestSerialInfo(advancedData || []);
        return res.status(200).json({ success: true, data: advancedData, ...serialInfo });
      }

      // If proposal_serial_no column not yet migrated in database, fall back to core columns search
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('proposals')
        .select('*')
        .or(`customer_name.ilike.${searchTerm},mobile_number.ilike.${searchTerm},email_address.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fallbackError) throw fallbackError;
      const serialInfo = calculateLatestSerialInfo(fallbackData || []);
      return res.status(200).json({ success: true, data: fallbackData, ...serialInfo });
    }

    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    const serialInfo = calculateLatestSerialInfo(data || []);
    return res.status(200).json({ 
      success: true, 
      data: data,
      ...serialInfo
    });
  } catch (error) {
    console.error('Error loading proposals:', error);
    return res.status(500).json({ error: 'Failed to load proposals: ' + error.message });
  }
}

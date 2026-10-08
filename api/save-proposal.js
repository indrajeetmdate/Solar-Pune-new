import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ success: false, message: 'Database environment variables not configured' });
  }

  try {
    const { customerName, mobileNumber, emailAddress, stateData } = req.body;

    if (!stateData) {
      return res.status(400).json({ error: 'stateData is required' });
    }

    const proposalSerialNo = req.body.proposalSerialNo ||
                             req.body.proposal_serial_no ||
                             stateData.reportDisplay?.proposalSerialNo || 
                             stateData.formValues?.proposalSerialNo || 
                             stateData.input?.proposalSerialNo || null;

    const customerAddress = stateData.reportDisplay?.customerAddress || 
                            stateData.formValues?.customerAddress || 
                            stateData.input?.customerAddress || null;

    const sanctionedLoad = stateData.formValues?.sanctionedLoad !== undefined ? Number(stateData.formValues.sanctionedLoad) :
                          (stateData.input?.sanctionedLoad !== undefined ? Number(stateData.input.sanctionedLoad) : null);

    const systemCapacityKw = stateData.state?.estimates?.recommended?.dcCapacityKw !== undefined ? Number(stateData.state.estimates.recommended.dcCapacityKw) :
                             (stateData.sizing?.capacityOverride !== undefined ? Number(stateData.sizing.capacityOverride) : null);

    const totalCost = stateData.state?.estimates?.recommended?.netCost !== undefined ? Number(stateData.state.estimates.recommended.netCost) :
                      (stateData.state?.estimates?.recommended?.totalPreSubsidy !== undefined ? Number(stateData.state.estimates.recommended.totalPreSubsidy) : null);

    const recordWithExtras = {
      customer_name: customerName || '',
      mobile_number: mobileNumber || '',
      email_address: emailAddress || '',
      proposal_serial_no: proposalSerialNo,
      customer_address: customerAddress,
      sanctioned_load: Number.isFinite(sanctionedLoad) ? sanctionedLoad : null,
      system_capacity_kw: Number.isFinite(systemCapacityKw) ? systemCapacityKw : null,
      total_cost: Number.isFinite(totalCost) ? totalCost : null,
      state_data: stateData
    };

    // Check if a proposal with this unique proposal_serial_no already exists
    let existing = null;
    if (proposalSerialNo) {
      const { data: found } = await supabase
        .from('proposals')
        .select('id')
        .eq('proposal_serial_no', proposalSerialNo)
        .maybeSingle();
      existing = found;
    }

    let result;
    if (existing && existing.id) {
      result = await supabase
        .from('proposals')
        .update(recordWithExtras)
        .eq('id', existing.id)
        .select('id')
        .single();
    } else {
      result = await supabase
        .from('proposals')
        .insert([recordWithExtras])
        .select('id')
        .single();
    }

    // If database table does not yet have newly added columns, fall back gracefully to core schema
    if (result.error && (result.error.code === '42703' || (result.error.message && result.error.message.includes('column')))) {
      console.warn('Top-level proposal columns not yet migrated in database, falling back to core schema:', result.error.message);
      const fallbackRecord = {
        customer_name: customerName || '',
        mobile_number: mobileNumber || '',
        email_address: emailAddress || '',
        state_data: stateData
      };

      if (existing && existing.id) {
        result = await supabase
          .from('proposals')
          .update(fallbackRecord)
          .eq('id', existing.id)
          .select('id')
          .single();
      } else {
        result = await supabase
          .from('proposals')
          .insert([fallbackRecord])
          .select('id')
          .single();
      }
    }

    if (result.error) throw result.error;
    
    return res.status(200).json({ 
      success: true, 
      id: result.data.id,
      proposal_serial_no: proposalSerialNo,
      message: 'Proposal saved successfully'
    });
  } catch (error) {
    console.error('Error saving proposal:', error);
    return res.status(500).json({ error: 'Failed to save proposal: ' + error.message });
  }
}

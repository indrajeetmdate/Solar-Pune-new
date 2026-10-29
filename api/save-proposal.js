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
  return `${start}-${String(end).padStart(2, "0")}`;
}

async function getNextAvailableSerialNo(supabase) {
  const fy = getFinancialYear();
  let maxNum = 1139; // Starting anchor: new proposals start with 1140 (1139 + 1)
  const prefixRegex = new RegExp(`^DC[/-]${fy}[/-]PROP-(\\d+)$`, "i");

  try {
    const { data: recents } = await supabase
      .from('proposals')
      .select('proposal_serial_no, state_data')
      .order('created_at', { ascending: false })
      .limit(100);

    if (Array.isArray(recents)) {
      recents.forEach(p => {
        const candidates = [
          p.proposal_serial_no,
          p.state_data?.reportDisplay?.proposalSerialNo,
          p.state_data?.formValues?.proposalSerialNo,
          p.state_data?.input?.proposalSerialNo,
        ];
        candidates.forEach(cand => {
          if (typeof cand === 'string') {
            const trimmed = cand.trim();
            const otherFyMatch = trimmed.match(/^DC[/-](\d{4}-\d{2})[/-]/i);
            if (otherFyMatch && otherFyMatch[1] !== fy) {
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
            if (num !== null && !isNaN(num) && num > maxNum) maxNum = num;
          }
        });
      });
    }
  } catch (_) {}

  return `DC/${fy}/PROP-${maxNum + 1}`;
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

    let proposalSerialNo = req.body.proposalSerialNo ||
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

    const isNewProposal = Boolean(req.body.isNewProposal || req.body.isNew);

    // Check if a proposal already exists (Update in place, do NOT create duplicate entries):
    // 1. Check by ID if provided (from previous save or loaded proposal)
    let existing = null;
    if (req.body.id) {
      try {
        const { data: foundById } = await supabase
          .from('proposals')
          .select('id, proposal_serial_no')
          .eq('id', req.body.id)
          .maybeSingle();
        if (foundById && foundById.id) existing = foundById;
      } catch (_) {}
    }

    // 2. Check by proposal_serial_no column if not found by ID (only if NOT explicitly creating a new proposal)
    if (!existing && !isNewProposal && proposalSerialNo) {
      try {
        const { data: foundBySerial, error: serialErr } = await supabase
          .from('proposals')
          .select('id, proposal_serial_no')
          .eq('proposal_serial_no', proposalSerialNo)
          .maybeSingle();
        if (!serialErr && foundBySerial && foundBySerial.id) {
          existing = foundBySerial;
        }
      } catch (_) {}
    }

    // 3. Fallback: Check inside state_data JSON if not a new proposal
    if (!existing && !isNewProposal && proposalSerialNo) {
      try {
        const { data: foundInJson } = await supabase
          .from('proposals')
          .select('id, proposal_serial_no')
          .filter('state_data->reportDisplay->>proposalSerialNo', 'eq', proposalSerialNo)
          .limit(1)
          .maybeSingle();
        if (foundInJson && foundInJson.id) {
          existing = foundInJson;
        }
      } catch (_) {}
    }

    // 4. Duplicate Guard for New Proposals:
    // If saving as a new proposal (or no existing match), verify proposal_serial_no is not already taken.
    // If it exists in the database, auto-advance to avoid saving duplicate numbers.
    let finalSerialNo = proposalSerialNo || `DC/${getFinancialYear()}/PROP-1140`;

    if (!existing) {
      try {
        const { data: conflict } = await supabase
          .from('proposals')
          .select('id, proposal_serial_no')
          .eq('proposal_serial_no', finalSerialNo)
          .maybeSingle();

        if (conflict && conflict.id) {
          // Serial number is already in use by another proposal in database!
          // Auto-advance counting after the latest proposal to avoid duplicate saving.
          finalSerialNo = await getNextAvailableSerialNo(supabase);
        }
      } catch (_) {}
    }

    // Ensure serial numbers match across stateData
    if (stateData.reportDisplay) stateData.reportDisplay.proposalSerialNo = finalSerialNo;
    if (stateData.formValues) stateData.formValues.proposalSerialNo = finalSerialNo;
    if (stateData.input) stateData.input.proposalSerialNo = finalSerialNo;

    const recordWithExtras = {
      customer_name: customerName || '',
      mobile_number: mobileNumber || '',
      email_address: emailAddress || '',
      proposal_serial_no: finalSerialNo,
      customer_address: customerAddress,
      sanctioned_load: Number.isFinite(sanctionedLoad) ? sanctionedLoad : null,
      system_capacity_kw: Number.isFinite(systemCapacityKw) ? systemCapacityKw : null,
      total_cost: Number.isFinite(totalCost) ? totalCost : null,
      state_data: stateData
    };

    let result;
    if (existing && existing.id) {
      // Update existing proposal in place
      result = await supabase
        .from('proposals')
        .update(recordWithExtras)
        .eq('id', existing.id)
        .select('id')
        .single();
    } else {
      // Insert new proposal
      result = await supabase
        .from('proposals')
        .insert([recordWithExtras])
        .select('id')
        .single();

      // Catch duplicate key unique constraint violation (PostgreSQL code 23505)
      if (result.error && (result.error.code === '23505' || result.error.message?.includes('duplicate key') || result.error.message?.includes('unique constraint'))) {
        console.warn('Duplicate proposal serial detected, auto-incrementing to next fresh serial number...');
        finalSerialNo = await getNextAvailableSerialNo(supabase);
        recordWithExtras.proposal_serial_no = finalSerialNo;
        if (stateData.reportDisplay) stateData.reportDisplay.proposalSerialNo = finalSerialNo;
        if (stateData.formValues) stateData.formValues.proposalSerialNo = finalSerialNo;
        result = await supabase
          .from('proposals')
          .insert([recordWithExtras])
          .select('id')
          .single();
      }
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

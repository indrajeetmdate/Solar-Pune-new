import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://supabase.cnergy.co.in';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function normalizePhone10(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function findExistingLead(supabase, candidate = {}) {
  const { id, proposal_serial_no, proposalSerialNo, mobile_number, mobileNumber, customer_name, customerName } = candidate;
  if (isUuid(id)) {
    const { data } = await supabase.from('crm_leads').select('*').eq('id', id).maybeSingle();
    if (data) return data;
  }
  const serial = proposal_serial_no || proposalSerialNo;
  if (serial) {
    const { data } = await supabase.from('crm_leads').select('*').eq('proposal_serial_no', serial).limit(1).maybeSingle();
    if (data) return data;
  }
  const phone10 = normalizePhone10(mobile_number || mobileNumber);
  if (phone10.length >= 7) {
    const { data } = await supabase.from('crm_leads').select('*').ilike('mobile_number', `%${phone10}`).limit(1).maybeSingle();
    if (data) return data;
  }
  const name = String(customer_name || customerName || '').trim();
  if (name && phone10.length === 0) {
    const { data } = await supabase.from('crm_leads').select('*').ilike('customer_name', name).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json({ success: true, data: [] });
    }
    try {
      const { status, search, id } = req.query || {};
      let query = supabase.from('crm_leads').select('*').order('created_at', { ascending: false });

      if (id) {
        if (!isUuid(id)) {
          return res.status(200).json({ success: true, data: [] });
        }
        query = query.eq('id', id);
      } else {
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        if (search && search.trim() !== '') {
          const s = `%${search.trim()}%`;
          query = query.or(`customer_name.ilike.${s},mobile_number.ilike.${s},customer_address.ilike.${s},assigned_name.ilike.${s}`);
        }
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return res.status(200).json({ success: true, data: data || [] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!supabase) {
      return res.status(200).json({ success: true, message: 'Offline mode: lead processed locally' });
    }
    try {
      const body = req.body || {};
      const { action } = body;

      // Sub-action: Add note and/or update status on lead (supports both UUID & synced non-UUID IDs)
      if (action === 'add_note') {
        const { id, noteText, authorName, newStatus, leadSnapshot } = body;
        if (!id || (!noteText && !newStatus)) {
          return res.status(400).json({ success: false, error: 'Lead ID and noteText or newStatus required' });
        }

        const existingLead = await findExistingLead(supabase, {
          id,
          ...(leadSnapshot || {}),
        });

        const newNote = {
          id: 'note_' + Date.now(),
          text: noteText || `Status changed to ${newStatus}`,
          author: authorName || 'Internal Agent',
          created_at: new Date().toISOString(),
        };

        if (existingLead && existingLead.id) {
          const currentNotes = Array.isArray(existingLead.notes) ? existingLead.notes : [];
          const updates = {
            notes: [newNote, ...currentNotes],
            updated_at: new Date().toISOString(),
          };
          if (newStatus) updates.status = newStatus;

          const { data: updated, error: updateErr } = await supabase
            .from('crm_leads')
            .update(updates)
            .eq('id', existingLead.id)
            .select()
            .single();

          if (updateErr) throw updateErr;
          return res.status(200).json({ success: true, data: updated });
        }

        // Lead existed only locally (e.g. proposal_sync or seed): create it in DB with requested status
        if (leadSnapshot && leadSnapshot.customer_name) {
          const insertRecord = {
            customer_name: leadSnapshot.customer_name,
            mobile_number: leadSnapshot.mobile_number || '',
            email_address: leadSnapshot.email_address || '',
            customer_address: leadSnapshot.customer_address || 'Pune, Maharashtra',
            monthly_units: leadSnapshot.monthly_units ?? null,
            monthly_bill: leadSnapshot.monthly_bill ?? null,
            sanctioned_load: leadSnapshot.sanctioned_load ?? null,
            system_capacity_kw: leadSnapshot.system_capacity_kw ?? null,
            estimated_cost: leadSnapshot.estimated_cost ?? null,
            status: newStatus || leadSnapshot.status || 'lead',
            assigned_to: leadSnapshot.assigned_to || 'indrajeet.date@cnergy.co.in',
            assigned_name: leadSnapshot.assigned_name || 'Indrajeet Date',
            proposal_serial_no: leadSnapshot.proposal_serial_no || null,
            notes: Array.isArray(leadSnapshot.notes) && leadSnapshot.notes.length > 0 ? leadSnapshot.notes : [newNote],
            updated_at: new Date().toISOString(),
          };
          const { data: inserted, error: insertErr } = await supabase
            .from('crm_leads')
            .insert([insertRecord])
            .select()
            .single();
          if (insertErr) throw insertErr;
          return res.status(200).json({ success: true, data: inserted });
        }

        return res.status(200).json({ success: true, message: 'Lead updated locally only' });
      }

      // Upsert lead
      const leadData = {
        customer_name: body.customer_name || body.customerName,
        mobile_number: body.mobile_number || body.mobileNumber,
        email_address: body.email_address || body.emailAddress,
        customer_address: body.customer_address || body.customerAddress,
        monthly_units: body.monthly_units ?? body.monthlyUnits,
        monthly_bill: body.monthly_bill ?? body.monthlyBill,
        sanctioned_load: body.sanctioned_load ?? body.sanctionedLoad,
        system_capacity_kw: body.system_capacity_kw ?? body.systemCapacityKw,
        estimated_cost: body.estimated_cost ?? body.estimatedCost,
        status: body.status || 'lead',
        assigned_to: body.assigned_to || body.assignedTo,
        assigned_name: body.assigned_name || body.assignedName,
        proposal_serial_no: body.proposal_serial_no || body.proposalSerialNo,
        proposal_id: isUuid(body.proposal_id || body.proposalId) ? (body.proposal_id || body.proposalId) : null,
        notes: Array.isArray(body.notes) ? body.notes : [],
        updated_at: new Date().toISOString(),
      };

      if (!leadData.customer_name) {
        return res.status(400).json({ success: false, error: 'Customer Name is required' });
      }

      const existing = await findExistingLead(supabase, body);
      let result;
      if (existing && existing.id) {
        const { data, error } = await supabase
          .from('crm_leads')
          .update(leadData)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from('crm_leads')
          .insert([leadData])
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!supabase) {
      return res.status(200).json({ success: true, message: 'Offline mode: lead deleted locally' });
    }
    try {
      const id = req.body?.id || req.query?.id;
      const proposalSerialNo = req.body?.proposalSerialNo || req.query?.proposalSerialNo;
      if (!id && !proposalSerialNo) return res.status(400).json({ success: false, error: 'Lead ID required' });

      if (isUuid(id)) {
        const { error } = await supabase.from('crm_leads').delete().eq('id', id);
        if (error) throw error;
      } else if (proposalSerialNo) {
        const { error } = await supabase.from('crm_leads').delete().eq('proposal_serial_no', proposalSerialNo);
        if (error) throw error;
      }
      return res.status(200).json({ success: true, message: 'Lead deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

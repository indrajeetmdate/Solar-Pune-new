import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://supabase.cnergy.co.in';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json({ success: true, data: [] });
    }
    try {
      const { status, search, id } = req.query || {};
      let query = supabase.from('crm_leads').select('*').order('created_at', { ascending: false });

      if (id) {
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

      // Sub-action: Add note to lead
      if (action === 'add_note') {
        const { id, noteText, authorName, newStatus } = body;
        if (!id || !noteText) {
          return res.status(400).json({ success: false, error: 'Lead ID and noteText required' });
        }
        const { data: lead, error: fetchErr } = await supabase.from('crm_leads').select('notes, status').eq('id', id).single();
        if (fetchErr) throw fetchErr;

        const currentNotes = Array.isArray(lead?.notes) ? lead.notes : [];
        const newNote = {
          id: 'note_' + Date.now(),
          text: noteText,
          author: authorName || 'Internal Agent',
          created_at: new Date().toISOString(),
        };
        const updatedNotes = [newNote, ...currentNotes];

        const updates = {
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        };
        if (newStatus) updates.status = newStatus;

        const { data: updated, error: updateErr } = await supabase
          .from('crm_leads')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        return res.status(200).json({ success: true, data: updated });
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
        proposal_id: body.proposal_id || body.proposalId || null,
        notes: Array.isArray(body.notes) ? body.notes : [],
        updated_at: new Date().toISOString(),
      };

      if (!leadData.customer_name) {
        return res.status(400).json({ success: false, error: 'Customer Name is required' });
      }

      let result;
      if (body.id) {
        const { data, error } = await supabase
          .from('crm_leads')
          .update(leadData)
          .eq('id', body.id)
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
      if (!id) return res.status(400).json({ success: false, error: 'Lead ID required' });
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Lead deleted' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

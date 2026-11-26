// ==============================================================================
// Solar CRM & User Authentication Module
// ==============================================================================

export const CLONED_APP_USERS = [
  { username: 'indrajeet.date@cnergy.co.in', name: 'Indrajeet Date', role: 'admin', is_active: true, password: 'thisisbusiness', permission_level: 1 },
  { username: 'datlioncnergy@gmail.com', name: 'Admin', role: 'admin', is_active: true, password: 'thisisbusinessss', permission_level: 0 },
  { username: 'milind.date@cnergy.co.in', name: 'Milind Date', role: 'admin', is_active: true, password: 'thisisbusiness', permission_level: 1 },
  { username: 'agneya.date@cnergy.co.in', name: 'Agneya Date', role: 'admin', is_active: true, password: 'thisisbusiness', permission_level: 1 },
  { username: 'manoj@cnergy.co.in', name: 'Manoj Badve', role: 'admin', is_active: true, password: 'thisisbusiness', permission_level: 1 },
  { username: 'anujmagdum@cnergy.co.in', name: 'Anuj Magdum', role: 'billing', is_active: true, password: 'anujmagdum2744', permission_level: 2 },
  { username: 'santosh@cnergy.co.in', name: 'Santosh Gore', role: 'user', is_active: true, password: '12345678', permission_level: 3 },
  { username: 'pratik@cnergy.co.in', name: 'Pratik Choughule', role: 'user', is_active: true, password: 'pratik@dc', permission_level: 3 },
  { username: 'sagar@cnergy.co.in', name: 'Sagar Pendse', role: 'user', is_active: true, password: 'Access@7363', permission_level: 2 },
  { username: 'ajay@cnergy.co.in', name: 'Ajay Tiwari', role: 'user', is_active: true, password: 'Datlioncnergy_1234', permission_level: 1 },
  { username: 'anush@cnergy.co.in', name: 'Anush Bilaye', role: 'user', is_active: true, password: 'emp003anush', permission_level: 3 },
  { username: 'swapnil2@cnergy.co.in', name: 'Swapnil Bangude', role: 'user', is_active: true, password: 'swapnilbangude', permission_level: 2 },
  { username: 'display@cnergy.co.in', name: 'TV Display', role: 'user', is_active: true, password: 'tvdisplay', permission_level: 3 },
];

export const CRM_STATUS_MAP = {
  lead: { label: 'New Lead', color: '#f59e0b', bg: '#fef3c7', icon: '🟡' },
  site_visit_scheduled: { label: 'Site Visit Scheduled', color: '#2563eb', bg: '#eff6ff', icon: '🔵' },
  site_visit_done: { label: 'Site Visit Done', color: '#7c3aed', bg: '#f5f3ff', icon: '🟣' },
  proposal_sent: { label: 'Proposal Sent', color: '#059669', bg: '#ecfdf5', icon: '🟢' },
  won: { label: 'Won / Closed', color: '#16a34a', bg: '#dcfce7', icon: '🏆' },
  lost: { label: 'Lost / Dropped', color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
};

export const SAMPLE_CRM_LEADS = [
  {
    id: 'lead-001',
    customer_name: 'Rajesh Shinde',
    mobile_number: '9822012345',
    email_address: 'rajesh.shinde@gmail.com',
    customer_address: 'Plot 42, Baner Road, Pune - 411045',
    monthly_units: 420,
    monthly_bill: 4800,
    sanctioned_load: 5,
    system_capacity_kw: 3.3,
    estimated_cost: 215000,
    status: 'site_visit_done',
    assigned_to: 'indrajeet.date@cnergy.co.in',
    assigned_name: 'Indrajeet Date',
    proposal_serial_no: 'DC/2026-27/PROP-1140',
    notes: [
      {
        id: 'n1',
        text: 'Site inspection completed. Concrete flat terrace 800 sq ft, unshaded south exposure. Customer wants 3.3kW DCR with PM Surya Ghar subsidy.',
        author: 'Indrajeet Date',
        created_at: '2026-11-15T10:30:00Z',
      },
      {
        id: 'n2',
        text: 'Initial inquiry received via phone. Scheduled site survey for Saturday morning.',
        author: 'Anuj Magdum',
        created_at: '2026-11-14T08:15:00Z',
      },
    ],
    created_at: '2026-11-14T08:15:00Z',
    updated_at: '2026-11-15T10:30:00Z',
  },
  {
    id: 'lead-002',
    customer_name: 'Vikram Joshi',
    mobile_number: '9890145678',
    email_address: 'v.joshi@kothrud.net',
    customer_address: 'Mayur Colony, Kothrud, Pune - 411038',
    monthly_units: 650,
    monthly_bill: 7800,
    sanctioned_load: 7,
    system_capacity_kw: 5.5,
    estimated_cost: 345000,
    status: 'proposal_sent',
    assigned_to: 'milind.date@cnergy.co.in',
    assigned_name: 'Milind Date',
    proposal_serial_no: 'DC/2026-27/PROP-1141',
    notes: [
      {
        id: 'n3',
        text: 'Sent formal 5.5kW DCR proposal with hot-dip galvanized elevated structure. Follow up planned on Wednesday.',
        author: 'Milind Date',
        created_at: '2026-11-16T09:00:00Z',
      },
      {
        id: 'n4',
        text: 'Site visit completed. Measured 1,200 sq. ft. usable area. Mild shading from water tank on west.',
        author: 'Milind Date',
        created_at: '2026-11-15T14:20:00Z',
      },
    ],
    created_at: '2026-11-13T11:00:00Z',
    updated_at: '2026-11-16T09:00:00Z',
  },
  {
    id: 'lead-003',
    customer_name: 'Shivaji Heights CHS (Multi-Meter)',
    mobile_number: '9422033445',
    email_address: 'secretary@shivajiheights.org',
    customer_address: 'Baner-Pashan Link Road, Pune - 411045',
    monthly_units: 4850,
    monthly_bill: 56000,
    sanctioned_load: 45,
    system_capacity_kw: 38.5,
    estimated_cost: 2150000,
    status: 'site_visit_scheduled',
    assigned_to: 'indrajeet.date@cnergy.co.in',
    assigned_name: 'Indrajeet Date',
    proposal_serial_no: null,
    notes: [
      {
        id: 'n5',
        text: 'Management committee meeting attended. 27 flats interested in individual net metering on common terrace. Site inspection scheduled for Sunday 10 AM.',
        author: 'Indrajeet Date',
        created_at: '2026-11-16T11:00:00Z',
      },
    ],
    created_at: '2026-11-16T11:00:00Z',
    updated_at: '2026-11-16T11:00:00Z',
  },
  {
    id: 'lead-004',
    customer_name: 'Dr. Sunita Deshmukh',
    mobile_number: '9850022334',
    email_address: 'sunita.clinic@gmail.com',
    customer_address: 'DP Road, Aundh, Pune - 411007',
    monthly_units: 320,
    monthly_bill: 3600,
    sanctioned_load: 4,
    system_capacity_kw: 2.2,
    estimated_cost: 145000,
    status: 'lead',
    assigned_to: 'santosh@cnergy.co.in',
    assigned_name: 'Santosh Gore',
    proposal_serial_no: null,
    notes: [
      {
        id: 'n6',
        text: 'Web inquiry submitted via customer portal estimate. Contacted to understand roof availability.',
        author: 'Santosh Gore',
        created_at: '2026-11-16T12:00:00Z',
      },
    ],
    created_at: '2026-11-16T12:00:00Z',
    updated_at: '2026-11-16T12:00:00Z',
  },
];

/**
 * Authenticates user credentials against the cloned database and live backend.
 */
export async function authenticateInternalUser(username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim();

  // 1. Try server authentication if available
  if (typeof fetch === 'function') {
    try {
      const resp = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.user) {
          return { success: true, user: json.user, source: 'server' };
        }
      }
    } catch (_) {
      // Offline fallback
    }
  }

  // 3. Fallback to cloned database verification
  const matched = CLONED_APP_USERS.find((u) => {
    const isUserMatch = u.username.toLowerCase() === cleanUser || u.username.split('@')[0].toLowerCase() === cleanUser;
    return isUserMatch && u.password === cleanPass;
  });

  if (matched) {
    const { password: _, ...safeUser } = matched;
    return { success: true, user: safeUser, source: 'cloned_database' };
  }

  return { success: false, error: 'Invalid username or password. Please verify credentials.' };
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

function statusWasManuallyUpdated(lead) {
  if (!lead) return false;
  if (lead.status_locked === true) return true;
  if (lead.status && lead.status !== 'lead' && lead.status !== 'proposal_sent') return true;
  if (Array.isArray(lead.notes)) {
    return lead.notes.some((n) => /status (changed|updated) to|updated state to/i.test(n?.text || ''));
  }
  return false;
}

function upsertLeadInList(list, serverLead, previousLocalId = null, extraProps = {}) {
  const merged = { ...serverLead, ...extraProps };
  const idx = list.findIndex(
    (l) => l.id === serverLead.id || (previousLocalId && l.id === previousLocalId)
  );
  const next = [...list];
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...merged };
  } else {
    next.unshift(merged);
  }
  return next;
}

function readLocalLeadsCache() {
  try {
    const saved = localStorage.getItem('solar_crm_leads');
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function findLeadByIdOrHint(leads, leadId, hint = null) {
  let found = leads.find((l) => l.id === leadId);
  if (found) return found;
  if (hint?.proposal_serial_no) {
    found = leads.find((l) => l.proposal_serial_no === hint.proposal_serial_no);
    if (found) return found;
  }
  const phone10 = normalizePhone10(hint?.mobile_number);
  if (phone10.length >= 7) {
    found = leads.find((l) => normalizePhone10(l.mobile_number) === phone10);
    if (found) return found;
  }
  if (hint?.customer_name) {
    const cleanName = hint.customer_name.trim().toLowerCase();
    found = leads.find((l) => l.customer_name && l.customer_name.trim().toLowerCase() === cleanName);
    if (found) return found;
  }
  return null;
}

/**
 * Loads leads from local storage or remote database.
 */
export async function fetchCrmLeads() {
  const localLeads = readLocalLeadsCache();

  // Attempt server fetch (bypass cache so latest status edits are always reflected)
  if (typeof fetch === 'function') {
    try {
      const res = await fetch('/api/crm', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const serverLeads = json.data;
          // Preserve any local leads that have not yet been assigned a server UUID
          const matchedIds = new Set(serverLeads.map((l) => l.id));
          const matchedSerials = new Set(serverLeads.map((l) => l.proposal_serial_no).filter(Boolean));
          const matchedPhones = new Set(serverLeads.map((l) => normalizePhone10(l.mobile_number)).filter((p) => p.length >= 7));

          const unsyncedLocals = (Array.isArray(localLeads) ? localLeads : []).filter((loc) => {
            if (!loc || isUuid(loc.id) || matchedIds.has(loc.id)) return false;
            if (loc.proposal_serial_no && matchedSerials.has(loc.proposal_serial_no)) return false;
            const p10 = normalizePhone10(loc.mobile_number);
            if (p10.length >= 7 && matchedPhones.has(p10)) return false;
            // Do not keep untouched static demo fixtures when live server rows exist
            if (loc.id && /^lead-00[1-4]$/.test(loc.id) && !loc.status_locked) return false;
            return true;
          });

          const combined = [...serverLeads, ...unsyncedLocals];
          try { localStorage.setItem('solar_crm_leads', JSON.stringify(combined)); } catch (_) {}
          return combined;
        }
      }
    } catch (_) {}
  }

  if (localLeads && localLeads.length > 0) {
    return localLeads;
  }

  // Initial seed leads
  try { localStorage.setItem('solar_crm_leads', JSON.stringify(SAMPLE_CRM_LEADS)); } catch (_) {}
  return SAMPLE_CRM_LEADS;
}

/**
 * Saves a lead locally and synchronizes with server before returning.
 */
export async function saveCrmLeadLocallyAndRemote(leadData) {
  const leads = await fetchCrmLeads();
  let updatedList = [];
  let finalLead = { ...leadData };

  const existing = finalLead.id ? findLeadByIdOrHint(leads, finalLead.id, finalLead) : null;
  if (!finalLead.id) {
    finalLead.id = 'lead-' + Date.now();
    finalLead.created_at = new Date().toISOString();
  } else if (existing && isUuid(existing.id) && !isUuid(finalLead.id)) {
    finalLead.id = existing.id;
  }
  finalLead.updated_at = new Date().toISOString();

  const idx = leads.findIndex((l) => l.id === finalLead.id);
  if (idx >= 0) {
    updatedList = [...leads];
    updatedList[idx] = finalLead;
  } else {
    updatedList = [finalLead, ...leads];
  }

  try { localStorage.setItem('solar_crm_leads', JSON.stringify(updatedList)); } catch (_) {}

  // Await server sync so subsequent renders/fetches see the committed state and UUID
  if (typeof fetch === 'function') {
    try {
      const resp = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalLead),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && json.data?.id) {
          const prevId = finalLead.id;
          updatedList = upsertLeadInList(updatedList, json.data, prevId, {
            status_locked: finalLead.status_locked,
          });
          finalLead = updatedList.find((l) => l.id === json.data.id) || finalLead;
          try { localStorage.setItem('solar_crm_leads', JSON.stringify(updatedList)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return { success: true, lead: finalLead, leads: updatedList };
}

/**
 * Adds a note to a CRM lead and updates its status (persisted to server before returning).
 */
export async function addNoteToLead(leadId, noteText, authorName, newStatus) {
  const localBeforeFetch = readLocalLeadsCache();
  const localHint = localBeforeFetch.find((l) => l.id === leadId) || null;
  const leads = await fetchCrmLeads();
  let lead = findLeadByIdOrHint(leads, leadId, localHint);
  if (!lead && localHint) {
    lead = { ...localHint };
    leads.unshift(lead);
  }
  if (!lead) return { success: false, error: 'Lead not found' };

  const currentNotes = Array.isArray(lead.notes) ? lead.notes : [];
  const metaLabel = newStatus ? (CRM_STATUS_MAP[newStatus]?.label || newStatus) : '';
  const cleanNote = String(noteText || '').trim() || (metaLabel ? `Status changed to ${metaLabel}` : 'Note updated');
  const newNote = {
    id: 'note_' + Date.now(),
    text: cleanNote,
    author: authorName || 'Internal Agent',
    created_at: new Date().toISOString(),
  };

  lead.notes = [newNote, ...currentNotes];
  if (newStatus) {
    lead.status = newStatus;
    lead.status_locked = true;
  }
  lead.updated_at = new Date().toISOString();

  let updatedLeads = [...leads];
  try { localStorage.setItem('solar_crm_leads', JSON.stringify(updatedLeads)); } catch (_) {}

  if (typeof fetch === 'function') {
    try {
      const resp = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_note',
          id: lead.id,
          noteText: cleanNote,
          authorName,
          newStatus,
          leadSnapshot: lead,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json?.success && json.data?.id) {
          updatedLeads = upsertLeadInList(updatedLeads, json.data, lead.id, {
            status: newStatus || json.data.status,
            status_locked: Boolean(newStatus) || lead.status_locked,
          });
          try { localStorage.setItem('solar_crm_leads', JSON.stringify(updatedLeads)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  const finalLead = findLeadByIdOrHint(updatedLeads, lead.id, lead) || lead;
  return { success: true, lead: finalLead, leads: updatedLeads };
}

/**
 * Deletes a lead by ID (locally and on server).
 */
export async function deleteCrmLeadById(leadId) {
  const localBeforeFetch = readLocalLeadsCache();
  const localHint = localBeforeFetch.find((l) => l.id === leadId) || null;
  const leads = await fetchCrmLeads();
  const target = findLeadByIdOrHint(leads, leadId, localHint) || localHint;
  const updated = leads.filter((l) => l.id !== leadId && (!target || l.id !== target.id));
  try { localStorage.setItem('solar_crm_leads', JSON.stringify(updated)); } catch (_) {}

  if (typeof fetch === 'function') {
    try {
      await fetch('/api/crm', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: target?.id || leadId,
          proposalSerialNo: target?.proposal_serial_no || null,
        }),
      });
    } catch (_) {}
  }

  return { success: true, leads: updated };
}

/**
 * Synchronizes saved customer proposals (from localStorage and server) into CRM Leads.
 * Any saved proposal creates or enriches a CRM lead record with proposal details.
 */
export async function syncSavedCustomersWithLeads() {
  const leads = await fetchCrmLeads();
  let savedProposals = [];
  try {
    const raw = localStorage.getItem('solar_saved_proposals');
    if (raw) savedProposals = JSON.parse(raw);
  } catch (_) {}

  // Attempt to fetch server proposals if reachable
  if (typeof fetch === 'function') {
    try {
      const res = await fetch('/api/load-proposals');
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data)) {
          const existingSerials = new Set(
            savedProposals.map(p => p.proposalSerialNo || p.proposal_serial_no || p.id).filter(Boolean)
          );
          for (const sp of json.data) {
            const serial = sp.proposal_serial_no || sp.proposalSerialNo || sp.id;
            if (serial && !existingSerials.has(serial)) {
              existingSerials.add(serial);
              savedProposals.push({
                id: sp.id,
                proposalSerialNo: sp.proposal_serial_no,
                customerName: sp.customer_name,
                mobileNumber: sp.mobile_number,
                emailAddress: sp.email_address,
                customerAddress: sp.state_data?.input?.customerAddress || sp.customer_address,
                sanctionedLoad: sp.sanctioned_load || sp.state_data?.input?.sanctionedLoad,
                monthlyUnits: sp.state_data?.input?.monthlyUnits,
                monthlyBill: sp.state_data?.input?.monthlyBill,
                systemCapacityKw: sp.system_capacity_kw || sp.state_data?.state?.estimates?.recommended?.dcCapacityKw,
                totalCost: sp.total_cost || sp.state_data?.state?.estimates?.recommended?.netCost,
                savedAt: sp.created_at,
                stateData: sp.state_data,
              });
            }
          }
        }
      }
    } catch (_) {}
  }

  if (!Array.isArray(savedProposals) || savedProposals.length === 0) {
    return leads;
  }

  let leadsChanged = false;
  const updatedLeads = [...leads];

  for (const prop of savedProposals) {
    const serial = prop.proposalSerialNo || prop.proposal_serial_no || prop.stateData?.reportDisplay?.proposalSerialNo || prop.state_data?.reportDisplay?.proposalSerialNo || null;
    const name = prop.customerName || prop.customer_name || prop.stateData?.input?.customerName || prop.state_data?.input?.customerName || prop.stateData?.formValues?.customerName || prop.state_data?.formValues?.customerName || null;
    const phone = prop.mobileNumber || prop.mobile_number || prop.stateData?.input?.mobileNumber || prop.state_data?.input?.mobileNumber || prop.stateData?.formValues?.mobileNumber || prop.state_data?.formValues?.mobileNumber || null;
    const email = prop.emailAddress || prop.email_address || prop.stateData?.input?.emailAddress || prop.state_data?.input?.emailAddress || prop.stateData?.formValues?.emailAddress || prop.state_data?.formValues?.emailAddress || '';
    const address = prop.customerAddress || prop.customer_address || prop.stateData?.input?.customerAddress || prop.state_data?.input?.customerAddress || prop.stateData?.formValues?.customerAddress || prop.state_data?.formValues?.customerAddress || 'Pune, Maharashtra';
    const load = prop.sanctionedLoad || prop.sanctioned_load || prop.stateData?.input?.sanctionedLoad || prop.state_data?.input?.sanctionedLoad || prop.stateData?.formValues?.sanctionedLoad || null;
    const units = prop.monthlyUnits || prop.monthly_units || prop.stateData?.input?.monthlyUnits || prop.state_data?.input?.monthlyUnits || prop.stateData?.formValues?.monthlyUnits || null;
    const bill = prop.monthlyBill || prop.monthly_bill || prop.stateData?.input?.monthlyBill || prop.state_data?.input?.monthlyBill || prop.stateData?.formValues?.monthlyBill || null;
    const capacity = prop.systemCapacityKw || prop.system_capacity_kw || prop.stateData?.state?.estimates?.recommended?.dcCapacityKw || prop.state_data?.state?.estimates?.recommended?.dcCapacityKw || null;
    const cost = prop.totalCost || prop.total_cost || prop.estimated_cost || prop.stateData?.state?.estimates?.recommended?.netCost || prop.state_data?.state?.estimates?.recommended?.netCost || null;
    const date = prop.savedAt || prop.created_at || new Date().toISOString();

    if (!name && !serial) continue;

    // Match existing lead by:
    // 1. Same proposal serial no
    // 2. Or same normalized last-10-digit phone number
    // 3. Or same exact customer name
    let leadIndex = -1;
    if (serial) {
      leadIndex = updatedLeads.findIndex((l) => l.proposal_serial_no === serial);
    }
    if (leadIndex === -1 && phone) {
      const cleanPhone10 = normalizePhone10(phone);
      if (cleanPhone10.length >= 7) {
        leadIndex = updatedLeads.findIndex((l) => normalizePhone10(l.mobile_number) === cleanPhone10);
      }
    }
    if (leadIndex === -1 && name) {
      const cleanName = name.trim().toLowerCase();
      leadIndex = updatedLeads.findIndex((l) => l.customer_name && l.customer_name.trim().toLowerCase() === cleanName);
    }

    if (leadIndex >= 0) {
      // Enrich existing lead with missing metadata; never reset manually updated or previously linked lead statuses
      const existing = updatedLeads[leadIndex];
      const hadSerialBefore = Boolean(existing.proposal_serial_no);
      let itemChanged = false;
      if (serial && !existing.proposal_serial_no) {
        existing.proposal_serial_no = serial;
        itemChanged = true;
      }
      if (capacity && !existing.system_capacity_kw) {
        existing.system_capacity_kw = Number(capacity);
        itemChanged = true;
      }
      if (cost && !existing.estimated_cost) {
        existing.estimated_cost = Number(cost);
        itemChanged = true;
      }
      if (bill && !existing.monthly_bill) {
        existing.monthly_bill = Number(bill);
        itemChanged = true;
      }
      if (units && !existing.monthly_units) {
        existing.monthly_units = Number(units);
        itemChanged = true;
      }
      if (load && !existing.sanctioned_load) {
        existing.sanctioned_load = Number(load);
        itemChanged = true;
      }
      if (email && !existing.email_address) {
        existing.email_address = email;
        itemChanged = true;
      }
      if (address && (!existing.customer_address || existing.customer_address === 'Pune')) {
        existing.customer_address = address;
        itemChanged = true;
      }
      if (!hadSerialBefore && serial && existing.status === 'lead' && !statusWasManuallyUpdated(existing)) {
        existing.status = 'proposal_sent';
        itemChanged = true;
      }
      if (itemChanged) {
        existing.updated_at = new Date().toISOString();
        leadsChanged = true;
      }
    } else {
      // Create new lead from saved proposal
      const newLead = {
        id: 'lead-sync-' + (serial ? serial.replace(/[^a-zA-Z0-9_-]/g, '_') : Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
        customer_name: name || 'Customer',
        mobile_number: phone || '',
        email_address: email || '',
        customer_address: address,
        sanctioned_load: load ? Number(load) : null,
        monthly_units: units ? Number(units) : null,
        monthly_bill: bill ? Number(bill) : null,
        system_capacity_kw: capacity ? Number(capacity) : null,
        estimated_cost: cost ? Number(cost) : null,
        status: 'proposal_sent',
        assigned_to: 'indrajeet.date@cnergy.co.in',
        assigned_name: 'Indrajeet Date',
        proposal_serial_no: serial,
        source: 'saved_proposal_sync',
        notes: [
          {
            id: 'note_sync_' + Date.now(),
            text: `Proposal ${serial || 'Record'} auto-synced from saved customer database. Capacity: ${capacity ? capacity + ' kWp' : '—'}.`,
            author: 'Proposal Sync Engine',
            created_at: date || new Date().toISOString(),
          },
        ],
        created_at: date || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedLeads.unshift(newLead);
      leadsChanged = true;
    }
  }

  if (leadsChanged) {
    try { localStorage.setItem('solar_crm_leads', JSON.stringify(updatedLeads)); } catch (_) {}
  }
  return updatedLeads;
}

/**
 * Updates basic customer fields on any saved proposal matching a proposal serial or customer details.
 */
export function syncCustomerDataToSavedProposals(proposalSerialNo, updatedData) {
  if (!proposalSerialNo && !updatedData) return;
  try {
    const raw = localStorage.getItem('solar_saved_proposals');
    if (!raw) return;
    const list = JSON.parse(raw);
    let changed = false;

    for (const p of list) {
      const serial = p.proposalSerialNo || p.proposal_serial_no || p.stateData?.reportDisplay?.proposalSerialNo;
      if (proposalSerialNo && serial === proposalSerialNo) {
        if (updatedData.customer_name) {
          p.customerName = updatedData.customer_name;
          if (p.stateData?.input) p.stateData.input.customerName = updatedData.customer_name;
          if (p.stateData?.formValues) p.stateData.formValues.customerName = updatedData.customer_name;
        }
        if (updatedData.mobile_number) {
          p.mobileNumber = updatedData.mobile_number;
          if (p.stateData?.input) p.stateData.input.mobileNumber = updatedData.mobile_number;
          if (p.stateData?.formValues) p.stateData.formValues.mobileNumber = updatedData.mobile_number;
        }
        if (updatedData.email_address) {
          p.emailAddress = updatedData.email_address;
          if (p.stateData?.input) p.stateData.input.emailAddress = updatedData.email_address;
          if (p.stateData?.formValues) p.stateData.formValues.emailAddress = updatedData.email_address;
        }
        if (updatedData.customer_address) {
          p.customerAddress = updatedData.customer_address;
          if (p.stateData?.input) p.stateData.input.customerAddress = updatedData.customer_address;
          if (p.stateData?.formValues) p.stateData.formValues.customerAddress = updatedData.customer_address;
        }
        if (updatedData.sanctioned_load) {
          p.sanctionedLoad = Number(updatedData.sanctioned_load);
          if (p.stateData?.input) p.stateData.input.sanctionedLoad = Number(updatedData.sanctioned_load);
          if (p.stateData?.formValues) p.stateData.formValues.sanctionedLoad = Number(updatedData.sanctioned_load);
        }
        if (updatedData.monthly_units) {
          if (p.stateData?.input) p.stateData.input.monthlyUnits = Number(updatedData.monthly_units);
          if (p.stateData?.formValues) p.stateData.formValues.monthlyUnits = Number(updatedData.monthly_units);
        }
        if (updatedData.monthly_bill) {
          if (p.stateData?.input) p.stateData.input.monthlyBill = Number(updatedData.monthly_bill);
          if (p.stateData?.formValues) p.stateData.formValues.monthlyBill = Number(updatedData.monthly_bill);
        }
        if (updatedData.system_capacity_kw) {
          p.systemCapacityKw = Number(updatedData.system_capacity_kw);
        }
        if (updatedData.estimated_cost) {
          p.totalCost = Number(updatedData.estimated_cost);
        }
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem('solar_saved_proposals', JSON.stringify(list));
    }
  } catch (err) {
    console.warn('syncCustomerDataToSavedProposals error:', err);
  }
}

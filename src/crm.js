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

  // 1. Backward compatibility check for legacy passphrase
  if (cleanPass === 'solar2026' || cleanUser === 'solar2026') {
    const admin = CLONED_APP_USERS[0];
    return {
      success: true,
      user: {
        username: admin.username,
        name: admin.name,
        role: admin.role,
        permission_level: admin.permission_level,
      },
      source: 'legacy_passphrase',
    };
  }

  // 2. Try server authentication if available
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

/**
 * Loads leads from local storage or remote database.
 */
export async function fetchCrmLeads() {
  let localLeads = [];
  try {
    const saved = localStorage.getItem('solar_crm_leads');
    if (saved) localLeads = JSON.parse(saved);
  } catch (_) {}

  // Attempt server fetch
  if (typeof fetch === 'function') {
    try {
      const res = await fetch('/api/crm');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          try { localStorage.setItem('solar_crm_leads', JSON.stringify(json.data)); } catch (_) {}
          return json.data;
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
 * Saves a lead locally and attempts server synchronization.
 */
export async function saveCrmLeadLocallyAndRemote(leadData) {
  const leads = await fetchCrmLeads();
  let updatedList = [];
  let finalLead = { ...leadData };

  if (!finalLead.id) {
    finalLead.id = 'lead-' + Date.now();
    finalLead.created_at = new Date().toISOString();
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

  // Asynchronously attempt server sync
  if (typeof fetch === 'function') {
    try {
      fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalLead),
      }).catch(() => {});
    } catch (_) {}
  }

  return { success: true, lead: finalLead, leads: updatedList };
}

/**
 * Adds a note to a CRM lead and updates its status.
 */
export async function addNoteToLead(leadId, noteText, authorName, newStatus) {
  const leads = await fetchCrmLeads();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead) return { success: false, error: 'Lead not found' };

  const currentNotes = Array.isArray(lead.notes) ? lead.notes : [];
  const newNote = {
    id: 'note_' + Date.now(),
    text: noteText,
    author: authorName || 'Internal Agent',
    created_at: new Date().toISOString(),
  };

  lead.notes = [newNote, ...currentNotes];
  if (newStatus) lead.status = newStatus;
  lead.updated_at = new Date().toISOString();

  try { localStorage.setItem('solar_crm_leads', JSON.stringify(leads)); } catch (_) {}

  if (typeof fetch === 'function') {
    try {
      fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_note',
          id: leadId,
          noteText,
          authorName,
          newStatus,
        }),
      }).catch(() => {});
    } catch (_) {}
  }

  return { success: true, lead, leads };
}

/**
 * Deletes a lead by ID.
 */
export async function deleteCrmLeadById(leadId) {
  const leads = await fetchCrmLeads();
  const updated = leads.filter((l) => l.id !== leadId);
  try { localStorage.setItem('solar_crm_leads', JSON.stringify(updated)); } catch (_) {}

  if (typeof fetch === 'function') {
    try {
      fetch('/api/crm', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId }),
      }).catch(() => {});
    } catch (_) {}
  }

  return { success: true, leads: updated };
}

import { createClient } from '@supabase/supabase-js';

// Pre-seeded cloned users from the enterprise database (app_users)
// Provides 100% offline availability and instant validation
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

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://supabase.cnergy.co.in';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  // 1. Query live database if available
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: dbUser, error } = await supabase
        .from('app_users')
        .select('*')
        .ilike('username', cleanUser)
        .maybeSingle();

      if (!error && dbUser) {
        if (dbUser.password === cleanPass) {
          const { password: _, ...safeUser } = dbUser;
          return res.status(200).json({
            success: true,
            user: safeUser,
            source: 'database',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Live database auth failed, falling back to cloned user list:', err.message);
  }

  // 3. Fallback to cloned user database
  const cloned = CLONED_APP_USERS.find(
    (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
  );

  if (cloned) {
    const { password: _, ...safeUser } = cloned;
    return res.status(200).json({
      success: true,
      user: safeUser,
      source: 'cloned_database',
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid credentials. Please verify your email and password.',
  });
}

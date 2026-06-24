// ─── Supabase Config ───────────────────────────────────────────────
// Reemplaza estos valores con los de tu proyecto en supabase.com
// Settings → API → Project URL y anon public key
const SUPABASE_URL = 'https://jvceqxussugdexhkybkx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rSMvsIwJ0o_Al9ILWSOjcg_edrwvted';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

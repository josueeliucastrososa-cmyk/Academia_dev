// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — auth.js
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://mwzezekdxrutpzqbduvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_O1RMAV7hbpvDwJj0ESgaCg_dd8lZur5';

const _ssClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'studyspace_auth'
  }
});

// Exportar para otros módulos
window.SS = window.SS || {};
window.SS.client = _ssClient;

async function ssGetUser() {
  const { data: { session } } = await _ssClient.auth.getSession();
  return session?.user || null;
}

async function ssSignOut() {
  await _ssClient.auth.signOut();
  window.location.href = 'index.html';
}

// Obtener o crear perfil del usuario
async function ssGetProfile(userId) {
  const { data, error } = await _ssClient
    .from('social_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

async function ssUpsertProfile(userId, userData) {
  const { data, error } = await _ssClient
    .from('social_profiles')
    .upsert({
      id: userId,
      username: userData.name || userData.email?.split('@')[0] || 'Usuario',
      avatar_url: userData.avatar_url || null,
    }, { onConflict: 'id' })
    .select()
    .single();
  return data;
}

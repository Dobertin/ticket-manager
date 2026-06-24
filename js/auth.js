// ─── Auth helpers ────────────────────────────────────────────────────────────

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getCurrentSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

// Redirect to login if no session. Call at top of each protected page.
async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    window.location.replace('login.html');
    return null;
  }
  return session.user;
}

// Upsert profile row after login (name + avatar from OAuth or email)
async function ensureProfile(user) {
  if (!user) return;
  const fullName  = user.user_metadata?.full_name
                 || user.user_metadata?.name
                 || user.email?.split('@')[0]
                 || 'Usuario';
  const avatarUrl = user.user_metadata?.avatar_url || null;

  await db.from('profiles').upsert(
    { id: user.id, full_name: fullName, avatar_url: avatarUrl },
    { onConflict: 'id', ignoreDuplicates: false }
  );
}

// ─── Login actions ────────────────────────────────────────────────────────────

async function loginWithGitHub() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${location.origin}${location.pathname.replace('login.html','')}dashboard.html`
    }
  });
  if (error) showLoginError('Error al conectar con GitHub: ' + error.message);
}

async function loginWithMagicLink(email) {
  if (!email) { showLoginError('Ingresa tu correo electrónico.'); return; }
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${location.origin}${location.pathname.replace('login.html','')}dashboard.html`
    }
  });
  if (error) { showLoginError(error.message); return; }
  showLoginSuccess('¡Revisa tu correo! Te enviamos un enlace de acceso.');
}

async function logout() {
  await db.auth.signOut();
  window.location.replace('login.html');
}

function showLoginError(msg) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = '#dc2626';
  el.style.display = 'block';
}

function showLoginSuccess(msg) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = '#16a34a';
  el.style.display = 'block';
}

// ─── Render current user in nav ───────────────────────────────────────────────
async function renderNavUser() {
  const user = await getCurrentUser();
  if (!user) return;
  const name   = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
  const avatar = user.user_metadata?.avatar_url;
  const el     = document.getElementById('navUser');
  if (!el) return;
  el.innerHTML = `
    ${avatar ? `<img src="${avatar}" style="width:26px;height:26px;border-radius:50%;object-fit:cover" alt="">` : ''}
    <span style="font-size:13px;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(name)}</span>
    <button class="btn btn-ghost btn-sm" onclick="logout()">Salir</button>
  `;
}

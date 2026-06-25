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

// ─── Login actions ────────────────────────────────────────────────────────────

async function loginWithPassword(email, password) {
  if (!email || !password) { showLoginError('Ingresa correo y contraseña.'); return; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) { showLoginError(error.message); return; }
  window.location.replace('dashboard.html');
}

async function registerWithPassword(email, password) {
  if (!email || !password) { showLoginError('Ingresa correo y contraseña.'); return; }
  if (password.length < 6) { showLoginError('La contraseña debe tener al menos 6 caracteres.'); return; }
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) { showLoginError(error.message); return; }
  // If email confirmation is disabled in Supabase, session is immediate
  if (data.session) {
    window.location.replace('dashboard.html');
  } else {
    showLoginSuccess('¡Cuenta creada! Revisa tu correo para confirmar, o inicia sesión directamente.');
  }
}

async function logout() {
  await db.auth.signOut();
  window.location.replace('login.html');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showLoginError(msg) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.background = '#fef2f2';
  el.style.color = '#dc2626';
  el.style.borderColor = '#fecaca';
  el.style.display = 'block';
}

function showLoginSuccess(msg) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.background = '#f0fdf4';
  el.style.color = '#16a34a';
  el.style.borderColor = '#bbf7d0';
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
    <span style="font-size:13px;color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(name)}</span>
    <button class="btn btn-ghost btn-sm" onclick="logout()">Salir</button>
  `;
}
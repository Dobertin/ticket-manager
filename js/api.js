// ─── API — all Supabase calls ─────────────────────────────────────────────────
// Every function returns { data, error } or plain data/null.

// ── Profiles ──────────────────────────────────────────────────────────────────
async function apiGetProfiles() {
  const { data, error } = await db.from('profiles').select('id, full_name, avatar_url').order('full_name');
  if (error) console.error('apiGetProfiles', error);
  return data || [];
}

async function apiGetProfile(userId) {
  const { data } = await db.from('profiles').select('*').eq('id', userId).single();
  return data;
}

// ── Projects ──────────────────────────────────────────────────────────────────
async function apiGetProjects() {
  const { data, error } = await db.from('projects')
    .select('*, owner:profiles(id, full_name)')
    .order('created_at', { ascending: false });
  if (error) console.error('apiGetProjects', error);
  return data || [];
}

async function apiCreateProject(payload) {
  return db.from('projects').insert(payload).select().single();
}

async function apiUpdateProject(id, payload) {
  return db.from('projects').update(payload).eq('id', id);
}

async function apiDeleteProject(id) {
  return db.from('projects').delete().eq('id', id);
}

// ── Tasks ──────────────────────────────────────────────────────────────────────
async function apiGetTasks(projectId = null) {
  let q = db.from('tasks').select('*, assignee:profiles(id, full_name), project:projects(id, name)').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  if (error) console.error('apiGetTasks', error);
  return data || [];
}

async function apiCreateTask(payload) {
  return db.from('tasks').insert(payload).select().single();
}

async function apiUpdateTask(id, payload) {
  return db.from('tasks').update(payload).eq('id', id);
}

async function apiDeleteTask(id) {
  return db.from('tasks').delete().eq('id', id);
}

// ── Subtasks ───────────────────────────────────────────────────────────────────
async function apiGetSubtasks(taskId = null) {
  let q = db.from('subtasks')
    .select('*, assignee:profiles(id, full_name), task:tasks(id, title, project_id, project:projects(id, name, status))')
    .order('created_at', { ascending: false });
  if (taskId) q = q.eq('task_id', taskId);
  const { data, error } = await q;
  if (error) console.error('apiGetSubtasks', error);
  return data || [];
}

async function apiCreateSubtask(payload) {
  return db.from('subtasks').insert(payload).select().single();
}

async function apiUpdateSubtask(id, payload) {
  return db.from('subtasks').update(payload).eq('id', id);
}

async function apiDeleteSubtask(id) {
  return db.from('subtasks').delete().eq('id', id);
}

// ── Comments ───────────────────────────────────────────────────────────────────
async function apiGetComments(entityType, entityId) {
  const { data, error } = await db.from('comments')
    .select('*, author:profiles(id, full_name, avatar_url)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });
  if (error) console.error('apiGetComments', error);
  return data || [];
}

async function apiAddComment(payload) {
  return db.from('comments').insert(payload);
}

// ── Project Members ────────────────────────────────────────────────────────────
async function apiGetProjectMembers(projectId) {
  const { data, error } = await db.from('project_members')
    .select('*, profile:profiles(id, full_name, avatar_url)')
    .eq('project_id', projectId)
    .order('invited_at');
  if (error) console.error('apiGetProjectMembers', error);
  return data || [];
}

async function apiAddProjectMember(projectId, userId, role = 'member') {
  return db.from('project_members').insert({ project_id: projectId, user_id: userId, role });
}

async function apiRemoveProjectMember(projectId, userId) {
  return db.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
}

async function apiInviteByEmail(email) {
  // Uses Supabase Admin invite — requires service role in backend.
  // Here we use signInWithOtp as a workaround to "invite" via magic link.
  return db.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/')  }dashboard.html`
    }
  });
}

// ── Status log ─────────────────────────────────────────────────────────────────
async function apiGetStatusLogs(entityType, entityId) {
  const { data } = await db.from('status_logs')
    .select('*, changed_by_profile:profiles(full_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('changed_at', { ascending: false });
  return data || [];
}

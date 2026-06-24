// ─── Projects module ──────────────────────────────────────────────────────────

let _projects  = [];
let _members   = [];
let _tasks     = [];
let _subtasks  = [];
let _currentUser = null;
let _editingProjectId = null;

// ── Init ──────────────────────────────────────────────────────────────────────
async function initProjects(user) {
  _currentUser = user;
  await reloadAll();
}

async function reloadAll() {
  const [projects, members, tasks, subtasks] = await Promise.all([
    apiGetProjects(),
    apiGetProfiles(),
    apiGetTasks(),
    apiGetSubtasks(),
  ]);
  _projects = projects;
  _members  = members;
  _tasks    = tasks;
  _subtasks = subtasks;
  renderProjectsTable();
  renderMembersPanel();
  populateExportSelects();
}

async function reloadTasksAndSubs() {
  [_tasks, _subtasks] = await Promise.all([apiGetTasks(), apiGetSubtasks()]);
}

// ── Projects table ────────────────────────────────────────────────────────────
function renderProjectsTable() {
  const tbody = document.getElementById('projectsBody');
  if (!tbody) return;
  if (!_projects.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin proyectos. Crea el primero.</td></tr>';
    return;
  }
  tbody.innerHTML = _projects.map(p => `
    <tr>
      <td><strong>${escHtml(p.name)}</strong></td>
      <td class="td-muted td-clamp">${escHtml(p.description || '—')}</td>
      <td>${statusBadge(p.status === 'active' ? 'in_progress' : 'done').replace('En proceso','Activo').replace('Finalizado','Archivado')}</td>
      <td>${escHtml(p.owner?.full_name || '—')}</td>
      <td class="td-muted">${fmtDate(p.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon" title="Editar" onclick="openTreeModal('${p.id}')">✏️</button>
          <button class="btn-icon" title="Eliminar" onclick="deleteProject('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Project form modal ────────────────────────────────────────────────────────
function openProjectModal(projectId = null) {
  const p = projectId ? _projects.find(x => x.id === projectId) : null;
  document.getElementById('projectModalTitle').textContent = p ? 'Editar proyecto' : 'Nuevo proyecto';
  document.getElementById('projectId').value    = p?.id || '';
  document.getElementById('projectName').value  = p?.name || '';
  document.getElementById('projectDesc').value  = p?.description || '';
  document.getElementById('projectStatus').value= p?.status || 'active';
  const sel = document.getElementById('projectOwner');
  sel.innerHTML = '<option value="">Sin asignar</option>'
    + _members.map(m => `<option value="${m.id}" ${p?.owner_id===m.id?'selected':''}>${escHtml(m.full_name)}</option>`).join('');
  openModal('modalProject');
}

async function saveProject() {
  const id     = document.getElementById('projectId').value;
  const name   = document.getElementById('projectName').value.trim();
  const desc   = document.getElementById('projectDesc').value.trim();
  const owner  = document.getElementById('projectOwner').value || _currentUser?.id || null;
  const status = document.getElementById('projectStatus').value;
  if (!name) { toast('El nombre es requerido', 'info'); return; }

  if (id) {
    const { error } = await apiUpdateProject(id, { name, description: desc, owner_id: owner, status });
    if (error) { toast('Error al actualizar', 'error'); return; }
    toast('Proyecto actualizado', 'success');
  } else {
    const { data, error } = await apiCreateProject({ name, description: desc, owner_id: owner, status });
    if (error) { toast('Error al crear proyecto', 'error'); console.error(error); return; }
    // Auto-add creator as owner in project_members
    if (data?.id && _currentUser?.id) {
      await apiAddProjectMember(data.id, _currentUser.id, 'owner');
    }
    toast('Proyecto creado', 'success');
  }
  closeModal('modalProject');
  await reloadAll();
}

async function deleteProject(id) {
  if (!confirm('¿Eliminar este proyecto y todos sus datos?')) return;
  const { error } = await apiDeleteProject(id);
  if (error) { toast('Error al eliminar', 'error'); return; }
  toast('Proyecto eliminado', 'success');
  await reloadAll();
}

// ── Tree modal (edit project + tasks + subtasks) ──────────────────────────────
async function openTreeModal(projectId) {
  _editingProjectId = projectId;
  const p = _projects.find(x => x.id === projectId);
  document.getElementById('treeModalTitle').textContent = `Editar · ${escHtml(p.name)}`;
  document.getElementById('treeProjectName').value  = p.name;
  document.getElementById('treeProjectDesc').value  = p.description || '';
  document.getElementById('treeProjectStatus').value= p.status || 'active';

  const ownerSel = document.getElementById('treeProjectOwner');
  ownerSel.innerHTML = '<option value="">Sin asignar</option>'
    + _members.map(m => `<option value="${m.id}" ${p.owner_id===m.id?'selected':''}>${escHtml(m.full_name)}</option>`).join('');

  const newAssEl = document.getElementById('newTaskAssignee');
  if (newAssEl) newAssEl.innerHTML = '<option value="">Sin asignar</option>'
    + _members.map(m=>`<option value="${m.id}">${escHtml(m.full_name)}</option>`).join('');

  closeAddTaskInline();
  renderTaskTree(projectId);
  openModal('modalProjectTree');
}

async function saveTreeProjectMeta() {
  const name   = document.getElementById('treeProjectName').value.trim();
  const desc   = document.getElementById('treeProjectDesc').value.trim();
  const status = document.getElementById('treeProjectStatus').value;
  const owner  = document.getElementById('treeProjectOwner').value || null;
  if (!name) { toast('Nombre requerido', 'info'); return; }
  const { error } = await apiUpdateProject(_editingProjectId, { name, description: desc, status, owner_id: owner });
  if (error) { toast('Error al guardar', 'error'); return; }
  toast('Proyecto guardado', 'success');
  await reloadAll();
  document.getElementById('treeModalTitle').textContent = `Editar · ${escHtml(name)}`;
}

// ── Task tree render ──────────────────────────────────────────────────────────
function renderTaskTree(projectId) {
  const projectTasks = _tasks.filter(t => t.project_id === projectId);
  const tree = document.getElementById('taskTree');
  if (!tree) return;
  if (!projectTasks.length) {
    tree.innerHTML = '<div class="empty-row" style="padding:16px;text-align:center">Sin tareas. Agrega la primera.</div>';
    return;
  }
  tree.innerHTML = projectTasks.map(t => {
    const subs = _subtasks.filter(s => s.task_id === t.id);
    return `
    <div class="tree-item" id="task-item-${t.id}">
      <div class="tree-header" onclick="toggleTask('${t.id}')">
        <span class="tree-toggle" id="toggle-${t.id}">▶</span>
        <span class="tree-name">${escHtml(t.title)}</span>
        ${statusBadge(t.status)}
        <span class="tree-meta">${escHtml(t.assignee?.full_name||'')}</span>
        <div class="tree-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="openEditTask('${t.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteTask('${t.id}')">🗑️</button>
        </div>
      </div>
      <div class="tree-children" id="children-${t.id}">
        ${subs.map(s => `
        <div class="subtree-item">
          <span class="subtree-name">${escHtml(s.title)}</span>
          ${statusBadge(s.status)}
          <span class="tree-meta">${escHtml(s.assignee?.full_name||'')}</span>
          <button class="btn-icon" onclick="openEditSubtask('${s.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteSubtask('${s.id}')">🗑️</button>
        </div>`).join('')}
        <div class="add-inline" id="addSub-${t.id}" style="display:none">
          <input type="text" id="newSubTitle-${t.id}" placeholder="Título de subtarea"/>
          <select id="newSubAssignee-${t.id}" style="width:150px">
            <option value="">Sin asignar</option>
            ${_members.map(m=>`<option value="${m.id}">${escHtml(m.full_name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="addSubtask('${t.id}')">Agregar</button>
          <button class="btn btn-ghost btn-sm" onclick="closeAddSub('${t.id}')">✕</button>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="openAddSub('${t.id}')">+ Subtarea</button>
      </div>
    </div>`;
  }).join('');
}

function toggleTask(taskId) {
  document.getElementById(`children-${taskId}`)?.classList.toggle('open');
  document.getElementById(`toggle-${taskId}`)?.classList.toggle('open');
}
function openAddTaskInline()  { document.getElementById('addTaskInline').style.display='flex'; }
function closeAddTaskInline() { document.getElementById('addTaskInline').style.display='none'; document.getElementById('newTaskTitle').value=''; }
function openAddSub(tid)  { document.getElementById(`addSub-${tid}`).style.display='flex'; }
function closeAddSub(tid) { document.getElementById(`addSub-${tid}`).style.display='none'; }

async function addTask() {
  const title    = document.getElementById('newTaskTitle').value.trim();
  const status   = document.getElementById('newTaskStatus').value;
  const assignee = document.getElementById('newTaskAssignee').value || null;
  if (!title) { toast('Escribe un título', 'info'); return; }
  const { error } = await apiCreateTask({ title, status, assignee_id: assignee, project_id: _editingProjectId });
  if (error) { toast('Error al crear tarea', 'error'); return; }
  toast('Tarea creada', 'success');
  closeAddTaskInline();
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

async function addSubtask(taskId) {
  const title    = document.getElementById(`newSubTitle-${taskId}`).value.trim();
  const assignee = document.getElementById(`newSubAssignee-${taskId}`).value || null;
  if (!title) { toast('Escribe un título', 'info'); return; }
  const { error } = await apiCreateSubtask({ title, status:'backlog', assignee_id:assignee, task_id:taskId, project_id:_editingProjectId });
  if (error) { toast('Error al crear subtarea', 'error'); return; }
  toast('Subtarea creada', 'success');
  closeAddSub(taskId);
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

async function deleteTask(taskId) {
  if (!confirm('¿Eliminar esta tarea y sus subtareas?')) return;
  const { error } = await apiDeleteTask(taskId);
  if (error) { toast('Error', 'error'); return; }
  toast('Tarea eliminada', 'success');
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

async function deleteSubtask(subId) {
  if (!confirm('¿Eliminar esta subtarea?')) return;
  const { error } = await apiDeleteSubtask(subId);
  if (error) { toast('Error', 'error'); return; }
  toast('Subtarea eliminada', 'success');
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

// ── Edit task modal ───────────────────────────────────────────────────────────
function openEditTask(taskId) {
  const t = _tasks.find(x => x.id === taskId);
  document.getElementById('editTaskId').value     = t.id;
  document.getElementById('editTaskTitle').value  = t.title;
  document.getElementById('editTaskDesc').value   = t.description||'';
  document.getElementById('editTaskStatus').value = t.status;
  const sel = document.getElementById('editTaskAssignee');
  sel.innerHTML = '<option value="">Sin asignar</option>'
    + _members.map(m=>`<option value="${m.id}" ${t.assignee_id===m.id?'selected':''}>${escHtml(m.full_name)}</option>`).join('');
  openModal('modalEditTask');
}

async function saveEditTask() {
  const id       = document.getElementById('editTaskId').value;
  const title    = document.getElementById('editTaskTitle').value.trim();
  const desc     = document.getElementById('editTaskDesc').value.trim();
  const status   = document.getElementById('editTaskStatus').value;
  const assignee = document.getElementById('editTaskAssignee').value || null;
  if (!title) { toast('Título requerido', 'info'); return; }
  const { error } = await apiUpdateTask(id, { title, description:desc, status, assignee_id:assignee });
  if (error) { toast('Error al guardar', 'error'); return; }
  toast('Tarea actualizada', 'success');
  closeModal('modalEditTask');
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

// ── Edit subtask modal ────────────────────────────────────────────────────────
function openEditSubtask(subId) {
  const s = _subtasks.find(x => x.id === subId);
  document.getElementById('editSubtaskId').value     = s.id;
  document.getElementById('editSubtaskTitle').value  = s.title;
  document.getElementById('editSubtaskStatus').value = s.status;
  const sel = document.getElementById('editSubtaskAssignee');
  sel.innerHTML = '<option value="">Sin asignar</option>'
    + _members.map(m=>`<option value="${m.id}" ${s.assignee_id===m.id?'selected':''}>${escHtml(m.full_name)}</option>`).join('');
  openModal('modalEditSubtask');
}

async function saveEditSubtask() {
  const id       = document.getElementById('editSubtaskId').value;
  const title    = document.getElementById('editSubtaskTitle').value.trim();
  const status   = document.getElementById('editSubtaskStatus').value;
  const assignee = document.getElementById('editSubtaskAssignee').value || null;
  if (!title) { toast('Título requerido', 'info'); return; }
  const { error } = await apiUpdateSubtask(id, { title, status, assignee_id:assignee });
  if (error) { toast('Error al guardar', 'error'); return; }
  toast('Subtarea actualizada', 'success');
  closeModal('modalEditSubtask');
  await reloadTasksAndSubs();
  renderTaskTree(_editingProjectId);
}

// ── Members panel ─────────────────────────────────────────────────────────────
function renderMembersPanel() {
  const projSel = document.getElementById('memberProjectSel');
  if (projSel) {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">— Selecciona proyecto —</option>'
      + _projects.map(p=>`<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
    if (prev) projSel.value = prev;
  }

  const userSel = document.getElementById('memberUserSel');
  if (userSel) {
    userSel.innerHTML = '<option value="">— Selecciona usuario —</option>'
      + _members.map(m=>`<option value="${m.id}">${escHtml(m.full_name)}</option>`).join('');
  }
}

async function loadProjectMembers() {
  const projectId = document.getElementById('memberProjectSel')?.value;
  const listEl = document.getElementById('memberList');
  if (!projectId || !listEl) return;

  listEl.innerHTML = '<div class="empty-row">Cargando…</div>';
  const members = await apiGetProjectMembers(projectId);

  if (!members.length) {
    listEl.innerHTML = '<div class="empty-row">Sin miembros en este proyecto.</div>';
    return;
  }

  const roleBadge = r => r==='owner' ? '👑 Propietario' : r==='admin' ? '⚙️ Admin' : '👤 Miembro';
  listEl.innerHTML = members.map(m => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:13px;font-weight:500">${escHtml(m.profile?.full_name||'—')}</span>
      <span style="font-size:12px;color:var(--text-muted)">${roleBadge(m.role)}</span>
      ${m.role !== 'owner' ? `<button class="btn-icon" onclick="removeMember('${projectId}','${m.user_id}')">✕</button>` : ''}
    </div>`).join('');
}

async function addExistingMember() {
  const projectId = document.getElementById('memberProjectSel')?.value;
  const userId    = document.getElementById('memberUserSel')?.value;
  const role      = document.getElementById('memberRoleSel')?.value || 'member';
  if (!projectId || !userId) { toast('Selecciona proyecto y usuario', 'info'); return; }
  const { error } = await apiAddProjectMember(projectId, userId, role);
  if (error) { toast(error.message.includes('duplicate') ? 'Ya es miembro' : 'Error al agregar', 'error'); return; }
  toast('Colaborador agregado', 'success');
  await loadProjectMembers();
}

async function inviteMemberByEmail() {
  const email     = document.getElementById('inviteEmail')?.value.trim();
  const projectId = document.getElementById('memberProjectSel')?.value;
  if (!email) { toast('Ingresa un correo', 'info'); return; }
  if (!projectId) { toast('Selecciona un proyecto primero', 'info'); return; }

  const { error } = await apiInviteByEmail(email);
  if (error) { toast('Error al enviar invitación: ' + error.message, 'error'); return; }

  // Store pending invite so we can add them to project_members after they log in
  toast(`Invitación enviada a ${email}. Cuando el usuario acceda, agrégalo manualmente al proyecto.`, 'success');
  document.getElementById('inviteEmail').value = '';
}

async function removeMember(projectId, userId) {
  if (!confirm('¿Quitar a este colaborador del proyecto?')) return;
  const { error } = await apiRemoveProjectMember(projectId, userId);
  if (error) { toast('Error al quitar', 'error'); return; }
  toast('Colaborador quitado', 'success');
  await loadProjectMembers();
}

// ── Export ────────────────────────────────────────────────────────────────────
function populateExportSelects() {
  const sel = document.getElementById('exportProjectSel');
  if (sel) sel.innerHTML = '<option value="all">Todos los proyectos</option>'
    + _projects.map(p=>`<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  const statusDiv = document.getElementById('exportStatusChecks');
  if (statusDiv) statusDiv.innerHTML = Object.entries(STATUS_META).map(([k,v])=>`
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
      <input type="checkbox" value="${k}" checked/> ${v.label}
    </label>`).join('');
}

async function runExportProjects() {
  const projId = document.getElementById('exportProjectSel')?.value;
  let projs = projId === 'all' ? _projects : _projects.filter(p => p.id === projId);
  const enriched = projs.map(p => ({
    ...p,
    tasks: _tasks.filter(t => t.project_id === p.id).map(t => ({
      ...t,
      subtasks: _subtasks.filter(s => s.task_id === t.id)
    }))
  }));
  exportProjectsToExcel(enriched);
}

async function runExportSubtasks() {
  const dateFrom = document.getElementById('exportDateFrom')?.value;
  const dateTo   = document.getElementById('exportDateTo')?.value;
  const checks   = document.querySelectorAll('#exportStatusChecks input:checked');
  const statuses = Array.from(checks).map(c => c.value);
  exportSubtasksToExcel(_subtasks, dateFrom, dateTo, statuses);
}

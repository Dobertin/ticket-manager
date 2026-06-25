// ─── Dashboard module ─────────────────────────────────────────────────────────

let _allSubtasks = [];
let _allTasks    = [];
let _projects    = [];
let _members     = [];
let _dragId      = null;
let _dashboardCurrentUser  = null;

const COLS = [
  { key: 'backlog',     label: 'Backlog',      dot: '#94a3b8' },
  { key: 'in_progress', label: 'En proceso',   dot: '#3b82f6' },
  { key: 'in_review',   label: 'En revisión',  dot: '#f59e0b' },
  { key: 'blocked',     label: 'Bloqueado',    dot: '#ef4444' },
  { key: 'done',        label: 'Finalizado',   dot: '#22c55e' },
];

// ── Init ──────────────────────────────────────────────────────────────────────
async function initDashboard(user) {
  _dashboardCurrentUser  = user;
  initComments(user);

  const [subtasks, tasks, projects, members] = await Promise.all([
    apiGetSubtasks(),
    apiGetTasks(),
    apiGetProjects(),
    apiGetProfiles(),
  ]);

  _allSubtasks = subtasks;
  _allTasks    = tasks;
  _projects    = projects;
  _members     = members;

  populateDashboardFilters();
  renderBoard();

  // Wire filters
  document.getElementById('filterProject')?.addEventListener('change', renderBoard);
  document.getElementById('filterAssignee')?.addEventListener('change', renderBoard);
  document.getElementById('showDone')?.addEventListener('change', renderBoard);
}

function populateDashboardFilters() {
  const fp = document.getElementById('filterProject');
  const fa = document.getElementById('filterAssignee');
  if (fp) {
    fp.innerHTML = '<option value="">Todos los proyectos</option>'
      + _projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');
  }
  if (fa) {
    fa.innerHTML = '<option value="">Todos los responsables</option>'
      + _members.map(m => `<option value="${m.id}">${escHtml(m.full_name)}</option>`).join('');
  }
}

// ── Board ──────────────────────────────────────────────────────────────────────
function getFilteredSubtasks() {
  const projId   = document.getElementById('filterProject')?.value || '';
  const assignId = document.getElementById('filterAssignee')?.value || '';
  const showDone = document.getElementById('showDone')?.checked || false;

  return _allSubtasks.filter(s => {
    if (!showDone && (s.status === 'done' || s.task?.project?.status === 'archived')) return false;
    if (projId   && s.task?.project?.id !== projId) return false;
    if (assignId && s.assignee?.id !== assignId) return false;
    return true;
  });
}

function projectPct(projectId) {
  const subs = _allSubtasks.filter(s => s.task?.project?.id === projectId);
  if (!subs.length) return 0;
  return Math.round(subs.filter(s => s.status === 'done').length / subs.length * 100);
}

function taskPct(taskId) {
  const subs = _allSubtasks.filter(s => s.task?.id === taskId);
  if (!subs.length) return 0;
  return Math.round(subs.filter(s => s.status === 'done').length / subs.length * 100);
}

function renderBoard() {
  const filtered = getFilteredSubtasks();
  const board = document.getElementById('board');
  if (!board) return;

  board.innerHTML = COLS.map(col => {
    const cards = filtered.filter(s => s.status === col.key);
    return `
    <div class="column" data-status="${col.key}"
         ondragover="onDragOver(event)" ondrop="onDrop(event)" ondragleave="onDragLeave(event)">
      <div class="col-header">
        <span class="col-dot" style="background:${col.dot}"></span>
        <span class="col-title">${col.label}</span>
        <span class="col-count">${cards.length}</span>
      </div>
      <div class="col-body" id="body-${col.key}">
        ${cards.length
          ? cards.map(renderCard).join('')
          : `<div class="col-empty">Sin tarjetas</div>`}
      </div>
    </div>`;
  }).join('');
}

function renderCard(s) {
  const pp = projectPct(s.task?.project?.id);
  const tp = taskPct(s.task?.id);
  const assignee = escHtml(s.assignee?.full_name || '—');
  
  // Escapa el título correctamente para usarlo en el atributo onclick
  const safeTitle = s.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");

  return `
  <div class="card" id="card-${s.id}" draggable="true"
       ondragstart="onDragStart(event,'${s.id}')" ondragend="onDragEnd(event)">
    <div class="card-title">${escHtml(s.title)}</div>
    <div class="card-row">
      <span class="card-label">Proyecto</span>
      <span class="card-value">${escHtml(s.task?.project?.name || '—')} ${pctBadge(pp)}</span>
    </div>
    <div class="card-row">
      <span class="card-label">Tarea</span>
      <span class="card-value">${escHtml(s.task?.title || '—')} ${pctBadge(tp)}</span>
    </div>
    <div class="card-meta">
      <span class="assignee-chip">${assignee}</span>
    </div>
    <div class="card-actions">
      <button class="card-btn" onclick="openCommentModal('subtask','${s.id}','${safeTitle}')">
        💬 Comentar
      </button>
      <button class="card-btn" onclick="openStatusModal('${s.id}')">
        ⇄ Estado
      </button>
    </div>
  </div>`;
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function onDragStart(e, id) {
  _dragId = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => document.getElementById(`card-${id}`)?.classList.add('dragging'), 0);
}
function onDragEnd() {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.col-body').forEach(c => c.classList.remove('drag-over'));
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.querySelector('.col-body')?.classList.add('drag-over');
}
function onDragLeave(e) {
  e.currentTarget.querySelector('.col-body')?.classList.remove('drag-over');
}
async function onDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.querySelector('.col-body')?.classList.remove('drag-over');
  const newStatus = col.dataset.status;
  if (!_dragId || !newStatus) return;

  const sub = _allSubtasks.find(s => s.id === _dragId);
  if (!sub || sub.status === newStatus) return;

  const { error } = await apiUpdateSubtask(_dragId, { status: newStatus });
  if (error) { toast('Error al actualizar estado', 'error'); return; }

  sub.status = newStatus;
  sub.updated_at = new Date().toISOString();
  renderBoard();
  toast(`→ ${STATUS_META[newStatus].label}`, 'success');
}

// ── Status modal ──────────────────────────────────────────────────────────────
function openStatusModal(subtaskId) {
  const sub = _allSubtasks.find(s => s.id === subtaskId);
  const container = document.getElementById('statusOptions');
  if (!container) return;
  container.innerHTML = COLS.map(col => {
    const active = sub.status === col.key;
    return `
    <button onclick="applyStatus('${subtaskId}','${col.key}')"
      style="display:flex;align-items:center;gap:10px;padding:9px 12px;
        border-radius:7px;border:1px solid ${active ? 'var(--accent)' : 'var(--border)'};
        background:${active ? '#eef2ff' : 'var(--surface)'};
        color:${active ? 'var(--accent)' : 'var(--text)'};cursor:pointer;font-size:13px;
        font-weight:${active ? '600' : '400'};width:100%;text-align:left;transition:all .15s">
      <span style="width:10px;height:10px;border-radius:50%;background:${col.dot};flex-shrink:0"></span>
      ${col.label}
      ${active ? '<span style="margin-left:auto">✓</span>' : ''}
    </button>`;
  }).join('');
  openModal('modalStatus');
}

async function applyStatus(subtaskId, newStatus) {
  const sub = _allSubtasks.find(s => s.id === subtaskId);
  if (!sub || sub.status === newStatus) { closeModal('modalStatus'); return; }

  const { error } = await apiUpdateSubtask(subtaskId, { status: newStatus });
  if (error) { toast('Error al actualizar', 'error'); return; }

  sub.status = newStatus;
  sub.updated_at = new Date().toISOString();
  closeModal('modalStatus');
  renderBoard();
  toast(`→ ${STATUS_META[newStatus].label}`, 'success');
}

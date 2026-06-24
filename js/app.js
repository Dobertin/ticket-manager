// ─── Shared Utilities ────────────────────────────────────────────────────────

// Semaphore: 0-33 red, 34-80 yellow, 81-100 green
function semaphoreColor(pct) {
  if (pct <= 33) return { bg: '#fef2f2', dot: '#ef4444', text: '#991b1b' };
  if (pct <= 80) return { bg: '#fffbeb', dot: '#f59e0b', text: '#92400e' };
  return { bg: '#f0fdf4', dot: '#22c55e', text: '#166534' };
}

function semaphoreDot(pct) {
  const c = semaphoreColor(pct);
  return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;
    background:${c.dot};margin-right:4px;flex-shrink:0"></span>`;
}

function pctBadge(pct) {
  const c = semaphoreColor(pct);
  return `<span style="display:inline-flex;align-items:center;padding:2px 7px;
    border-radius:10px;font-size:11px;font-weight:600;
    background:${c.bg};color:${c.text}">${semaphoreDot(pct)}${pct}%</span>`;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_META = {
  backlog:     { label: 'Backlog',      dot: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
  in_progress: { label: 'En proceso',   dot: '#3b82f6', bg: '#dbeafe', text: '#1d4ed8' },
  in_review:   { label: 'En revisión',  dot: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  blocked:     { label: 'Bloqueado',    dot: '#ef4444', bg: '#fee2e2', text: '#991b1b' },
  done:        { label: 'Finalizado',   dot: '#22c55e', bg: '#dcfce7', text: '#166534' },
};
const STATUS_ORDER = ['backlog', 'in_progress', 'in_review', 'blocked', 'done'];

function statusBadge(status) {
  const m = STATUS_META[status] || STATUS_META.backlog;
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px;
    border-radius:10px;font-size:11px;font-weight:600;
    background:${m.bg};color:${m.text}">
    <span style="width:7px;height:7px;border-radius:50%;background:${m.dot};flex-shrink:0"></span>
    ${m.label}</span>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;
    background:#1e293b;color:#f8fafc;padding:12px 18px;border-radius:8px;
    font-size:13px;border-left:4px solid ${colors[type]||colors.info};
    box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:320px;line-height:1.4;
    animation:fadeIn .2s ease`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.style.display = 'none';
    document.body.style.overflow = '';
  }
});

// ─── Nav ──────────────────────────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('nav-active', el.dataset.nav === page);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ─── Excel Export (SheetJS) ───────────────────────────────────────────────────
function exportProjectsToExcel(projects) {
  const rows = [];
  for (const p of projects) {
    rows.push({ Tipo:'Proyecto', Nombre:p.name, Descripción:p.description||'',
      Estado:p.status, Responsable:p.owner?.full_name||'',
      Creado:fmtDate(p.created_at), Actualizado:fmtDate(p.updated_at) });
    for (const t of p.tasks||[]) {
      rows.push({ Tipo:'Tarea', Nombre:t.title, Descripción:t.description||'',
        Estado:t.status, Responsable:t.assignee?.full_name||'',
        Creado:fmtDate(t.created_at), Actualizado:fmtDate(t.updated_at) });
      for (const s of t.subtasks||[]) {
        rows.push({ Tipo:'Subtarea', Nombre:s.title, Descripción:'',
          Estado:s.status, Responsable:s.assignee?.full_name||'',
          Creado:fmtDate(s.created_at), Actualizado:fmtDate(s.updated_at) });
      }
    }
  }
  downloadXLSX(rows, 'proyectos_completo');
}

function exportSubtasksToExcel(subtasks, dateFrom, dateTo, statuses) {
  let filtered = [...subtasks];
  if (dateFrom) filtered = filtered.filter(s => s.updated_at >= dateFrom);
  if (dateTo)   filtered = filtered.filter(s => s.updated_at <= dateTo + 'T23:59:59');
  if (statuses?.length) filtered = filtered.filter(s => statuses.includes(s.status));
  const rows = filtered.map(s => ({
    Nombre: s.title,
    Proyecto: s.task?.project?.name||'',
    Tarea: s.task?.title||'',
    Estado: STATUS_META[s.status]?.label || s.status,
    Responsable: s.assignee?.full_name||'',
    Creado: fmtDate(s.created_at),
    Actualizado: fmtDate(s.updated_at),
  }));
  if (!rows.length) { toast('No hay subtareas con esos filtros', 'info'); return; }
  downloadXLSX(rows, 'subtareas_filtradas');
}

function downloadXLSX(rows, filename) {
  if (!window.XLSX) { toast('Librería XLSX no disponible', 'error'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Archivo exportado', 'success');
}

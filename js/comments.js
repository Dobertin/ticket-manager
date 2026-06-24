// ─── Comments module ──────────────────────────────────────────────────────────

let _activeCommentEntity = null; // { type, id, title }
let _currentUser = null;

function initComments(currentUser) {
  _currentUser = currentUser;
}

async function openCommentModal(entityType, entityId, title) {
  _activeCommentEntity = { type: entityType, id: entityId };
  document.getElementById('commentModalTitle').textContent = title;
  document.getElementById('commentInput').value = '';
  openModal('modalComments');
  await renderComments();
}

async function renderComments() {
  const list = document.getElementById('commentList');
  list.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px">Cargando…</div>';

  const comments = await apiGetComments(_activeCommentEntity.type, _activeCommentEntity.id);

  if (!comments.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">Sin comentarios aún.</div>';
    return;
  }

  list.innerHTML = comments.map(c => {
    const name   = escHtml(c.author?.full_name || 'Usuario');
    const avatar = c.author?.avatar_url;
    const initials = name.charAt(0).toUpperCase();
    return `
    <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex-shrink:0">
        ${avatar
          ? `<img src="${avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover">`
          : `<div style="width:30px;height:30px;border-radius:50%;background:var(--accent);
               color:#fff;display:flex;align-items:center;justify-content:center;
               font-size:12px;font-weight:700">${initials}</div>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px">
          <span style="font-weight:600;font-size:13px">${name}</span>
          <span style="font-size:11px;color:var(--text-muted)">${fmtDateTime(c.created_at)}</span>
        </div>
        <div style="font-size:13px;color:var(--text);white-space:pre-wrap;word-break:break-word">${escHtml(c.content)}</div>
      </div>
    </div>`;
  }).join('');

  // scroll to bottom
  list.scrollTop = list.scrollHeight;
}

async function submitComment() {
  if (!_activeCommentEntity) return;
  const content = document.getElementById('commentInput').value.trim();
  if (!content) { toast('Escribe un comentario primero', 'info'); return; }
  if (!_currentUser) { toast('Debes iniciar sesión', 'error'); return; }

  const btn = document.querySelector('#modalComments .btn-send-comment');
  if (btn) btn.disabled = true;

  const { error } = await apiAddComment({
    entity_type: _activeCommentEntity.type,
    entity_id:   _activeCommentEntity.id,
    content,
    author_id:   _currentUser.id,
  });

  if (btn) btn.disabled = false;

  if (error) { toast('Error al guardar comentario', 'error'); console.error(error); return; }

  document.getElementById('commentInput').value = '';
  await renderComments();
}

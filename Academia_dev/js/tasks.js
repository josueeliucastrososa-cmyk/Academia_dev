let editTaskId       = null;
let _editSubtasks    = [];
let _editAttachments = [];
let _editComments    = [];

function fmtD(ds) {
  if (!ds) return '';
  return new Date(ds + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}
function dueClass(due) {
  if (!due) return '';
  const d = (new Date(due) - new Date()) / 86400000;
  return d < 0 ? 'urgent' : d <= 1 ? 'urgent' : d <= 3 ? 'soon' : '';
}
function getTypeBadgeClass(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('tarea'))    return 'tb-tarea';
  if (t.includes('parcial'))  return 'tb-parcial';
  if (t.includes('lab'))      return 'tb-lab';
  if (t.includes('proyecto')) return 'tb-proyecto';
  if (t.includes('quiz'))     return 'tb-quiz';
  if (t.includes('taller'))   return 'tb-taller';
  if (t.includes('hoja'))     return 'tb-hoja';
  if (t.includes('final') || t.includes('examen')) return 'tb-examen';
  return 'tb-default';
}
function subtaskProgress(task) {
  if (!task.subtasks || !task.subtasks.length) return null;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total: task.subtasks.length, pct: Math.round(done / task.subtasks.length * 100) };
}
function prioIcon(p)  { return p === 'high' ? '🔴' : p === 'low' ? '🟢' : '🟡'; }
function prioBadge(p) {
  const cls = p === 'high' ? 'pb-high' : p === 'low' ? 'pb-low' : 'pb-med';
  const lbl = p === 'high' ? 'Alta'    : p === 'low' ? 'Baja'   : 'Media';
  return `<span class="priority-badge ${cls}">${prioIcon(p)} ${lbl}</span>`;
}

function renderSubtasksEditor(list) {
  _editSubtasks = Array.isArray(list) ? list : [];
  const c = document.getElementById('subtasks-editor');
  if (!c) return;
  c.innerHTML = _editSubtasks.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="subtaskEditorToggle(${i})"
        style="accent-color:var(--accent);cursor:pointer;width:15px;height:15px;">
      <input type="text" class="form-input" value="${(s.text||'').replace(/"/g,'&quot;')}"
        oninput="subtaskEditorText(${i},this.value)"
        style="flex:1;padding:5px 8px;font-size:12px;" placeholder="Subtarea...">
      <button class="btn btn-danger btn-sm" onclick="subtaskEditorRemove(${i})" style="padding:3px 8px;">✕</button>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="subtaskEditorAdd()" style="margin-top:4px;font-size:11px;">+ Agregar subtarea</button>`;
}
function subtaskEditorAdd()      { _editSubtasks.push({ text:'', done:false }); renderSubtasksEditor(_editSubtasks); }
function subtaskEditorText(i, v) { if (_editSubtasks[i]) _editSubtasks[i].text = v; }
function subtaskEditorToggle(i)  { if (_editSubtasks[i]) { _editSubtasks[i].done = !_editSubtasks[i].done; renderSubtasksEditor(_editSubtasks); } }
function subtaskEditorRemove(i)  { _editSubtasks.splice(i, 1); renderSubtasksEditor(_editSubtasks); }

function renderAttachmentsEditor(list) {
  _editAttachments = Array.isArray(list) ? list : [];
  const c = document.getElementById('attachments-editor');
  if (!c) return;
  c.innerHTML = _editAttachments.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:7px 10px;background:var(--surface2);border-radius:7px;border:1px solid var(--border);">
      <span style="font-size:18px;">${a.type === 'pdf' ? '📄' : '🖼️'}</span>
      <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</span>
      <button class="btn btn-ghost btn-sm" onclick="previewAttachment(${i})" style="font-size:11px;">👁 Ver</button>
      <button class="btn btn-danger btn-sm" onclick="removeAttachment(${i})" style="padding:3px 7px;">✕</button>
    </div>`).join('')
    + `<label class="btn btn-ghost btn-sm" style="cursor:pointer;margin-top:4px;font-size:11px;display:inline-flex;align-items:center;gap:5px;">
        📎 Adjuntar archivo
        <input type="file" accept="image/*,.pdf" style="display:none;" onchange="handleAttachmentUpload(this)">
       </label>`;
}
function renderCommentsEditor(list) {
  const c = document.getElementById('comments-editor');
  if (!c) return;
  c.innerHTML = _editComments.map((x, i) => `
    <div style="background:var(--surface2);border-radius:7px;padding:9px 11px;margin-bottom:6px;border-left:2px solid var(--border2);">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${x.date || ''}</span>
        <button class="btn btn-danger btn-sm" onclick="removeComment(${i})" style="padding:2px 6px;font-size:10px;">✕</button>
      </div>
      <textarea class="form-textarea" rows="2" style="font-size:12px;"
        oninput="commentText(${i},this.value)">${(x.text || '').replace(/</g,'&lt;')}</textarea>
    </div>`).join('')
    + `<button class="btn btn-ghost btn-sm" onclick="addComment()" style="margin-top:4px;font-size:11px;">💬 Agregar comentario</button>`;
}
function addComment() {
  const now = new Date().toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  _editComments.push({ text:'', date: now });
  renderCommentsEditor(_editComments);
}
function commentText(i, v) { if (_editComments[i]) _editComments[i].text = v; }
function removeComment(i)  { _editComments.splice(i, 1); renderCommentsEditor(_editComments); }

function openTaskModal(id) {
  editTaskId = id || null;
  _editSubtasks = []; _editAttachments = []; _editComments = [];

  fillMatSels();
  const existing = id ? State.tasks.find(t => t.id === id) : null;

  if (existing) {
    document.getElementById('task-modal-title').textContent = '✏️ Editar Tarea';
    document.getElementById('t-title').value = existing.title;
    document.getElementById('t-mat').value   = existing.matId;
    document.getElementById('t-prio').value  = existing.priority;
    document.getElementById('t-date-planned').value = existing.datePlanned || '';
    document.getElementById('t-due').value   = existing.due || '';
    document.getElementById('t-type').value  = existing.type || 'Tarea';
    document.getElementById('t-notes').value = existing.notes || '';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = existing.timeEst || '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = (existing.tags||[]).join(', ');
    _editSubtasks    = JSON.parse(JSON.stringify(existing.subtasks    || []));
    _editAttachments = JSON.parse(JSON.stringify(existing.attachments || []));
    _editComments    = JSON.parse(JSON.stringify(existing.comments    || []));
  } else {
    document.getElementById('task-modal-title').textContent = '✅ Nueva Tarea';
    document.getElementById('t-title').value = '';
    document.getElementById('t-date-planned').value = '';
    document.getElementById('t-due').value   = '';
    document.getElementById('t-notes').value = '';
    document.getElementById('t-prio').value  = 'med';
    document.getElementById('t-type').value  = 'Tarea';
    if (document.getElementById('t-time-est')) document.getElementById('t-time-est').value = '';
    if (document.getElementById('t-tags')) document.getElementById('t-tags').value = '';
  }

  document.querySelectorAll('#modal-task .modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  renderSubtasksEditor(_editSubtasks);
  renderAttachmentsEditor(_editAttachments);
  renderCommentsEditor(_editComments);
  document.getElementById('modal-task').classList.add('open');
}

function switchTaskTab(tab, el) {
  document.querySelectorAll('#modal-task .modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#modal-task .modal-tab-panel').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  const panel = document.getElementById('ttab-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'subtasks')    renderSubtasksEditor(_editSubtasks);
  if (tab === 'attachments') renderAttachmentsEditor(_editAttachments);
  if (tab === 'comments')    renderCommentsEditor(_editComments);
}

function saveTask() {
  const title = document.getElementById('t-title').value.trim();
  if (!title) {
    document.getElementById('t-title').style.borderColor = 'var(--red)';
    document.getElementById('t-title').focus();
    return;
  }
  document.getElementById('t-title').style.borderColor = '';

  document.querySelectorAll('#subtasks-editor input[type="text"]').forEach((inp, i) => {
    if (_editSubtasks[i]) _editSubtasks[i].text = inp.value;
  });
  document.querySelectorAll('#comments-editor textarea').forEach((ta, i) => {
    if (_editComments[i]) _editComments[i].text = ta.value;
  });

  const existing = editTaskId ? State.tasks.find(t => t.id === editTaskId) : null;
  const task = {
    id:          editTaskId || Date.now().toString(),
    title,
    matId:       document.getElementById('t-mat').value,
    priority:    document.getElementById('t-prio').value,
    datePlanned: document.getElementById('t-date-planned').value,
    due:         document.getElementById('t-due').value,
    type:        document.getElementById('t-type').value,
    notes:       document.getElementById('t-notes').value,
    timeEst:     parseInt(document.getElementById('t-time-est')?.value) || 0,
    tags:        (document.getElementById('t-tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean),
    kanbanCol:   existing?.kanbanCol || 'todo',
    done:        existing ? existing.done : false,
    createdAt:   existing ? existing.createdAt : Date.now(),
    subtasks:    _editSubtasks.filter(s => s.text.trim()),
    attachments: _editAttachments,
    comments:    _editComments.filter(c => c.text.trim()),
  };

  if (editTaskId) {
    const idx = State.tasks.findIndex(t => t.id === editTaskId);
    if (idx >= 0) State.tasks[idx] = task;
  } else {
    State.tasks.unshift(task);
  }

  saveState(['tasks']);
  closeModal('modal-task');
  renderTasks();
  updateBadge();
  renderOverview();
  renderCalendar();
}

function toggleTask(id) {
  const t = State.tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  t.done = !t.done;
  _uiClick(wasDone ? 'task-undone' : 'task-done');
  if (!wasDone) { _updateStreak(); }
  saveState(['tasks']); renderTasks(); updateBadge(); renderOverview(); renderCalendar();
}
function toggleSubtask(taskId, idx) {
  const t = State.tasks.find(x => x.id === taskId);
  if (!t?.subtasks?.[idx]) return;
  t.subtasks[idx].done = !t.subtasks[idx].done;
  if (t.subtasks.every(s => s.done)) t.done = true;
  saveState(['tasks']); renderTasks(); updateBadge(); renderCalendar();
}
function deleteTask(id) {
  State.tasks = State.tasks.filter(t => t.id !== id);
  saveState(['tasks']); renderTasks(); updateBadge(); renderOverview(); renderCalendar();
}
function toggleDesc(id) {
  const el  = document.getElementById('desc-' + id);
  const btn = document.getElementById('descbtn-' + id);
  if (!el) return;
  const shown = el.style.display !== 'none';
  el.style.display = shown ? 'none' : 'block';
  if (btn) btn.textContent = (shown ? '▸' : '▾') + ' Ver descripción';
}
function updateBadge() {
  const count = State.tasks.filter(t => !t.done).length;
  const b1 = document.getElementById('badge-tasks');
  const b2 = document.getElementById('badge-tasks-m');
  if (b1) b1.textContent = count;
  if (b2) b2.textContent = count;
  // Update hoy badge
  const today = new Date().toISOString().split('T')[0];
  const urgent = State.tasks.filter(t => !t.done && t.due && t.due <= today).length;
  const badge = document.getElementById('badge-hoy');
  if (badge) { badge.style.display = urgent > 0 ? 'inline' : 'none'; badge.textContent = urgent; }
}

function renderTasks() { _schedRender(_renderTasks); }
function _renderTasks() {
  const list = _el('tasks-list');
  if (!list) return;

  const mf = document.getElementById('tf-mat')?.value    || '';
  const sf = document.getElementById('tf-status')?.value || '';
  const pf = document.getElementById('tf-prio')?.value   || '';
  const qf = (document.getElementById('search-input')?.value || '').toLowerCase();

  let filtered = State.tasks.filter(t =>
    (!mf || t.matId === mf) &&
    (!sf || (sf === 'pending' ? !t.done : t.done)) &&
    (!pf || t.priority === pf) &&
    (!qf || t.title.toLowerCase().includes(qf) || (t.notes || '').toLowerCase().includes(qf))
  );

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pd = { high:0, med:1, low:2 };
    return (pd[a.priority] ?? 1) - (pd[b.priority] ?? 1);
  });

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">
      <div style="font-size:36px;margin-bottom:10px;">✅</div>
      <div style="font-size:14px;">No hay tareas aquí</div></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const m       = getMat(t.matId);
    const dc      = dueClass(t.due);
    const prog    = subtaskProgress(t);
    const pStripe = t.priority === 'high' ? 'p-high-stripe' : t.priority === 'low' ? 'p-low-stripe' : 'p-med-stripe';
    const tBadge  = getTypeBadgeClass(t.type);
    const highGlowClass = t.priority === 'high' && !t.done ? ' prio-high-glow' : '';

    const subtasksHtml = prog ? `
      <div style="margin-top:7px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <div class="prog-bar" style="flex:1;height:4px;">
            <div class="prog-fill" style="background:${prog.pct===100?'#4ade80':'#7c6aff'};width:${prog.pct}%;"></div>
          </div>
          <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;white-space:nowrap;">${prog.done}/${prog.total}</span>
        </div>
        ${t.subtasks.map((s, i) => `
          <div onclick="toggleSubtask('${t.id}',${i})"
            style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;${s.done?'opacity:.5;':''}">
            <div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;
              border:2px solid ${s.done?'var(--accent)':'var(--border2)'};
              background:${s.done?'var(--accent)':'transparent'};
              display:flex;align-items:center;justify-content:center;">
              ${s.done ? '<span style="font-size:9px;color:#fff;">✓</span>' : ''}
            </div>
            <span style="font-size:12px;${s.done?'text-decoration:line-through;color:var(--text3);':''}">${s.text}</span>
          </div>`).join('')}
      </div>` : '';

    const attachHtml = t.attachments?.length ? `
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
        ${t.attachments.map((a, i) => `
          <button onclick="previewTaskAttachment('${t.id}',${i})"
            class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;">
            ${a.type === 'pdf' ? '📄' : '🖼️'} ${a.name.length > 18 ? a.name.slice(0,16)+'…' : a.name}
          </button>`).join('')}
      </div>` : '';

    const descHtml = t.notes ? `
      <div id="desc-${t.id}" style="display:none;font-size:12px;color:var(--text2);margin-top:6px;padding:8px;background:var(--surface2);border-radius:6px;white-space:pre-wrap;">${t.notes.replace(/</g,'&lt;')}</div>
      <button id="descbtn-${t.id}" onclick="toggleDesc('${t.id}')"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;margin-top:4px;padding:0;">▸ Ver descripción</button>` : '';

    const commBadge = t.comments?.length
      ? `<span style="font-size:11px;color:var(--text3);">💬 ${t.comments.length}</span>` : '';

    return `<div class="task-item${t.done ? ' done' : ''}${highGlowClass}" draggable="true" 
      data-id="${t.id}"
      ondragstart="taskDragStart(event,'${t.id}')"
      ondragover="taskDragOver(event)"
      ondrop="taskDrop(event,'${t.id}')"
      ondragleave="taskDragLeave(event)">
      <div class="task-drag-handle" title="Arrastrar">⠿</div>
      <div class="priority-stripe ${pStripe}"></div>
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
      <div style="flex:1;min-width:0;">
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <span class="task-subject" style="background:${m.color||'#7c6aff'}22;color:${m.color||'#7c6aff'};border:1px solid ${m.color||'#7c6aff'}44;">${m.icon||'📚'} ${m.code||'?'}</span>
          <span class="type-badge ${tBadge}">${t.type || 'Tarea'}</span>
          ${prioBadge(t.priority)}
          ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
          ${t.timeEst ? `<span style="font-size:10px;color:var(--text3);">⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}</span>` : ''}
          ${(t.tags||[]).map(tg=>`<span class="tag-chip">#${tg}</span>`).join('')}
          ${commBadge}
        </div>
        ${subtasksHtml}
        ${attachHtml}
        ${descHtml}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" onclick="openTaskDetail('${t.id}')" title="Ver detalles">👁</button>
        <button class="btn btn-ghost btn-sm" onclick="openTaskModal('${t.id}')" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// ATTACHMENT UPLOAD
// ═══════════════════════════════════════════════════════
function handleAttachmentUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB por archivo.'); input.value=''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    _editAttachments.push({
      name: file.name,
      type: file.type === 'application/pdf' ? 'pdf' : file.type.startsWith('image/') ? 'image' : 'file',
      size: file.size,
      data: e.target.result,
      date: new Date().toLocaleDateString('es-ES')
    });
    renderAttachmentsEditor(_editAttachments);
  };
  reader.readAsDataURL(file);
  input.value = '';
}
function removeAttachment(i) {
  _editAttachments.splice(i, 1);
  renderAttachmentsEditor(_editAttachments);
}
function previewAttachment(i) {
  const a = _editAttachments[i];
  if (a) _openAttachmentPreview(a);
}
function previewTaskAttachment(taskId, i) {
  const t = State.tasks.find(x => x.id === taskId);
  if (t?.attachments?.[i]) _openAttachmentPreview(t.attachments[i]);
}
function _openAttachmentPreview(a) {
  if (!a?.data) { alert('Sin datos para previsualizar.'); return; }
  if (a.type === 'image') {
    const w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>' + a.name + '</title><style>body{margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100%;max-height:100vh;object-fit:contain;}</style></head><body><img src="' + a.data + '" alt="' + a.name + '"></body></html>');
  } else if (a.type === 'pdf') {
    const w = window.open('', '_blank');
    w.document.write('<!DOCTYPE html><html><head><title>' + a.name + '</title><style>body{margin:0;}</style></head><body><iframe src="' + a.data + '" style="width:100vw;height:100vh;border:none;"></iframe></body></html>');
  } else {
    const link = document.createElement('a');
    link.href = a.data; link.download = a.name; link.click();
  }
}

// ═══════════════════════════════════════════════════════
// TASK DETAIL VIEW
// ═══════════════════════════════════════════════════════
function openTaskDetail(id) {
  const t = State.tasks.find(x => x.id === id);
  if (!t) return;
  const m = getMat(t.matId);
  const prog = subtaskProgress(t);

  const subtasksHtml = t.subtasks && t.subtasks.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📋 Subtareas</div>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
    '<div class="prog-bar" style="flex:1;height:6px;"><div class="prog-fill" style="background:' + (prog && prog.pct===100?'#4ade80':'#7c6aff') + ';width:' + (prog?prog.pct:0) + '%;"></div></div>' +
    '<span style="font-size:11px;color:var(--text3);font-family:Space Mono,monospace;">' + (prog?prog.done:0) + '/' + (prog?prog.total:0) + '</span>' +
    '</div>' +
    t.subtasks.map(function(s,i) {
      return '<div onclick="toggleSubtask(\'' + t.id + '\',' + i + ');openTaskDetail(\'' + t.id + '\')" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer;' + (s.done?'opacity:.5':'') + '">' +
        '<div style="width:16px;height:16px;border-radius:4px;flex-shrink:0;border:2px solid ' + (s.done?'var(--accent)':'var(--border2)') + ';background:' + (s.done?'var(--accent)':'transparent') + ';display:flex;align-items:center;justify-content:center;">' +
        (s.done?'<span style="font-size:10px;color:#fff;">✓</span>':'') +
        '</div><span style="font-size:13px;' + (s.done?'text-decoration:line-through;color:var(--text3);':'') + '">' + s.text + '</span></div>';
    }).join('') +
    '</div>'
  ) : '';

  const attachHtml = t.attachments && t.attachments.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📎 Archivos adjuntos</div>' +
    t.attachments.map(function(a,i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">' +
        '<span style="font-size:20px;">' + (a.type==='pdf'?'📄':a.type==='image'?'🖼️':'📎') + '</span>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + a.name + '</div>' +
        '<div style="font-size:10px;color:var(--text3);">' + (a.date||'') + ' · ' + (a.size?Math.round(a.size/1024)+'KB':'') + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="previewTaskAttachment(\'' + t.id + '\',' + i + ')" style="font-size:11px;">👁 Ver</button>' +
        '</div>';
    }).join('') +
    '</div>'
  ) : '';

  const commentsHtml = t.comments && t.comments.length ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">💬 Comentarios</div>' +
    t.comments.map(function(c) {
      return '<div style="background:var(--surface2);border-radius:7px;padding:9px 11px;margin-bottom:6px;border-left:3px solid var(--accent);">' +
        '<div style="font-size:10px;color:var(--text3);margin-bottom:4px;font-family:Space Mono,monospace;">' + (c.date||'') + '</div>' +
        '<div style="font-size:13px;white-space:pre-wrap;">' + (c.text||'').replace(/</g,'&lt;') + '</div></div>';
    }).join('') +
    '</div>'
  ) : '';

  const notesHtml = t.notes ? (
    '<div class="detail-section">' +
    '<div class="detail-section-title">📝 Descripción</div>' +
    '<div style="font-size:13px;color:var(--text2);white-space:pre-wrap;padding:10px;background:var(--surface2);border-radius:8px;">' + t.notes.replace(/</g,'&lt;') + '</div>' +
    '</div>'
  ) : '';

  const emptyHtml = (!subtasksHtml && !notesHtml && !attachHtml && !commentsHtml) ?
    '<div style="text-align:center;padding:32px;color:var(--text3);"><div style="font-size:32px;margin-bottom:8px;">📋</div><div>Sin detalles adicionales</div>' +
    '<button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="closeTaskDetail();openTaskModal(\'' + t.id + '\')">✏️ Agregar detalles</button></div>' : '';

  let modal = document.getElementById('modal-task-detail');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-task-detail';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    modal.onclick = function(e) { if(e.target===modal) closeTaskDetail(); };
    document.body.appendChild(modal);
  }

  const prio = prioBadge(t.priority);
  const typeBadge = getTypeBadgeClass(t.type);
  const dueStr = t.due ? '<span style="font-size:11px;color:var(--text3);">📅 ' + fmtD(t.due) + '</span>' : '';
  const timeStr = t.timeEst ? '<span style="font-size:11px;color:var(--text3);">⏱ ' + (t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min') + '</span>' : '';
  const titleStr = t.done ? '<s style="opacity:.5">' + t.title + '</s>' : t.title;
  const attachCount = t.attachments && t.attachments.length ? '📎 ' + t.attachments.length + ' archivo' + (t.attachments.length>1?'s':'') : '';
  const commCount = t.comments && t.comments.length ? ' · 💬 ' + t.comments.length : '';

  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.6);">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border);background:var(--surface2);">' +
    '<div style="flex:1;min-width:0;">' +
    '<div style="font-size:16px;font-weight:800;margin-bottom:6px;">' + titleStr + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
    '<span style="background:' + (m.color||'#7c6aff') + '22;color:' + (m.color||'#7c6aff') + ';border:1px solid ' + (m.color||'#7c6aff') + '44;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">' + (m.icon||'📚') + ' ' + (m.name||'—') + '</span>' +
    '<span class="type-badge ' + typeBadge + '">' + (t.type||'Tarea') + '</span>' +
    prio + dueStr + timeStr +
    '</div></div>' +
    '<div style="display:flex;gap:6px;flex-shrink:0;">' +
    '<button class="btn btn-ghost btn-sm" onclick="closeTaskDetail();openTaskModal(\'' + t.id + '\')" title="Editar">✏️</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="closeTaskDetail()" style="font-size:16px;padding:4px 8px;">✕</button>' +
    '</div></div>' +
    '<div style="overflow-y:auto;padding:16px 20px;flex:1;">' + subtasksHtml + notesHtml + attachHtml + commentsHtml + emptyHtml + '</div>' +
    '<div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2);">' +
    '<span style="font-size:11px;color:var(--text3);">' + attachCount + commCount + '</span>' +
    '<button class="btn btn-primary btn-sm" onclick="toggleTask(\'' + t.id + '\');closeTaskDetail()">' + (t.done?'↩ Marcar pendiente':'✅ Marcar completada') + '</button>' +
    '</div></div>';

  if (!document.getElementById('task-detail-styles')) {
    const s = document.createElement('style');
    s.id = 'task-detail-styles';
    s.textContent = '.detail-section{margin-bottom:18px;}.detail-section-title{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:Space Mono,monospace;}';
    document.head.appendChild(s);
  }
  modal.style.display = 'flex';
}

function closeTaskDetail() {
  const m = document.getElementById('modal-task-detail');
  if (m) m.style.display = 'none';
}
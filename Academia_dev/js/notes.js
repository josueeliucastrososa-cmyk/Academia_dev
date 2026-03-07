function handleImportFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const result = importData(e.target.result);
    alert(result.msg);
    if (result.ok) {
      fillMatSels(); fillTopicMatSel(); fillPomSel();
      renderOverview(); renderMaterias(); renderGrades(); renderTasks(); renderCalendar(); updateBadge();
    }
  };
  reader.readAsText(file);
  input.value = '';
}

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    const statsPage = document.getElementById('page-estadisticas');
    if (statsPage?.classList.contains('active')) renderStats();
  }, 150);
}, { passive: true });

// Flush any pending debounced saves before page unload
window.addEventListener('beforeunload', () => {
  if (_saveTimer) { clearTimeout(_saveTimer); _flushSave(); }
});

function toggleNavSection(sectionId, headerEl) {
  const sec = document.getElementById(sectionId);
  if (!sec) return;
  const arrowId = sectionId + '-arrow';
  const arrowEl = document.getElementById(arrowId);
  const isOpen  = sec.style.display !== 'none';
  sec.style.display = isOpen ? 'none' : 'block';
  if (arrowEl) arrowEl.textContent = isOpen ? '▸' : '▾';
}

function toggleUsacZone(id) {
  const on  = document.getElementById('uz-' + id + '-on')?.checked;
  const ctrl = document.getElementById('uzc-' + id);
  if (ctrl) ctrl.style.display = on ? 'flex' : 'none';
  updateUsacSuma();
}
function updateUsacSuma() {
  const get = id => parseFloat(document.getElementById('uz-'+id+'-pts')?.value) || 0;
  const on  = id => document.getElementById('uz-'+id+'-on')?.checked;
  let suma = 0;
  ['lab','tar','par','fin','extra'].forEach(z => { if (on(z)) suma += get(z); });
  const el   = document.getElementById('usac-suma-val');
  const hint = document.getElementById('usac-suma-hint');
  if (el) { el.textContent = suma; el.style.color = suma === 100 ? '#4ade80' : '#f87171'; }
  if (hint) hint.textContent = suma === 100 ? '✓ Perfecto' : suma < 100 ? `Faltan ${100-suma} pts` : `Sobran ${suma-100} pts`;
}
function applyUsacZones() {
  const on  = id => document.getElementById('uz-'+id+'-on')?.checked;
  const get = id => parseFloat(document.getElementById('uz-'+id+'-pts')?.value) || 0;
  const getN= id => Math.max(1, parseInt(document.getElementById('uz-'+id+'-n')?.value) || 1);
  const suma = ['lab','tar','par','fin','extra'].reduce((a,z) => a + (on(z) ? get(z) : 0), 0);
  if (suma !== 100) { alert(`La suma debe ser exactamente 100 pts (actualmente ${suma}). Ajusta los valores.`); return; }

  document.getElementById('zones-builder').innerHTML = '';
  zoneRowCount = 0;

  if (on('par')) {
    const pts = get('par'), n = getN('par');
    const sub = Array.from({length:n}, (_,i) => ({ label:`${i+1}er Parcial`, pts: parseFloat((pts/n).toFixed(2)) }));

    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Exámenes Parciales', null, sub);
  }
  if (on('tar')) {
    const pts = get('tar'), n = getN('tar');
    const sub = Array.from({length:n}, (_,i) => ({ label:`Tarea ${i+1}`, pts: parseFloat((pts/n).toFixed(2)) }));
    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Tareas', null, sub);
  }
  if (on('lab')) {
    const pts = get('lab'), n = getN('lab');
    const sub = Array.from({length:n}, (_,i) => ({ label:`Taller ${i+1}`, pts: parseFloat((pts/n).toFixed(2)) }));
    const rounding = parseFloat((pts - sub.reduce((a,s)=>a+s.pts,0)).toFixed(2));
    if (sub.length > 0) sub[sub.length-1].pts = parseFloat((sub[sub.length-1].pts + rounding).toFixed(2));
    addZoneRow('Taller / Laboratorio', null, sub);
  }
  if (on('fin')) {
    addZoneRow('Examen Final', null, [{ label: 'Final / Retrasada', pts: get('fin') }]);
  }
  if (on('extra')) {
    const name = document.getElementById('uz-extra-name')?.value.trim() || 'Zona Extra';
    addZoneRow(name, null, [{ label: name, pts: get('extra') }]);
  }
}

function updateZonaSuma() { updateUsacSuma(); }
function applyZonaPreset() { applyUsacZones(); }

function renderHorario() {
  const allMats = State.materias.filter(m => (m.dias || m.horario || m.catedratico));
  const container = _el('horario-table-container');
  const detail    = _el('horario-detail-list');
  if (!container || !detail) return;

  const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb'];

  if (!allMats.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">🗓️ Sin horarios definidos. Edita tus materias y agrega Días/Horas.</div>`;
    detail.innerHTML = '';
    return;
  }

  const slotMap = {};
  allMats.forEach(m => {
    if (!m.dias || !m.horario) return;
    const hr = m.horario.trim();
    if (!slotMap[hr]) slotMap[hr] = {};
    m.dias.split(/[,\s]+/).forEach(d => {
      const dk = d.trim().slice(0,3);
      if (!DAYS.includes(dk)) return;
      if (!slotMap[hr][dk]) slotMap[hr][dk] = [];
      slotMap[hr][dk].push(m);
    });
  });

  const noSlot = allMats.filter(m => !m.horario && m.dias);
  if (noSlot.length) {
    if (!slotMap['Sin hora']) slotMap['Sin hora'] = {};
    noSlot.forEach(m => {
      m.dias.split(/[,\s]+/).forEach(d => {
        const dk = d.trim().slice(0,3);
        if (!DAYS.includes(dk)) return;
        if (!slotMap['Sin hora'][dk]) slotMap['Sin hora'][dk] = [];
        slotMap['Sin hora'][dk].push(m);
      });
    });
  }

  const parseSlotTime = (slot) => {
    if (slot === 'Sin hora') return 9999;
    const m = slot.match(/(\d{1,2}):(\d{2})/);
    if (!m) return 9999;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
  };

  const slots = Object.keys(slotMap).sort((a, b) => parseSlotTime(a) - parseSlotTime(b));
  if (!slots.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3);">🗓️ Sin horarios definidos.</div>`;
    detail.innerHTML = '';
    return;
  }

  let html = `<table class="horario-table"><thead><tr>
    <th style="width:100px;font-size:11px;">⏰ Hora</th>`;
  DAYS.forEach(d => html += `<th style="font-size:12px;letter-spacing:.5px;">${d}</th>`);
  html += `</tr></thead><tbody>`;

  slots.forEach(slot => {
    const dayData = slotMap[slot];

    html += `<tr>
      <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--text2);vertical-align:middle;text-align:center;line-height:1.6;background:var(--surface3);">
        ${slot.replace('–','<br><span style="font-size:9px;color:var(--text3);">↓</span><br>').replace('-','<br><span style="font-size:9px;color:var(--text3);">↓</span><br>')}
      </td>`;
    DAYS.forEach(d => {
      const mats = dayData[d] || [];
      if (!mats.length) {
        html += `<td style="background:var(--surface);"></td>`;
      } else if (mats.length === 1) {
        const m = mats[0];
        html += `<td><div class="horario-cell" style="border-left-color:${m.color};background:${m.color}18;">
          <div style="font-size:10px;font-weight:800;color:${m.color};">${m.icon||'📚'} ${m.name}</div>
          ${m.catedratico ? `<div style="font-size:9px;color:var(--text3);">👤 ${m.catedratico}</div>` : ''}
          ${m.seccion ? `<div style="font-size:9px;color:var(--text3);">Sec. ${m.seccion}</div>` : ''}
        </div></td>`;
      } else {

        html += `<td><div style="display:flex;gap:4px;">`;
        mats.forEach(m => {
          html += `<div class="horario-cell" style="flex:1;min-width:0;border-left-color:${m.color};background:${m.color}18;">
            <div style="font-size:9px;font-weight:800;color:${m.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.icon||'📚'} ${m.name}</div>
            ${m.catedratico ? `<div style="font-size:8px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ${m.catedratico}</div>` : ''}
            <div style="font-size:8px;color:var(--yellow);font-family:'Space Mono',monospace;">⚠ TRASLAPE</div>
          </div>`;
        });
        html += `</div></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  const rootsDetail = allMats.filter(m => !m.parentId);
  detail.innerHTML = rootsDetail.length
    ? rootsDetail.map(m => `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="width:14px;height:14px;border-radius:50%;background:${m.color};margin-top:3px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;">${m.icon||'📚'} ${m.name} <span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">${m.code}</span></div>
          ${m.catedratico ? `<div style="font-size:12px;color:var(--text2);">👤 ${m.catedratico}</div>` : ''}
          ${m.seccion ? `<div style="font-size:11px;color:var(--text3);">Sección: ${m.seccion}</div>` : ''}
          ${m.dias ? `<div style="font-size:11px;color:var(--text3);">📅 ${m.dias}</div>` : ''}
          ${m.horario ? `<div style="font-size:11px;color:var(--text3);">🕐 ${m.horario}</div>` : ''}
        </div>
      </div>`).join('')
    : '<div style="color:var(--text3);padding:20px;text-align:center;">Sin materias con horario definido</div>';
}

function exportHorario() {
  const container = document.getElementById('horario-table-container');
  if (!container || !container.innerHTML.trim()) { alert('Sin horario para exportar.'); return; }
  const win = window.open('','_blank','width=900,height=700');
  const semName = document.querySelector('.sem-val')?.textContent || 'Mi Horario';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Horario</title>
  <style>body{font-family:sans-serif;background:#0a0a0f;color:#e8e8f0;padding:20px;}h2{color:#a892ff;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;}th{background:#18181f;border:1px solid #2a2a38;padding:10px 12px;font-size:11px;color:#9090a8;text-align:center;}
  td{border:1px solid #2a2a38;padding:8px;font-size:11px;min-width:100px;vertical-align:top;background:#111118;}
  .horario-cell{border-radius:7px;padding:6px 8px;font-size:11px;font-weight:700;border-left:3px solid #7c6aff;background:rgba(124,106,255,.12);}
  @media print{body{background:#fff;color:#000;}}</style></head>
  <body><h2>🗓️ ${semName}</h2>${container.innerHTML}
  <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  win.document.close();
}

function renderNotesPage() {
  renderNotesProPage();
}

let _examInterval = null, _examRunning = false, _examSecs = 90*60;

function openExamMode() {
  fillExamSel();
  examReset();
  updateExamSubjectLabel();
  document.getElementById('exam-overlay').classList.add('active');
}
function closeExamMode() {
  examStop();
  document.getElementById('exam-overlay').classList.remove('active');
}
function examReset() {
  examStop();
  const min = parseInt(document.getElementById('exam-min-input')?.value) || 90;
  _examSecs = min * 60;
  updateExamDisplay();
  const btn = document.getElementById('exam-toggle-btn');
  if (btn) btn.textContent = '▶ Iniciar';
}
function examStop() {
  if (_examInterval) { clearInterval(_examInterval); _examInterval = null; }
  _examRunning = false;
}
function examToggle() {
  const btn = document.getElementById('exam-toggle-btn');
  if (_examRunning) {
    examStop();
    if (btn) btn.textContent = '▶ Reanudar';
  } else {
    _examRunning = true;
    if (btn) btn.textContent = '⏸ Pausar';
    initAudioContext();
    _examInterval = setInterval(() => {
      _examSecs--;
      updateExamDisplay();
      if (_examSecs <= 0) {
        examStop();
        pomPlayAlarm(false);
        if (btn) btn.textContent = '⏰ Tiempo!';
      }
    }, 1000);
  }
}
function updateExamDisplay() {
  const m = Math.floor(_examSecs / 60), s = _examSecs % 60;
  const el = _el('exam-countdown');
  if (el) {
    el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.style.color = _examSecs < 300 ? '#f87171' : _examSecs < 900 ? '#fbbf24' : 'var(--accent2)';
  }
}
function updateExamSubjectLabel() {
  const matId = document.getElementById('exam-mat-sel')?.value || '';
  const mat   = matId ? State.materias.find(m => m.id === matId) : null;
  const lbl   = document.getElementById('exam-subject-label');
  if (lbl) lbl.textContent = mat ? `${mat.icon||'📝'} ${mat.name}` : '— Sin materia seleccionada —';

  const notesEl = document.getElementById('exam-notes-display');
  if (notesEl) {

    let notesText = '';
    if (matId) {
      const notesArr = State._activeSem.notesArray || [];
      const matNotes = notesArr.filter(n => n.matId === matId);
      if (matNotes.length) {
        notesText = matNotes.map(n => `## ${n.title}\n${n.content}`).join('\n\n---\n\n');
      } else {
        notesText = State.notes[matId] || 'Sin notas para esta materia.';
      }
    }
    notesEl.textContent = notesText;
  }
}

// ══════════════════════════════════════════════════════════════
// NOTES V2 — Folders + Canvas + Big Images + Bug fixes
// ══════════════════════════════════════════════════════════════

function _getNotesArray() {
  const sem = State._activeSem;
  if (!sem.notesArray) sem.notesArray = [];
  return sem.notesArray;
}
function _getFoldersArray() {
  const sem = State._activeSem;
  if (!sem.notesFolders) sem.notesFolders = [];
  return sem.notesFolders;
}

let _currentNoteId   = null;
let _currentFolderId = null; // null = "Todas"
let _noteAutoSaveTimer = null;

// ── RENDER FULL PAGE ──────────────────────────────────────────
function renderNotesProPage() {
  _populateEditorSelects();
  renderFoldersList();
  renderNotesList();
  // BUG FIX: always re-load the current note into the editor
  if (_currentNoteId) {
    const stillExists = _getNotesArray().find(n => n.id === _currentNoteId);
    if (stillExists) _loadNoteInProEditor(_currentNoteId);
    else { _currentNoteId = null; _showNotesEmptyState(); }
  }
}

function _populateEditorSelects() {
  // folder selector in editor
  const fSel = document.getElementById('notes-folder-sel-editor');
  if (fSel) {
    const prev = fSel.value;
    fSel.innerHTML = '<option value="">— Sin carpeta —</option>';
    _getFoldersArray().forEach(f => {
      const o = document.createElement('option');
      o.value = f.id; o.textContent = `${f.icon||'📁'} ${f.name}`;
      fSel.appendChild(o);
    });
    // auto-folders for subjects
    State.materias.filter(m => !m.parentId).forEach(m => {
      const o = document.createElement('option');
      o.value = 'mat_' + m.id;
      o.textContent = `${m.icon||'📚'} ${m.name} (materia)`;
      fSel.appendChild(o);
    });
    if (prev) fSel.value = prev;
  }
  // subject selector in editor
  const mSel = document.getElementById('notes-mat-sel-editor');
  if (mSel) {
    const prev = mSel.value;
    mSel.innerHTML = '<option value="">— Sin materia —</option>';
    State.materias.filter(m => !m.parentId).forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = `${m.icon||'📚'} ${m.name}`;
      mSel.appendChild(o);
    });
    if (prev) mSel.value = prev;
  }
}

// ── FOLDERS ───────────────────────────────────────────────────
function renderFoldersList() {
  const container = document.getElementById('notes-folders-list');
  if (!container) return;
  const folders = _getFoldersArray();
  const notes   = _getNotesArray();

  // Count per folder (including notes in subfolders)
  const countAll = notes.length;
  const countFolder = fid => notes.filter(n => n.folderId === fid).length;

  let html = `<div class="notes-folder-item ${_currentFolderId===null?'active':''}" onclick="selectFolder(null)">
    <span class="notes-folder-icon">📋</span>
    <span class="notes-folder-name">Todas las notas</span>
    <span class="notes-folder-count">${countAll}</span>
  </div>`;

  // Render folders recursively
  const renderFolderTree = (parentId, depth) => {
    const indent = depth * 14;
    // Normalize: treat undefined and null as null
    folders.filter(f => (f.parentId == null ? null : f.parentId) === parentId).forEach(f => {
      const cnt = countFolder(f.id);
      html += `<div class="notes-folder-item ${_currentFolderId===f.id?'active':''}" onclick="selectFolder('${f.id}')" style="padding-left:${10+indent}px;position:relative;">
        <span class="notes-folder-icon" style="color:${f.color||'var(--accent)'};">${depth>0?'↳ ':''}${f.icon||'📁'}</span>
        <span class="notes-folder-name">${f.name}</span>
        <span class="notes-folder-count">${cnt}</span>
        <div style="display:flex;gap:2px;opacity:0;position:absolute;right:4px;top:50%;transform:translateY(-50%);" class="folder-action-btns">
          <button onclick="event.stopPropagation();openNewFolderModal(null,'${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Subcarpeta">+</button>
          <button onclick="event.stopPropagation();openNewFolderModal('${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Editar">✎</button>
          <button onclick="event.stopPropagation();deleteFolder('${f.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px;padding:2px 4px;" title="Eliminar">✕</button>
        </div>
      </div>`;
      // Render children
      renderFolderTree(f.id, depth + 1);
    });
  };

  renderFolderTree(null, 0);

  // Subject auto-folders (always shown)
  if (State.materias.filter(m => !m.parentId).length > 0) {
    html += `<div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);padding:8px 10px 3px;letter-spacing:1px;text-transform:uppercase;">Materias</div>`;
    State.materias.filter(m => !m.parentId).forEach(m => {
      const cnt = notes.filter(n => n.matId === m.id || n.folderId === 'mat_' + m.id).length;
      const fid = 'mat_' + m.id;
      html += `<div class="notes-folder-item ${_currentFolderId===fid?'active':''}" onclick="selectFolder('${fid}')">
        <span class="notes-folder-icon" style="color:${m.color||'var(--accent)'};">${m.icon||'📚'}</span>
        <span class="notes-folder-name">${m.name}</span>
        <span class="notes-folder-count">${cnt}</span>
      </div>`;
    });
  }

  container.innerHTML = html;

  // Show action btns on hover
  container.querySelectorAll('.notes-folder-item').forEach(el => {
    el.addEventListener('mouseenter', () => { const b = el.querySelector('.folder-action-btns'); if (b) b.style.opacity='1'; });
    el.addEventListener('mouseleave', () => { const b = el.querySelector('.folder-action-btns'); if (b) b.style.opacity='0'; });
  });
}

function selectFolder(folderId) {
  if (_currentNoteId) _autoCommitNote();
  _currentFolderId = folderId;
  renderFoldersList();
  renderNotesList();
  // Update label
  const lbl = document.getElementById('notes-folder-label');
  if (lbl) {
    if (folderId === null) { lbl.textContent = 'TODAS LAS NOTAS'; return; }
    if (String(folderId).startsWith('mat_')) {
      const matId = folderId.replace('mat_','');
      const mat = State.materias.find(m => m.id === matId);
      lbl.textContent = mat ? (mat.name.toUpperCase()) : folderId;
    } else {
      const f = _getFoldersArray().find(f => f.id === folderId);
      lbl.textContent = f ? f.name.toUpperCase() : folderId;
    }
  }
}

// ── FOLDER MODALS ─────────────────────────────────────────────
let _editingFolderId = null;
let _selectedFolderIcon  = '📁';
let _selectedFolderColor = '#6366f1';

let _newFolderParentId = null;

function openNewFolderModal(folderId, parentId) {
  _editingFolderId = folderId || null;
  _newFolderParentId = parentId || null;
  _selectedFolderIcon  = '📁';
  _selectedFolderColor = '#6366f1';
  document.getElementById('new-folder-name').value = '';
  document.getElementById('new-folder-modal-title').textContent = folderId ? '✏️ Editar Carpeta' : (_newFolderParentId ? '📁 Nueva Subcarpeta' : '📁 Nueva Carpeta');
  document.getElementById('save-folder-btn').textContent = folderId ? 'Guardar' : 'Crear carpeta';
  if (folderId) {
    const f = _getFoldersArray().find(x => x.id === folderId);
    if (f) {
      document.getElementById('new-folder-name').value = f.name;
      _selectedFolderIcon  = f.icon  || '📁';
      _selectedFolderColor = f.color || '#6366f1';
      _newFolderParentId = f.parentId || null;
    }
  }
  // reset pickers visual
  document.querySelectorAll('.folder-icon-opt').forEach(el => {
    el.style.borderColor = el.dataset.icon === _selectedFolderIcon ? 'var(--accent)' : 'transparent';
  });
  document.querySelectorAll('.folder-color-opt').forEach(el => {
    el.style.borderColor = el.dataset.fc === _selectedFolderColor ? 'var(--text)' : 'transparent';
  });
  document.getElementById('modal-new-folder').classList.add('open');
  setTimeout(() => document.getElementById('new-folder-name').focus(), 120);
}

function selectFolderIcon(el) {
  _selectedFolderIcon = el.dataset.icon;
  document.querySelectorAll('.folder-icon-opt').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--accent)';
}
function selectFolderColor(el) {
  _selectedFolderColor = el.dataset.fc;
  document.querySelectorAll('.folder-color-opt').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--text)';
}

function saveNewFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) { document.getElementById('new-folder-name').focus(); return; }
  const folders = _getFoldersArray();
  if (_editingFolderId) {
    const f = folders.find(x => x.id === _editingFolderId);
    if (f) { f.name = name; f.icon = _selectedFolderIcon; f.color = _selectedFolderColor; }
  } else {
    folders.push({ id: 'folder_' + Date.now(), name, icon: _selectedFolderIcon, color: _selectedFolderColor, parentId: _newFolderParentId || null });
  }
  saveState(['all']);
  closeModal('modal-new-folder');
  renderFoldersList();
}

function deleteFolder(folderId) {
  if (!confirm('¿Eliminar esta carpeta? Las notas no se borran.')) return;
  const sem = State._activeSem;
  sem.notesFolders = (sem.notesFolders||[]).filter(f => f.id !== folderId);
  // unlink notes
  _getNotesArray().forEach(n => { if (n.folderId === folderId) n.folderId = ''; });
  if (_currentFolderId === folderId) _currentFolderId = null;
  saveState(['all']);
  renderFoldersList();
  renderNotesList();
}

// ── NOTES LIST ────────────────────────────────────────────────
function renderNotesList() {
  const container = document.getElementById('notes-list-items');
  if (!container) return;

  let notes = _getNotesArray();

  // Filter by selected folder
  if (_currentFolderId !== null) {
    if (String(_currentFolderId).startsWith('mat_')) {
      const matId = _currentFolderId.replace('mat_','');
      notes = notes.filter(n => n.matId === matId || n.folderId === _currentFolderId);
    } else {
      notes = notes.filter(n => n.folderId === _currentFolderId);
    }
  }

  // Update label count
  const lbl = document.getElementById('notes-folder-label');
  if (lbl && _currentFolderId === null) lbl.textContent = `TODAS (${notes.length})`;

  if (!notes.length) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:8px;">📝</div>
      <div style="font-size:12px;">Sin notas en esta carpeta</div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="openNewNoteMenu()">+ Nueva nota</button>
    </div>`;
    return;
  }

  const sorted = [...notes].sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
  container.innerHTML = sorted.map(note => {
    const mat = note.matId ? State.materias.find(m => m.id === note.matId) : null;
    const preview = (note.content || '').replace(/\n/g,' ').slice(0,50) || (note.type==='draw' ? '🎨 Dibujo' : 'Sin contenido');
    const dateStr = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '';
    const isActive = note.id === _currentNoteId;
    const typeBadge = note.type === 'draw'
      ? `<span class="nli-type-badge nlt-draw">🎨 dibujo</span>`
      : `<span class="nli-type-badge nlt-text">📄 texto</span>`;
    const imgBadge = (note.images && Object.keys(note.images).length)
      ? `<span style="font-size:9px;color:var(--text3);">🖼 ${Object.keys(note.images).length}</span>` : '';
    return `<div class="notes-list-item ${isActive?'active':''}" onclick="selectProNote('${note.id}')">
      <div class="nli-title">${note.title || 'Sin título'}</div>
      <div class="nli-preview">${preview}</div>
      <div class="nli-meta">
        ${typeBadge}
        ${mat ? `<span style="background:${mat.color}22;color:${mat.color};padding:1px 5px;border-radius:3px;font-weight:700;font-size:9px;">${mat.icon||''} ${mat.name}</span>` : ''}
        ${imgBadge}
        <span style="margin-left:auto;">${dateStr}</span>
      </div>
    </div>`;
  }).join('');
}

// ── SELECT / LOAD NOTE — THE BUG FIX ─────────────────────────
function selectProNote(id) {
  if (_currentNoteId && _currentNoteId !== id) _autoCommitNote();
  clearTimeout(_noteAutoSaveTimer); // cancelar autosave pendiente de la nota anterior
  _currentNoteId = id;
  // Re-render list first (marks active)
  renderNotesList();
  // THEN load editor — this was the bug: editor wasn't being called after list re-render
  _loadNoteInProEditor(id);
}

function _loadNoteInProEditor(noteId) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note) { _showNotesEmptyState(); return; }

  const emptyState  = document.getElementById('notes-empty-state');
  const titleWrap   = document.getElementById('notes-title-wrap');
  const ta          = _el('notes-main-ta');
  const wc          = document.getElementById('notes-wordcount');
  const toolbar     = document.getElementById('notes-toolbar');
  const drawArea    = document.getElementById('notes-drawing-area');
  const imgStrip    = document.getElementById('notes-images-strip');

  // Always hide empty state
  if (emptyState) emptyState.style.display = 'none';

  if (note.type === 'draw') {
    // ── Drawing note ──
    if (titleWrap) titleWrap.style.display = 'none';
    if (ta)        ta.style.display = 'none';
    if (wc)        wc.style.display = 'none';
    if (imgStrip)  imgStrip.style.display = 'none';
    const rteD = document.getElementById('notes-rte');
    const rteTD = document.getElementById('notes-rte-toolbar');
    if (rteD) rteD.style.display = 'none';
    if (rteTD) rteTD.classList.remove('visible');
    if (drawArea) {
      drawArea.style.display = 'flex';
      const titleLbl = drawArea.querySelector('#canvas-toolbar-inline span');
      if (titleLbl) titleLbl.textContent = note.title || 'Dibujo sin título';
      const prev = document.getElementById('notes-drawing-preview');
      if (prev) prev.src = note.canvasData || '';
    }
    if (toolbar) {
      toolbar.innerHTML = `<span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);">🎨 NOTA DE DIBUJO</span>
        <span id="notes-autosave-indicator" style="font-size:11px;color:var(--text3);">—</span>`;
    }
  } else {
    // ── Text note ──
    if (drawArea) drawArea.style.display = 'none';
    if (titleWrap) { titleWrap.style.display = 'block'; }
    // Hide old textarea, show rich text editor
    if (ta) ta.style.display = 'none';
    const rte = document.getElementById('notes-rte');
    const rteToolbar = document.getElementById('notes-rte-toolbar');
    if (rte) {
      rte.style.display = 'block';
      const stored = note.content || '';
      if (stored && (stored.startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(stored))) {
        rte.innerHTML = stored;
      } else {
        rte.innerHTML = _plaintextToRteHtml(stored);
      }
      if (!rte._pasteHandlerAttached) {
        rte.addEventListener('paste', _handleRtePaste);
        rte._pasteHandlerAttached = true;
      }
    }
    if (rteToolbar) rteToolbar.classList.add('visible');
    if (wc) { wc.style.display = 'block'; _updateWordCount(note.content || ''); }

    if (toolbar) {
      toolbar.innerHTML = `<span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);">⏱️ AUTO-GUARDADO</span>
        <span id="notes-autosave-indicator" style="font-size:11px;color:var(--text3);">—</span>`;
    }

    // Render images strip
    _renderImagesStrip(note);
  }

  // Fill title input
  const titleInp = _el('notes-title-inp');
  if (titleInp) titleInp.value = note.title || '';

  // Fill folder + mat selectors
  const fSel = document.getElementById('notes-folder-sel-editor');
  if (fSel) fSel.value = note.folderId || '';
  const mSel = document.getElementById('notes-mat-sel-editor');
  if (mSel) mSel.value = note.matId || '';

  // Timestamp
  const ts = document.getElementById('notes-timestamp');
  if (ts && note.updatedAt) ts.textContent = 'Editado: ' + new Date(note.updatedAt).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

  // Populate tags field
  const tagsInp = document.getElementById('notes-tags-inp');
  if (tagsInp) tagsInp.value = (note.tags||[]).join(', ');
  const tagsDsp = document.getElementById('notes-tags-display');
  if (tagsDsp) tagsDsp.innerHTML = (note.tags||[]).map(t=>`<span class="tag-chip active">#${t}</span>`).join('');

  // Render PDF attachments strip
  _renderPDFStrip(note);
}

function _showNotesEmptyState() {
  const emptyState = document.getElementById('notes-empty-state');
  const titleWrap  = document.getElementById('notes-title-wrap');
  const ta         = _el('notes-main-ta');
  const wc         = document.getElementById('notes-wordcount');
  const drawArea   = document.getElementById('notes-drawing-area');
  const imgStrip   = document.getElementById('notes-images-strip');
  const toolbar    = document.getElementById('notes-toolbar');
  const rte        = document.getElementById('notes-rte');
  const rteToolbar = document.getElementById('notes-rte-toolbar');
  if (emptyState) emptyState.style.display = 'flex';
  if (titleWrap) titleWrap.style.display = 'none';
  if (ta) ta.style.display = 'none';
  if (rte) rte.style.display = 'none';
  if (rteToolbar) rteToolbar.classList.remove('visible');
  if (wc) wc.style.display = 'none';
  if (drawArea) drawArea.style.display = 'none';
  if (imgStrip) imgStrip.style.display = 'none';
  if (toolbar) toolbar.innerHTML = '<span style="font-size:11px;color:var(--text3);font-family:\'Space Mono\',monospace;">Selecciona o crea una nota</span>';
}

// ── IMAGES STRIP ──────────────────────────────────────────────
/* ── Adjuntar imágenes desde el botón de la barra ── */
function attachImagesToNote(files) {
  if (!files || !files.length) return;
  if (!_currentNoteId) { alert('Selecciona o crea una nota primero.'); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  if (!note.images) note.images = {};

  let loaded = 0;
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const key = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
      note.images[key] = ev.target.result;   // base64 data URL
      note.updatedAt = Date.now();
      loaded++;
      if (loaded === files.length) {
        saveState(['all']);
        _renderImagesStrip(note);
      }
    };
    reader.readAsDataURL(file);
  });
}

function _renderImagesStrip(note) {
  const strip = document.getElementById('notes-images-strip');
  if (!strip) return;
  const imgs = note.images || {};
  const keys = Object.keys(imgs);
  if (!keys.length) { strip.style.display = 'none'; return; }
  strip.style.display = 'flex';
  const noteId = note.id;
  strip.innerHTML = keys.map(k => `
    <div class="notes-img-thumb" id="thumb-${k}" onclick="openLightbox('${noteId}','${k}')">
      <img src="" alt="img" id="img-${k}" style="max-height:160px;max-width:240px;object-fit:cover;">
      <button class="nit-del" onclick="event.stopPropagation();deleteNoteImage('${noteId}','${k}')">✕</button>
    </div>`).join('');
  // Load images — from IDB if referenced, else direct
  keys.forEach(async k => {
    const val = imgs[k];
    const imgEl = document.getElementById('img-' + k);
    if (!imgEl) return;
    if (val && val.startsWith('IDB:')) {
      const idbKey = val.slice(4);
      const data = await idbGetImage(idbKey);
      if (data) imgEl.src = data;
    } else if (val) {
      imgEl.src = val;
    }
  });
}

function openLightbox(noteId, imgKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note || !note.images || !note.images[imgKey]) return;
  const lb = document.getElementById('notes-lightbox');
  const img = document.getElementById('notes-lightbox-img');
  if (!lb || !img) return;
  const val = note.images[imgKey];
  const _show = (src) => { img.src = src; lb.classList.add('open'); document.body.style.overflow = 'hidden'; };
  if (val && val.startsWith('IDB:')) {
    idbGetImage(val.slice(4)).then(data => { if (data) _show(data); });
  } else {
    _show(val);
  }
}
function closeLightbox() {
  const lb = document.getElementById('notes-lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}
function deleteNoteImage(noteId, imgKey) {
  const note = _getNotesArray().find(n => n.id === noteId);
  if (!note || !note.images) return;
  const val = note.images[imgKey];
  if (val && val.startsWith('IDB:')) idbDeleteImage(val.slice(4));
  delete note.images[imgKey];
  saveState(['all']);
  _renderImagesStrip(note);
}

// ── ADD NOTES ─────────────────────────────────────────────────
function openNewNoteMenu() { addNewNote(); }

function addNewNote() {
  if (_currentNoteId) _autoCommitNote();
  // Clear any pending autosave to prevent it overwriting the new note
  clearTimeout(_noteAutoSaveTimer);
  const noteId = 'note_' + Date.now();
  const newNote = {
    id: noteId, type: 'text',
    folderId: _currentFolderId && !String(_currentFolderId).startsWith('mat_') ? _currentFolderId : '',
    matId: String(_currentFolderId||'').startsWith('mat_') ? _currentFolderId.replace('mat_','') : (State.materias.find(m => !m.parentId)?.id || ''),
    title: '', content: '', images: {}, updatedAt: Date.now()
  };
  _getNotesArray().push(newNote);
  saveState(['all']);
  _currentNoteId = noteId;
  renderFoldersList();
  renderNotesList();
  _loadNoteInProEditor(noteId);
  setTimeout(() => { const t = _el('notes-title-inp'); if (t) t.focus(); }, 80);
}

function addNewDrawingNote() {
  if (_currentNoteId) _autoCommitNote();
  clearTimeout(_noteAutoSaveTimer);
  const noteId = 'note_' + Date.now();
  const newNote = {
    id: noteId, type: 'draw',
    folderId: _currentFolderId && !String(_currentFolderId).startsWith('mat_') ? _currentFolderId : '',
    matId: '', title: 'Dibujo ' + new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'short'}),
    canvasData: '', updatedAt: Date.now()
  };
  _getNotesArray().push(newNote);
  saveState(['all']);
  _currentNoteId = noteId;
  renderFoldersList();
  renderNotesList();
  _loadNoteInProEditor(noteId);
  // auto-open canvas
  setTimeout(() => openCanvasForNote(), 120);
}

function deleteCurrentNote() {
  if (!_currentNoteId) return;
  if (!confirm('¿Eliminar esta nota?')) return;
  // Cancelar cualquier timer pendiente ANTES de nulificar el ID
  clearTimeout(_noteAutoSaveTimer);
  _noteAutoSaveTimer = null;
  const idToDelete = _currentNoteId;
  _currentNoteId = null; // nullificar primero para que _autoCommitNote no resurja la nota
  const sem = State._activeSem;
  if (sem.notesArray) sem.notesArray = sem.notesArray.filter(n => n.id !== idToDelete);
  saveState(['all']);
  renderFoldersList();
  renderNotesList();
  _showNotesEmptyState();
}

// ── INPUT HANDLERS ────────────────────────────────────────────
function onNotesTitleInput() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.title = _el('notes-title-inp')?.value || '';
  _scheduleAutoSave();
}
function onNoteFolderChange() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.folderId = document.getElementById('notes-folder-sel-editor')?.value || '';
  _scheduleAutoSave();
}
function onNoteMatChange() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.matId = document.getElementById('notes-mat-sel-editor')?.value || '';
  _scheduleAutoSave();
}
function onNotesInput() {
  if (!_currentNoteId) return;
  const rte = document.getElementById('notes-rte');
  _updateWordCount(rte ? (rte.textContent || '') : (_el('notes-main-ta')?.value || ''));
  _scheduleAutoSave();
}

// ── PASTE IMAGES — stores in IndexedDB, shows in strip ────────
function _handleNotesPaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        const base64 = ev.target.result;
        const note   = _getNotesArray().find(n => n.id === _currentNoteId);
        if (!note) return;
        if (!note.images) note.images = {};
        const key = 'IMG_' + Date.now();
        // Store actual image data in IndexedDB, keep only a placeholder in localStorage state
        await idbSetImage(key, base64);
        note.images[key] = 'IDB:' + key; // placeholder reference
        saveState(['all']);
        _renderImagesStrip(note);
        onNotesInput();
      };
      reader.readAsDataURL(file);
      return;
    }
  }
}

// ── AUTO-SAVE ─────────────────────────────────────────────────
function _scheduleAutoSave() {
  const ind = _el('notes-autosave-indicator');
  if (ind) ind.textContent = '✏️ editando...';
  clearTimeout(_noteAutoSaveTimer);
  _noteAutoSaveTimer = setTimeout(() => {
    _autoCommitNote();
    const ind2 = _el('notes-autosave-indicator');
    if (ind2) ind2.textContent = '✅ guardado';
    renderNotesList();
  }, 2000);
}

// ── PDF / IMAGE SCANNER ───────────────────────────────────────
let _scanCancelled = false;

function cancelScan() {
  _scanCancelled = true;
  closeModal('modal-scanner');
}

function _scanSetStatus(msg, pct) {
  const bar = document.getElementById('scanner-progress-bar');
  const st  = document.getElementById('scanner-status');
  if (bar) bar.style.width = pct + '%';
  if (st)  st.textContent  = msg;
}

async function scanDocumentFiles(files) {
  if (!files || !files.length) return;
  if (!_currentNoteId) { alert('Selecciona una nota primero.'); return; }

  _scanCancelled = false;
  openModal('modal-scanner');

  let allText = '';

  for (let fi = 0; fi < files.length; fi++) {
    if (_scanCancelled) break;
    const file = files[fi];
    const fileLabel = file.name || 'archivo';
    document.getElementById('scanner-file-name').textContent = `Archivo ${fi+1}/${files.length}: ${fileLabel}`;

    try {
      if (file.type === 'application/pdf') {
        allText += await _scanPDF(file, fi, files.length);
      } else if (file.type.startsWith('image/')) {
        allText += await _scanImage(file, fi, files.length);
      }
    } catch(e) {
      allText += `\n[Error procesando ${fileLabel}: ${e.message}]\n`;
    }
  }

  if (_scanCancelled) return;
  closeModal('modal-scanner');

  if (!allText.trim()) { alert('No se pudo extraer texto del documento.'); return; }

  // Insert scanned text into current note
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const rte = document.getElementById('notes-rte');
  const scannedHtml = '<hr style="border-color:var(--accent);opacity:.4;"><p><strong>📄 Texto escaneado</strong></p><p>' + allText.trim().replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>') + '</p>';
  if (rte && rte.style.display !== 'none') {
    rte.innerHTML = (rte.innerHTML || '') + scannedHtml;
    note.content = rte.innerHTML;
  } else {
    note.content = (note.content || '') + '\n\n--- 📄 Texto escaneado ---\n\n' + allText.trim();
  }
  note.updatedAt = Date.now();
  saveState(['all']);
  renderNotesList();
  _updateWordCount(rte ? rte.textContent : (note.content || ''));
  alert(`✅ Texto extraído (${allText.trim().split(/\s+/).length} palabras)`);
}

async function _scanPDF(file, fi, total) {
  // Try PDF.js first (works on digital PDFs with selectable text)
  if (typeof pdfjsLib !== 'undefined') {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        if (_scanCancelled) return text;
        _scanSetStatus(`Extrayendo texto — página ${p}/${pdf.numPages}`, Math.round((p/pdf.numPages)*60));
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join(' ') + '\n';
      }
      if (text.trim().length > 50) return text; // Has real text, done
      // Fallback: PDF is scanned — render pages as images then OCR
      _scanSetStatus('PDF escaneado detectado, iniciando OCR...', 62);
      return await _ocrPDFPages(pdf);
    } catch(e) { console.warn('PDF.js error:', e); }
  }
  // Fallback to OCR directly
  return await _scanImage(file, fi, total);
}

async function _ocrPDFPages(pdf) {
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    if (_scanCancelled) return text;
    _scanSetStatus(`OCR página ${p}/${pdf.numPages}...`, 62 + Math.round((p/pdf.numPages)*35));
    const page = await pdf.getPage(p);
    const vp   = page.getViewport({ scale: 2 });
    const cvs  = document.createElement('canvas');
    cvs.width  = vp.width; cvs.height = vp.height;
    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
    const pageText = await _tesseractCanvas(cvs);
    text += `\n[Página ${p}]\n` + pageText;
  }
  return text;
}

async function _scanImage(file, fi, total) {
  _scanSetStatus('Iniciando reconocimiento óptico (OCR)...', 10);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
      cvs.getContext('2d').drawImage(img, 0, 0);
      try {
        const text = await _tesseractCanvas(cvs);
        resolve(text);
      } catch(e) { reject(e); }
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Error cargando imagen'));
    img.src = URL.createObjectURL(file);
  });
}

async function _tesseractCanvas(cvs) {
  if (typeof Tesseract === 'undefined') throw new Error('Tesseract no disponible');
  const worker = await Tesseract.createWorker('spa+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        _scanSetStatus(`OCR: ${Math.round(m.progress*100)}%...`, 10 + Math.round(m.progress*85));
      }
    }
  });
  const { data: { text } } = await worker.recognize(cvs);
  await worker.terminate();
  return text;
}
// ── END PDF SCANNER ───────────────────────────────────────────

function _autoCommitNote() {
  if (!_currentNoteId) return; // nota ya eliminada
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return; // nota no encontrada — fue borrada, no guardar
  const titleInp = _el('notes-title-inp');
  const rte = document.getElementById('notes-rte');
  if (titleInp) note.title = titleInp.value;
  if (rte && note.type !== 'draw' && rte.style.display !== 'none') {
    note.content = rte.innerHTML;
  }
  note.updatedAt = Date.now();
  saveState(['all']);
}

function saveCurrentNote() {
  if (!_currentNoteId) return;
  _autoCommitNote();
  const ind = _el('notes-autosave-indicator');
  if (ind) { ind.textContent = '✅ Guardado!'; setTimeout(()=>{ ind.textContent='—'; },2000); }
  renderNotesList();
}

function _updateWordCount(text) {
  const wc = document.getElementById('notes-wordcount');
  if (!wc) return;
  const clean = text.replace(/\[🖼️ IMG_\d+\]/g,'').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  wc.textContent = `${words} palabras · ${text.length} caracteres`;
}

// ══════════════════════════════════════════════════════════════
// CANVAS DRAWING SYSTEM — Full Screen + Image Paste + Shape AI
// ══════════════════════════════════════════════════════════════
let _canvas = null, _ctx = null;
let _drawing = false, _canvasColor = '#e2e8f0', _canvasSize = 2, _canvasEraser = false;
let _undoStack = [];
let _currentTool = 'pen'; // 'pen', 'line', 'rect', 'circle', 'eraser', 'ai', 'text', 'move'
let _shapeStart = null;
let _shapePreviewData = null;

/* ── Capa de imágenes movibles ── */
let _canvasImageObjects = [];   // [{id, img, x, y, w, h}]
let _dragImg     = null;        // objeto que se está arrastrando
let _dragOffX    = 0, _dragOffY = 0;
let _selectedImg = null;        // objeto seleccionado (handle de resize futuro)
let _canvasOverlay = null;      // div transparente sobre el canvas para handles

function _getOrCreateOverlay() {
  if (_canvasOverlay && _canvasOverlay.parentNode) return _canvasOverlay;
  const wrap = _canvas.parentNode;
  _canvasOverlay = document.createElement('div');
  _canvasOverlay.id = 'canvas-img-overlay';
  _canvasOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;';
  wrap.style.position = 'relative';
  wrap.appendChild(_canvasOverlay);
  return _canvasOverlay;
}

function _redrawCanvasImageHandles() {
  const ov = _getOrCreateOverlay();
  ov.innerHTML = '';
  if (_currentTool !== 'move') return;
  _canvasImageObjects.forEach(obj => {
    const r   = _canvas.getBoundingClientRect();
    const scaleX = _canvas.offsetWidth  / _canvas.width;
    const scaleY = _canvas.offsetHeight / _canvas.height;
    // selection border
    const sel = document.createElement('div');
    sel.style.cssText = `
      position:absolute;
      left:${obj.x * scaleX}px; top:${obj.y * scaleY}px;
      width:${obj.w * scaleX}px; height:${obj.h * scaleY}px;
      border:2px dashed var(--accent);
      border-radius:3px;
      box-sizing:border-box;
      pointer-events:none;
    `;
    // delete handle
    const del = document.createElement('button');
    del.textContent = '✕';
    del.style.cssText = `
      position:absolute; top:-11px; right:-11px;
      width:20px; height:20px; border-radius:50%;
      background:var(--red); color:#fff; border:none; cursor:pointer;
      font-size:10px; font-weight:700; line-height:1;
      pointer-events:all; z-index:3;
    `;
    del.onclick = (e) => {
      e.stopPropagation();
      _canvasImageObjects = _canvasImageObjects.filter(o => o.id !== obj.id);
      _flattenImagesToCanvas();
      _redrawCanvasImageHandles();
    };
    sel.appendChild(del);
    ov.appendChild(sel);
  });
}

function _flattenImagesToCanvas() {
  /* Redraw base canvas then stamp all image objects on top */
  if (!_ctx || !_canvas) return;
  /* We don't keep a separate base layer — images are already composited.
     Instead, re-draw from _undoStack base + all image objects. */
  _canvasImageObjects.forEach(obj => {
    _ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
  });
}

function _addImageObjectToCanvas(file, x, y) {
  if (!file || !_canvas || !_ctx) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      /* Save undo snapshot before adding */
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      if (_undoStack.length > 20) _undoStack.shift();

      const maxW = Math.min(img.width, _canvas.width * 0.55);
      const scale = maxW / img.width;
      const w = img.width  * scale;
      const h = img.height * scale;

      const obj = { id: Date.now() + '_' + Math.random().toString(36).slice(2,5), img, x, y, w, h };
      _canvasImageObjects.push(obj);
      _ctx.drawImage(img, x, y, w, h);
      /* Auto-switch to move tool so user can reposition immediately */
      const moveBtn = document.getElementById('tool-move-btn');
      if (moveBtn) setCanvasTool(moveBtn, 'move');
      _redrawCanvasImageHandles();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
} // stored before preview

function expandCurrentNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;

  // Remove any existing overlay
  const old = document.getElementById('note-expand-overlay');
  if (old) old.remove();

  const isCanvas = note.type === 'canvas';
  const overlay  = document.createElement('div');
  overlay.className = 'note-expand-overlay';
  overlay.id = 'note-expand-overlay';

  overlay.innerHTML = `
    <div class="note-expand-toolbar">
      <span class="note-expand-title">${note.title || 'Nota sin título'}</span>
      ${!isCanvas ? `
      <div style="display:flex;gap:3px;align-items:center;">
        <button class="rte-btn" onclick="document.execCommand('bold')" title="Negrita"><b>B</b></button>
        <button class="rte-btn" onclick="document.execCommand('italic')" title="Itálica"><i>I</i></button>
        <button class="rte-btn" onclick="document.execCommand('underline')" title="Subrayado"><u>U</u></button>
        <div class="rte-sep"></div>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h1')" title="H1" style="font-size:10px;font-weight:800;">H1</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h2')" title="H2" style="font-size:10px;font-weight:700;">H2</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'h3')" title="H3" style="font-size:10px;">H3</button>
        <button class="rte-btn" onclick="document.execCommand('formatBlock',false,'p')" title="Párrafo" style="font-size:10px;">P</button>
      </div>
      <span style="font-size:10px;font-family:'Space Mono',monospace;color:var(--text3);" id="exp-wordcount">—</span>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('note-expand-overlay').remove()" title="Cerrar pantalla completa">✕ Cerrar</button>
    </div>
    <div class="note-expand-body" id="exp-body">
      ${isCanvas
        ? `<canvas class="note-expand-canvas" id="exp-canvas"></canvas>`
        : `<div id="exp-rte" contenteditable="true" class="notes-richtext-editor" style="flex:1;height:100%;padding:32px 10%;"></div>`
      }
    </div>
    ${!isCanvas ? `<div class="notes-wordcount" id="exp-bottom" style="padding:6px 10%;"></div>` : ''}
  `;
  document.body.appendChild(overlay);

  if (!isCanvas) {
    const expRte = document.getElementById('exp-rte');
    const wc   = document.getElementById('exp-wordcount');
    const bot  = document.getElementById('exp-bottom');
    const stored = note.content || '';
    expRte.innerHTML = (stored.trim().startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(stored))
      ? stored : _plaintextToRteHtml(stored);
    const sync = () => {
      const mainRte = document.getElementById('notes-rte');
      if (mainRte) { mainRte.innerHTML = expRte.innerHTML; onRteInput(); }
      const words = expRte.textContent.trim() ? expRte.textContent.trim().split(/\s+/).length : 0;
      const chars = expRte.textContent.length;
      const wStr  = `${words} palabras · ${chars} chars`;
      if (wc)  wc.textContent  = wStr;
      if (bot) bot.textContent = wStr;
    };
    expRte.addEventListener('input', sync);
    sync();
    expRte.focus();
  } else {
    // Mirror canvas - just show a static note that canvas is separate
    const body = document.getElementById('exp-body');
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:var(--text3);">
      <div style="font-size:48px;">🎨</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);">${note.title || 'Canvas'}</div>
      <div style="font-size:12px;">El canvas se edita en la ventana principal. Cierra pantalla completa para dibujar.</div>
    </div>`;
  }
}

function openCanvasForNote() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  const lbl  = document.getElementById('canvas-note-title-lbl');
  if (lbl) lbl.textContent = note?.title || 'Dibujo';

  document.getElementById('modal-canvas').classList.add('open');

  // Init canvas after modal is visible
  requestAnimationFrame(() => {
    _canvas = document.getElementById('notes-canvas');
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight - (document.getElementById('canvas-toolbar-modal')?.offsetHeight || 52);
    _ctx = _canvas.getContext('2d');

    // Dark background
    _ctx.fillStyle = '#1a1f2e';
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Load existing drawing
    if (note?.canvasData) {
      const img = new Image();
      img.onload = () => _ctx.drawImage(img, 0, 0);
      img.src = note.canvasData;
    }
    _undoStack = [];
    _shapeStart = null;
    _shapePreviewData = null;
    _canvasImageObjects = [];
    _dragImg = null;
    /* Remove old overlay if exists */
    const oldOv = document.getElementById('canvas-img-overlay');
    if (oldOv) oldOv.remove();
    _canvasOverlay = null;
    _initCanvasEvents();
  });
}

function _canvasGetPos(e) {
  const r = _canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

function _drawShape(x0, y0, x1, y1, tool, ctx) {
  ctx.lineWidth   = _canvasSize;
  ctx.strokeStyle = _canvasColor;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (tool === 'line') {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  } else if (tool === 'rect') {
    ctx.beginPath(); ctx.strokeRect(x0, y0, x1-x0, y1-y0);
  } else if (tool === 'circle') {
    const rx = Math.abs(x1-x0)/2, ry = Math.abs(y1-y0)/2;
    const cx = x0 + (x1-x0)/2, cy = y0 + (y1-y0)/2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2*Math.PI); ctx.stroke();
  }
}

// AI Shape detection: analyze a stroke and decide if it looks like a line/circle/rect
function _detectShape(points) {
  if (points.length < 5) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (w < 5 && h < 5) return null;

  // Check if endpoints are close (closed shape)
  const first = points[0], last = points[points.length - 1];
  const distEnds = Math.hypot(last.x - first.x, last.y - first.y);
  const perimeter = Math.hypot(w, h) * 2;
  const isClosed = distEnds < perimeter * 0.25 && points.length > 10;

  // Compute "straightness" — how close the stroke is to a line
  const dx = last.x - first.x, dy = last.y - first.y;
  const lineLen = Math.hypot(dx, dy);
  let maxDeviation = 0;
  if (lineLen > 0) {
    points.forEach(p => {
      const t = ((p.x - first.x)*dx + (p.y - first.y)*dy) / (lineLen*lineLen);
      const px = first.x + t*dx, py = first.y + t*dy;
      maxDeviation = Math.max(maxDeviation, Math.hypot(p.x - px, p.y - py));
    });
  }
  const relativeDeviation = lineLen > 0 ? maxDeviation / lineLen : 1;

  if (!isClosed && relativeDeviation < 0.12 && lineLen > 20) return 'line';

  if (isClosed) {
    // Check rectangle-ness: sample corners
    const aspect = w > 0 ? h / w : 1;
    // For circles: measure average distance from center vs std deviation
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const avgR = points.reduce((a, p) => a + Math.hypot(p.x-cx, p.y-cy), 0) / points.length;
    const rStd = Math.sqrt(points.reduce((a, p) => a + Math.pow(Math.hypot(p.x-cx, p.y-cy) - avgR, 2), 0) / points.length);
    const rCV = avgR > 0 ? rStd / avgR : 1;
    if (rCV < 0.15 && avgR > 10) return 'circle';
    if (w > 10 && h > 10) return 'rect';
  }
  return null;
}

let _strokePoints = [];

function _initCanvasEvents() {
  if (!_canvas || _canvas._eventsAttached) return;
  _canvas._eventsAttached = true;

  const startDraw = e => {
    e.preventDefault();
    const p = _canvasGetPos(e);

    /* ── MOVE TOOL: check if click is on an image object ── */
    if (_currentTool === 'move') {
      // Hit-test in reverse order (topmost first)
      for (let i = _canvasImageObjects.length - 1; i >= 0; i--) {
        const obj = _canvasImageObjects[i];
        if (p.x >= obj.x && p.x <= obj.x + obj.w &&
            p.y >= obj.y && p.y <= obj.y + obj.h) {
          _dragImg  = obj;
          _dragOffX = p.x - obj.x;
          _dragOffY = p.y - obj.y;
          _canvas.style.cursor = 'grabbing';
          return;
        }
      }
      return; // clicked on empty area in move mode
    }

    if (_currentTool === 'text') {
      _openCanvasTextInput(p.x, p.y);
      return;
    }
    _drawing = true;
    _strokePoints = [];
    _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    if (_undoStack.length > 20) _undoStack.shift();
    _shapeStart = p;
    _shapePreviewData = null;

    if (_currentTool === 'pen' || _currentTool === 'ai') {
      _ctx.beginPath();
      _ctx.moveTo(p.x, p.y);
      _strokePoints.push(p);
    }
  };

  let _drawRafId = null;
  const draw = e => {
    e.preventDefault();
    const p = _canvasGetPos(e);

    /* ── MOVE TOOL: drag image object ── */
    if (_currentTool === 'move' && _dragImg) {
      if (_drawRafId) return;
      _drawRafId = requestAnimationFrame(() => {
        _drawRafId = null;
        /* Restore canvas to last undo snapshot, then redraw all image objects */
        if (_undoStack.length) {
          _ctx.putImageData(_undoStack[_undoStack.length - 1], 0, 0);
        }
        _dragImg.x = p.x - _dragOffX;
        _dragImg.y = p.y - _dragOffY;
        /* Draw all image objects */
        _canvasImageObjects.forEach(obj => {
          _ctx.drawImage(obj.img, obj.x, obj.y, obj.w, obj.h);
        });
        _redrawCanvasImageHandles();
      });
      return;
    }

    if (!_drawing) return;
    if (_drawRafId) return;
    _drawRafId = requestAnimationFrame(() => {
      _drawRafId = null;
      _ctx.lineWidth   = _canvasEraser ? _canvasSize * 4 : _canvasSize;
      _ctx.strokeStyle = _canvasEraser ? '#1a1f2e' : _canvasColor;
      _ctx.lineCap     = 'round'; _ctx.lineJoin = 'round';

      if (_canvasEraser) {
        _ctx.lineTo(p.x, p.y); _ctx.stroke();
      } else if (_currentTool === 'pen' || _currentTool === 'ai') {
        _ctx.lineTo(p.x, p.y); _ctx.stroke();
        _strokePoints.push(p);
      } else {
        if (_shapePreviewData) {
          _ctx.putImageData(_shapePreviewData, 0, 0);
        } else {
          _shapePreviewData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
        }
        _drawShape(_shapeStart.x, _shapeStart.y, p.x, p.y, _currentTool, _ctx);
      }
    });
  };

  const stopDraw = () => {
    /* ── MOVE TOOL: drop image ── */
    if (_currentTool === 'move' && _dragImg) {
      /* Commit position: take new undo snapshot */
      _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
      if (_undoStack.length > 20) _undoStack.shift();
      _dragImg = null;
      _canvas.style.cursor = 'grab';
      _redrawCanvasImageHandles();
      return;
    }

    if (!_drawing) return;
    _drawing = false;
    const p = _strokePoints.length ? _strokePoints[_strokePoints.length-1] : null;

    if (_shapePreviewData && p && _currentTool !== 'pen' && _currentTool !== 'ai') {
      _ctx.putImageData(_shapePreviewData, 0, 0);
      _drawShape(_shapeStart.x, _shapeStart.y, p.x, p.y, _currentTool, _ctx);
      _shapePreviewData = null;
    }

    if (_currentTool === 'ai' && _strokePoints.length >= 5) {
      const detected = _detectShape(_strokePoints);
      if (detected) {
        if (_undoStack.length) _ctx.putImageData(_undoStack[_undoStack.length-1], 0, 0);
        const pts = _strokePoints;
        if (detected === 'line') {
          _drawShape(pts[0].x, pts[0].y, pts[pts.length-1].x, pts[pts.length-1].y, 'line', _ctx);
        } else {
          const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
          _drawShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), detected, _ctx);
        }
        _showShapeIndicator(detected);
      }
    }

    if (_currentTool === 'text' && _strokePoints.length <= 2) {
      const p = _shapeStart || (_strokePoints[0] || { x: 50, y: 50 });
      _openCanvasTextInput(p.x, p.y);
    }

    _ctx.beginPath();
    _strokePoints = [];
    _shapeStart = null;
  };

  _canvas.addEventListener('mousedown', startDraw);
  _canvas.addEventListener('mousemove', draw);
  _canvas.addEventListener('mouseup', stopDraw);
  _canvas.addEventListener('mouseleave', stopDraw);
  _canvas.addEventListener('touchstart', startDraw, { passive: false });
  _canvas.addEventListener('touchmove',  draw,      { passive: false });
  _canvas.addEventListener('touchend',   stopDraw);

  document.addEventListener('paste', _handleCanvasPaste);
  _canvas.addEventListener('dragover', e => e.preventDefault());
  _canvas.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const pos = _canvasGetPos(e);
      _addImageObjectToCanvas(file, pos.x, pos.y);
    }
  });
}

function _showShapeIndicator(shape) {
  const names = { line: '📏 Línea detectada', circle: '⭕ Círculo detectado', rect: '▭ Rectángulo detectado' };
  const msg = names[shape] || '';
  if (!msg) return;
  let el = document.getElementById('canvas-shape-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'canvas-shape-indicator';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(124,106,255,.9);color:#fff;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700;z-index:3000;pointer-events:none;transition:opacity .3s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 1500);
}

function _handleCanvasPaste(e) {
  const modal = document.getElementById('modal-canvas');
  if (!modal?.classList.contains('open')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      _pasteImageToCanvas(item.getAsFile(), _canvas.width/2 - 100, _canvas.height/2 - 100);
      return;
    }
  }
}

function _pasteImageToCanvas(file, x, y) {
  _addImageObjectToCanvas(file, x, y);
}

function setCanvasTool(btn, tool) {
  _currentTool = tool;
  _canvasEraser = false;
  document.querySelectorAll('.canvas-tool-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const eb = document.getElementById('canvas-eraser-btn');
  if (eb) eb.classList.remove('active');
  if (tool === 'move') {
    _canvas.style.cursor = 'grab';
    _redrawCanvasImageHandles();
  } else {
    _canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
    /* Hide handles when not in move mode */
    const ov = document.getElementById('canvas-img-overlay');
    if (ov) ov.innerHTML = '';
  }
}

function _openCanvasTextInput(x, y) {
  if (!_canvas) return;
  const r = _canvas.getBoundingClientRect();
  // Remove any existing text input
  const existing = document.getElementById('canvas-text-overlay');
  if (existing) existing.remove();

  const inp = document.createElement('textarea');
  inp.id = 'canvas-text-overlay';
  inp.placeholder = 'Escribe aquí...';
  inp.style.cssText = `
    position:fixed;
    left:${r.left + x}px;
    top:${r.top + y - 4}px;
    min-width:120px; max-width:320px;
    min-height:32px;
    background:rgba(26,31,46,0.92);
    color:${_canvasColor};
    border:2px solid ${_canvasColor};
    border-radius:6px;
    padding:4px 8px;
    font-size:${Math.max(14, _canvasSize * 2.5)}px;
    font-family:'Space Mono',monospace;
    z-index:5000;
    resize:both;
    outline:none;
    line-height:1.4;
    box-shadow:0 4px 20px rgba(0,0,0,.5);
  `;

  document.body.appendChild(inp);
  inp.focus();

  const commit = () => {
    const text = inp.value.trim();
    inp.remove();
    if (!text || !_ctx) return;
    _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
    if (_undoStack.length > 20) _undoStack.shift();
    _ctx.font = `${Math.max(14, _canvasSize * 2.5)}px 'Space Mono', monospace`;
    _ctx.fillStyle = _canvasColor;
    _ctx.textBaseline = 'top';
    // Handle multi-line
    const lines = text.split('\n');
    const lineH = Math.max(14, _canvasSize * 2.5) * 1.4;
    lines.forEach((line, i) => _ctx.fillText(line, x, y + i * lineH));
  };

  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { inp.remove(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
  });
  inp.addEventListener('blur', commit, { once: true });
}

function setCanvasColor(btn, color) {
  _canvasColor = color; _canvasEraser = false;
  document.querySelectorAll('.canvas-color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const eb = document.getElementById('canvas-eraser-btn');
  if (eb) eb.classList.remove('active');
}
function setCanvasSize(btn, size) {
  _canvasSize = size;
  document.querySelectorAll('.canvas-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function toggleCanvasEraser() {
  _canvasEraser = !_canvasEraser;
  _currentTool = _canvasEraser ? 'eraser' : 'pen';
  const btn = document.getElementById('canvas-eraser-btn');
  if (btn) btn.classList.toggle('active', _canvasEraser);
}
function clearCanvas() {
  if (!_ctx || !_canvas) return;
  if (!confirm('¿Limpiar todo el dibujo?')) return;
  _undoStack.push(_ctx.getImageData(0, 0, _canvas.width, _canvas.height));
  _ctx.fillStyle = '#1a1f2e';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
}
function undoCanvas() {
  if (!_ctx || !_undoStack.length) return;
  _ctx.putImageData(_undoStack.pop(), 0, 0);
}

function saveCanvasAndClose() {
  if (!_canvas || !_currentNoteId) { closeModal('modal-canvas'); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (note) {
    note.canvasData  = _canvas.toDataURL('image/png');
    note.updatedAt   = Date.now();
    // Only change type to 'draw' if the note was originally created as a drawing note (has no text content)
    // Don't override text notes' type - they can have both text AND canvas
    if (note.type === 'draw' || (!note.content && !note.title)) {
      note.type = 'draw';
    }
    // For text notes with canvas: store canvas but keep as text type
    saveState(['all']);
    // refresh preview
    const prev = document.getElementById('notes-drawing-preview');
    if (prev) prev.src = note.canvasData;
    renderNotesList();
    // If it's a text note, re-render the images strip to show the canvas thumbnail
    if (note.type !== 'draw') {
      _renderImagesStrip(note);
    }
  }
  closeModal('modal-canvas');
  // Cleanup
  document.removeEventListener('paste', _handleCanvasPaste);
  _canvas._eventsAttached = false;
  _canvas = null; _ctx = null;
}

function setNotesMat(matId) {
  if (_currentNoteId) _autoCommitNote();
  const noteId = 'note_' + Date.now();
  const mat = State.materias.find(m => m.id === matId);
  _getNotesArray().push({
    id: noteId, type: 'text',
    matId, folderId: '',
    title: mat ? `Notas — ${mat.name}` : '',
    content: '', images: {},
    updatedAt: Date.now()
  });
  saveState(['all']);
  _currentNoteId   = noteId;
  _currentFolderId = null;
  goPage('notas', document.querySelector('[onclick*="notas"]'));
}

let _ecMatId = null;
let _ecColorSel = '#7c6aff', _ecIconSel = '📚';
let _ecZoneRowCount = 0;

function ecSelectColor(el) {
  _ecColorSel = el.dataset.color;
  document.querySelectorAll('#ec-color-picker .color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function ecSelectIcon(el) {
  _ecIconSel = el.dataset.icon;
  document.querySelectorAll('#ec-icon-picker .icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function openEditClassModal(matId) {
  const mat = State.materias.find(m => m.id === matId);
  if (!mat) return;
  _ecMatId = matId;
  _ecColorSel = mat.color || '#7c6aff';
  _ecIconSel  = mat.icon  || '📚';
  _ecZoneRowCount = 0;

  document.getElementById('ec-name').value       = mat.name || '';
  document.getElementById('ec-code').value       = mat.code || '';
  document.getElementById('ec-credits').value    = mat.credits || '';
  document.getElementById('ec-seccion').value    = mat.seccion || '';
  document.getElementById('ec-catedratico').value= mat.catedratico || '';
  // Set dias checkboxes
  const matDias = (mat.dias || '').split(/[\s,]+/).map(d => d.trim());
  document.querySelectorAll('#ec-dias-checks input[type=checkbox]').forEach(cb => {
    cb.checked = matDias.includes(cb.value);
  });
  document.getElementById('ec-dias').value = mat.dias || '';
  document.getElementById('ec-horario').value    = mat.horario || '';

  document.querySelectorAll('#ec-color-picker .color-opt').forEach(el =>
    el.classList.toggle('selected', el.dataset.color === _ecColorSel));
  document.querySelectorAll('#ec-icon-picker .icon-opt').forEach(el =>
    el.classList.toggle('selected', el.dataset.icon === _ecIconSel));

  const zonesBuilderEl = _el('ec-zones-builder');
  if (zonesBuilderEl) {
    zonesBuilderEl.innerHTML = '';
    (mat.zones || []).filter(z => !z.isLabZone).forEach(z => {
      ecAddZoneRow(z.label, z.maxPts, (z.subs||[]).map(s => ({ label: s.label, pts: s.maxPts })));
    });
  }

  document.getElementById('editclass-title').textContent = `✏️ Editar: ${mat.icon||''} ${mat.name}`;

  const titleEl = document.getElementById('editclass-title');
  if (mat.parentId) {
    const parentMat = State.materias.find(x => x.id === mat.parentId);
    titleEl.innerHTML = `✏️ Editar Lab: ${mat.icon||'🧪'} ${mat.name} <span style="font-size:11px;color:#4ade80;background:rgba(74,222,128,.15);padding:2px 7px;border-radius:4px;border:1px solid rgba(74,222,128,.3);font-family:'Space Mono',monospace;">🔗 ${parentMat?.name||'Clase padre'}</span>`;

    if (parentMat) {
      _ecColorSel = parentMat.color;
      document.querySelectorAll('#ec-color-picker .color-opt').forEach(el =>
        el.classList.toggle('selected', el.dataset.color === _ecColorSel));
    }
  }

  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById('ec-formula-' + i);
    if (inp) inp.value = (mat.formulas && mat.formulas[i]) ? mat.formulas[i] : '';
  }

  document.getElementById('modal-editclass').classList.add('open');
}

function ecAddZoneRow(labelVal, ptsVal, subsArr) {
  _ecZoneRowCount++;
  const id  = 'ec-zr-' + _ecZoneRowCount;
  const subs = subsArr || [];
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const totalPts = subs.reduce((a,s) => a + (parseFloat(s.pts)||0), 0);

  const buildSubsHtml = (subsList) => subsList.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}">
      <input type="text" class="form-input ec-sub-label" placeholder="Apartado" value="${(s.label||'').replace(/"/g,'&quot;')}" style="font-size:12px;">
      <input type="number" class="form-input ec-sub-pts" placeholder="Pts" value="${s.pts||''}" min="0" max="200" style="font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${id}')">
      <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();ecUpdateZoneTotal('${id}')" style="padding:3px 6px;">✕</button>
    </div>`).join('');

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input ec-zone-name" placeholder="Nombre de la zona" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="font-size:13px;font-weight:600;flex:1;">
      <div style="font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;">Total: <strong id="${id}-total" style="color:var(--accent2);">${totalPts.toFixed(1)}</strong> pts</div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs" class="zone-subs-area">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="ecAddZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;

  _el('ec-zones-builder').appendChild(div);
}

function ecAddZoneSub(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  if (!subsDiv) return;
  const idx = subsDiv.children.length;
  const row = document.createElement('div');
  row.className = 'zone-sub-row';
  row.id = zoneId + '-sub-' + idx;
  row.innerHTML = `
    <input type="text" class="form-input ec-sub-label" placeholder="Apartado" style="font-size:12px;">
    <input type="number" class="form-input ec-sub-pts" placeholder="Pts" min="0" max="200" style="font-size:12px;text-align:center;" oninput="ecUpdateZoneTotal('${zoneId}')">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();ecUpdateZoneTotal('${zoneId}')" style="padding:3px 6px;">✕</button>`;
  subsDiv.appendChild(row);
}

function ecUpdateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value)||0; });
  totalEl.textContent = total.toFixed(1);
}

function saveEditClass() {
  if (!_ecMatId) return;
  const mat = State.materias.find(m => m.id === _ecMatId);
  if (!mat) return;

  const name = document.getElementById('ec-name').value.trim();
  const code = document.getElementById('ec-code').value.trim();
  if (!name || !code) { alert('Nombre y código son requeridos.'); return; }

  mat.name        = name;
  mat.code        = code;
  const credVal   = document.getElementById('ec-credits').value.trim();
  if (credVal) mat.credits = credVal;
  mat.color       = _ecColorSel;
  mat.icon        = _ecIconSel;

  if (mat.linkedLabId) {
    const labMat = State.materias.find(x => x.id === mat.linkedLabId);
    if (labMat) { labMat.color = _ecColorSel; }
  }
  const secVal    = document.getElementById('ec-seccion').value.trim();
  if (secVal !== undefined) mat.seccion = secVal;
  const catVal    = document.getElementById('ec-catedratico').value.trim();
  if (catVal !== undefined) mat.catedratico = catVal;
  const diasVal = Array.from(document.querySelectorAll('#ec-dias-checks input[type=checkbox]:checked')).map(cb=>cb.value).join(', ');
  mat.dias = diasVal;
  const horVal    = document.getElementById('ec-horario').value.trim();
  if (horVal !== undefined) mat.horario = horVal;

  const zonesBuilderEl = _el('ec-zones-builder');
  if (zonesBuilderEl) {
    const labZones = (mat.zones || []).filter(z => z.isLabZone);
    const newZones = [];
    zonesBuilderEl.querySelectorAll('div[id^="ec-zr-"]').forEach(row => {
      const lbl = row.querySelector('.ec-zone-name')?.value.trim() || '';
      if (!lbl) return;
      const key      = lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
      const subsRows = row.querySelectorAll('.zone-sub-row');
      const subs = []; let totalPts = 0;
      subsRows.forEach((sr, i) => {
        const subLabel = sr.querySelector('.ec-sub-label')?.value.trim() || (lbl + ' ' + (i+1));
        const subPts   = parseFloat(sr.querySelector('.ec-sub-pts')?.value) || 0;
        if (subPts > 0) {

          const existSub = (mat.zones||[]).flatMap(z=>z.subs||[]).find(s=>s.key===key+'_'+(i+1));
          subs.push({ key: key+'_'+(i+1), label: subLabel, maxPts: subPts,
            ...(existSub ? { _prev: existSub } : {}) });
          totalPts += subPts;
        }
      });
      if (subs.length && totalPts > 0) {
        const existZone = (mat.zones||[]).find(z=>z.key===key);
        newZones.push({ ...(existZone||{}), key, label: lbl, maxPts: totalPts, color: _ecColorSel, subs });
      }
    });
    if (newZones.length > 0) mat.zones = [...newZones, ...labZones];
  }

  mat.formulas = [];
  for (let i = 0; i < 5; i++) {
    const inp = document.getElementById('ec-formula-' + i);
    mat.formulas.push(inp ? inp.value.trim() : '');
  }

  saveState(['materias']);
  closeModal('modal-editclass');
  renderMaterias(); renderGrades(); renderHorario();
  fillMatSels(); fillTopicMatSel(); fillPomSel(); fillNotesSel(); fillExamSel();
}

function renderNotebookPage() { renderNotesProPage(); }
function selectNoteMat(matId) { setNotesMat(matId); }
function handleNoteFile(matId, input) {  }

function toggleFormulas(matId) {
  const body  = document.getElementById('formulas-body-' + matId);
  const arrow = document.getElementById('formulas-arrow-' + matId);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  if (arrow) arrow.textContent = isOpen ? '▼' : '▶';
}

function saveFormula(matId, index, value) {
  const mat = State.materias.find(m => m.id === matId);
  if (!mat) return;
  if (!mat.formulas) mat.formulas = ['','','','',''];
  mat.formulas[index] = value;
  saveState(['materias']);
}

// ══════════════════════════════════════════════════
// CARGA DE TAREAS — WEEK NAVIGATION
// ══════════════════════════════════════════════════
let _weekOffset = 0;

function changeWeekOffset(delta, e) {
  if (e) e.stopPropagation();
  if (delta === 0) { _weekOffset = 0; }
  else { _weekOffset += delta; }
  renderOverview();
}

function toggleLoadPanel() {
  const body = document.getElementById('load-panel-body');
  const icon = document.getElementById('load-panel-toggle');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (icon) icon.textContent = isOpen ? '▶' : '▼';
}

// Patch renderOverview to use _weekOffset
const _origRenderOverview = _renderOverview;
function _renderOverview() {
  const pending = State.tasks.filter(t => !t.done);
  const overall = calcOverallGPA();

  const ovMatsEl = _el('ov-mats');
  if (ovMatsEl) ovMatsEl.textContent = State.materias.filter(m=>!m.parentId).length;
  const avgEl  = _el('ov-avg');
  const credEl = _el('ov-cred');
  if (avgEl)  avgEl.textContent  = overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—';
  if (credEl) credEl.textContent = overall.totalCred  || '0';
  const legacyPend = document.getElementById('ov-pending');
  if (legacyPend) legacyPend.textContent = pending.length;

  updateGPADisplay();

  const urgentCount = pending.filter(t => t.due && (new Date(t.due)-new Date())/86400000 <= 2 && (new Date(t.due)-new Date())/86400000 >= 0).length;
  const profileSub  = State.settings?.profile?.carrera ? ` · ${State.settings.profile.carrera}` : '';
  _el('ov-sub').textContent =
    urgentCount > 0 ? `⚡ ${urgentCount} tarea(s) vencen en menos de 2 días`
    : pending.length > 0 ? `${pending.length} tarea(s) pendiente(s)${profileSub}`
    : `¡Sin pendientes! 🎉${profileSub}`;

  const badge = _el('ov-pending-badge');
  if (badge) badge.textContent = pending.length > 0 ? `${pending.length} sin entregar` : '';

  const loadBarsEl   = _el('ov-load-bars');
  const weekRangeEl  = _el('ov-week-range');
  if (loadBarsEl) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dow   = today.getDay();
    const baseMonday = new Date(today);
    baseMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const monday = new Date(baseMonday);
    monday.setDate(baseMonday.getDate() + _weekOffset * 7);
    const days   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const counts = days.map((_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0,10);
      return State.tasks.filter(t => t.due === dStr && !t.done).length;
    });
    const maxCnt = Math.max(...counts, 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    if (weekRangeEl) {
      const isCurrentWeek = _weekOffset === 0;
      const label = isCurrentWeek ? 'Semana actual · ' : (_weekOffset < 0 ? `Hace ${-_weekOffset} sem · ` : `En ${_weekOffset} sem · `);
      weekRangeEl.textContent = label + `${monday.getDate()}–${sunday.getDate()} ${sunday.toLocaleDateString('es-ES',{month:'short'})}`;
    }
    loadBarsEl.innerHTML = days.map((lbl, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const isToday = d.getTime() === today.getTime();
      const cnt = counts[i];
      const barH = cnt > 0 ? Math.max(8, Math.round((cnt/maxCnt)*44)) : 3;
      const clr  = cnt === 0 ? 'var(--border2)' : cnt >= 3 ? '#f87171' : cnt >= 2 ? '#fbbf24' : '#4ade80';
      return `<div class="load-bar-col">
        <div class="load-bar-cnt" style="color:${cnt>0?clr:'transparent'}">${cnt>0?cnt:''}</div>
        <div class="load-bar-inner" style="height:${barH}px;background:${clr};${isToday?'box-shadow:0 0 8px '+clr+'80;':''};"></div>
        <div class="load-bar-lbl" style="font-weight:${isToday?700:400};color:${isToday?'var(--accent2)':'var(--text3)'}">${lbl}</div>
      </div>`;
    }).join('');
  }

  const tl = _el('ov-tasks-list');
  const today2 = new Date(); today2.setHours(0,0,0,0);
  const sorted = [...pending].sort((a,b) => {
    const da = a.due || '9999-12-31', db = b.due || '9999-12-31';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  tl.innerHTML = sorted.length ? sorted.map(t => {
    const m = getMat(t.matId);
    const dueD = t.due ? new Date(t.due) : null;
    const daysLeft = dueD ? Math.ceil((dueD - today2) / 86400000) : null;
    let bClass, bText;
    if (daysLeft === null)         { bClass='ub-none';    bText='Sin fecha'; }
    else if (daysLeft < 0)         { bClass='ub-overdue'; bText=`Venció hace ${-daysLeft}d`; }
    else if (daysLeft === 0)       { bClass='ub-critical';bText='Vence hoy'; }
    else if (daysLeft < 2)         { bClass='ub-critical';bText=`Faltan ${daysLeft} día`; }
    else if (daysLeft < 5)         { bClass='ub-warning'; bText=`Faltan ${daysLeft} días`; }
    else                           { bClass='ub-ok';      bText=`Faltan ${daysLeft} días`; }
    const prog = subtaskProgress(t);
    const prioClass = t.priority === 'high' || t.priority === 'alta' ? 'prio-alta'
                    : t.priority === 'low'  || t.priority === 'baja' ? 'prio-baja'
                    : t.priority ? 'prio-media' : 'prio-none';
    return `<div class="mc-task-item ${prioClass}">
      <div class="mc-task-info">
        <div class="mc-task-title">${t.title}</div>
        <div class="mc-task-meta">
          <span>${m.icon||'📚'} ${m.code||m.name||'—'}</span>
          <span>${t.type||'Tarea'}</span>
          ${t.due?`<span style="font-family:'Space Mono',monospace;">${fmtD(t.due)}</span>`:''}
          ${prog?`<span>${prog.done}/${prog.total} sub.</span>`:''}
        </div>
      </div>
      <span class="urgency-badge ${bClass}">${bText}</span>
    </div>`;
  }).join('')
  : `<div style="text-align:center;padding:40px;color:var(--text3);">
      <div style="font-size:36px;margin-bottom:8px;">✅</div>
      <div style="font-size:14px;font-weight:700;">¡Sin tareas pendientes!</div>
      <div style="font-size:12px;margin-top:4px;color:var(--text3);">Siga adelante, Ingeniero 🎓</div>
    </div>`;

  // ── "Esta semana" timeline ──────────────────────────────────
  const tlEl = _el('ov-timeline');
  if (tlEl) {
    const today = new Date(); today.setHours(0,0,0,0);
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const daysFull = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    // Show today + next 6 days (7 days total)
    const days = Array.from({length:7}, (_,i) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      return d;
    });
    tlEl.innerHTML = `<div class="timeline-wrap">` + days.map(d => {
      const dStr = d.toISOString().slice(0,10);
      const isToday = d.getTime() === today.getTime();
      const tasks = State.tasks.filter(t => !t.done && t.due === dStr);
      const events = State.events.filter(e => e.date === dStr);
      const hasItems = tasks.length > 0 || events.length > 0;
      const dotClass = isToday ? 'today' : !hasItems ? 'empty' : '';
      const dateNum = d.getDate();
      const monthShort = d.toLocaleDateString('es-ES',{month:'short'});
      const items = [
        ...events.map(e => {
          const m = getMat(e.matId);
          return `<div class="tl-item event"><span class="tl-item-icon">📅</span><div class="tl-item-text"><div class="tl-item-title">${e.title}</div><div class="tl-item-meta">${m.icon||''} ${m.name||'Evento'}${e.hora?' · '+e.hora:''}</div></div></div>`;
        }),
        ...tasks.map(t => {
          const m = getMat(t.matId);
          const prioColors = {alta:'#f87171',media:'#fbbf24',baja:'#4ade80'};
          const borderClr = prioColors[t.priority] || 'var(--accent)';
          return `<div class="tl-item" style="border-left-color:${borderClr}"><span class="tl-item-icon">✅</span><div class="tl-item-text"><div class="tl-item-title">${t.title}</div><div class="tl-item-meta">${m.icon||''} ${m.name||'—'} · ${t.type||'Tarea'}</div></div></div>`;
        })
      ].join('');
      return `<div class="tl-day">
        <div class="tl-day-label">
          <div class="tl-day-date" style="${isToday?'color:var(--accent2);':'color:var(--text2);'}font-weight:800;">${dateNum} ${monthShort}</div>
          <div class="tl-day-name" style="${isToday?'color:var(--accent2);font-weight:800;':''}font-size:10px;letter-spacing:.5px;">${daysFull[d.getDay()]}</div>
        </div>
        <div class="tl-line"><div class="tl-dot ${dotClass}"></div></div>
        <div class="tl-items">
          ${hasItems ? items : `<div class="tl-empty-day">${isToday?'Sin pendientes hoy':'—'}</div>`}
        </div>
      </div>`;
    }).join('') + `</div>`;
  }
}


// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
let _sidebarCollapsed = false;

function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  const sidebar = document.querySelector('.sidebar');
  const main    = document.querySelector('.main');
  const btn     = document.getElementById('sidebar-toggle-btn');
  if (_sidebarCollapsed) {
    sidebar.classList.add('collapsed');
    main.style.marginLeft = '0';
    btn.classList.add('is-collapsed');
    btn.textContent = '›';
    btn.title = 'Mostrar menú';
  } else {
    sidebar.classList.remove('collapsed');
    main.style.marginLeft = 'var(--sidebar-w)';
    btn.classList.remove('is-collapsed');
    btn.textContent = '‹';
    btn.title = 'Ocultar menú';
  }
}


function _getProfile() {
  if (!State.settings.profile) State.settings.profile = {};
  return State.settings.profile;
}

function _getApprovedCourses() {
  if (!State.settings.approvedCourses) State.settings.approvedCourses = [];
  return State.settings.approvedCourses;
}

function renderProfilePage() {
  const p = _getProfile();
  const nameEl = document.getElementById('profile-name');
  const carEl  = document.getElementById('profile-carrera');
  const regEl  = document.getElementById('profile-registro');
  const facEl  = document.getElementById('profile-facultad');
  const totEl  = document.getElementById('profile-total-cred');
  if (nameEl) nameEl.value = p.name || '';
  if (carEl)  carEl.value  = p.carrera || '';
  if (regEl)  regEl.value  = p.registro || '';
  if (facEl)  facEl.value  = p.facultad || '';
  if (totEl)  totEl.value  = p.totalCredCarrera || '';

  // Sync personalization selects
  const fontSel  = document.getElementById('cfg-font-select');
  const soundSel = document.getElementById('cfg-sound-select');
  if (fontSel)  fontSel.value  = State.settings.font || 'Syne';
  if (soundSel) soundSel.value = State.settings.soundVariant || 'classic';
  // Sync accent color picker
  const accent = State.settings.accentColor || '#7c6aff';
  document.querySelectorAll('.accent-color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === accent);
  });

  recalcProfile();
  renderApprovedCourses();
}

function saveProfile() {
  const p = _getProfile();
  p.name     = document.getElementById('profile-name')?.value.trim() || '';
  p.carrera  = document.getElementById('profile-carrera')?.value.trim() || '';
  p.registro = document.getElementById('profile-registro')?.value.trim() || '';
  p.facultad = document.getElementById('profile-facultad')?.value.trim() || '';
  p.totalCredCarrera = parseInt(document.getElementById('profile-total-cred')?.value) || 0;
  saveState(['all']);
  recalcProfile();
  // Update greeting in overview
  if (p.name) {
    const grEl = _el('ov-greeting');
    if (grEl && grEl.textContent) {
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
      grEl.textContent = `${g}, ${p.name.split(' ')[0]} 👋`;
    }
  }
  alert('✅ Perfil guardado correctamente');
}

function recalcProfile() {
  const courses = _getApprovedCourses();
  const totalCred = courses.reduce((a,c) => a + (parseFloat(c.credits)||0), 0);
  const totalCourses = courses.length;
  let weightedAvg = null;
  if (courses.length > 0) {
    const weighted = courses.reduce((a,c) => a + (parseFloat(c.grade)||0) * (parseFloat(c.credits)||0), 0);
    weightedAvg = totalCred > 0 ? weighted / totalCred : null;
  }
  const avgEl  = document.getElementById('profile-display-avg');
  const credEl = document.getElementById('profile-display-cred');
  const crsEl  = document.getElementById('profile-display-courses');
  const pctEl  = document.getElementById('profile-career-pct');
  const barEl  = document.getElementById('profile-career-bar');

  if (avgEl)  avgEl.textContent  = weightedAvg !== null ? weightedAvg.toFixed(2) : '—';
  if (credEl) credEl.textContent = totalCred;
  if (crsEl)  crsEl.textContent  = totalCourses;

  const p = _getProfile();
  const totalCarrera = parseInt(document.getElementById('profile-total-cred')?.value) || p.totalCredCarrera || 0;
  const pct = totalCarrera > 0 ? Math.min(100, (totalCred / totalCarrera * 100)).toFixed(1) : 0;
  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';

  // Also update sidebar with profile name if present
  const nm = _el('sidebar-sem-nombre');
  // don't overwrite semester name
}

function renderApprovedCourses() {
  const container = document.getElementById('approved-courses-list');
  if (!container) return;
  const courses = _getApprovedCourses();
  if (!courses.length) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text3);">
      <div style="font-size:28px;margin-bottom:8px;">🎓</div>
      <div style="font-size:13px;">Agrega los cursos que ya aprobaste</div>
      <div style="font-size:11px;margin-top:4px;color:var(--text3);">El promedio y créditos se calcularán automáticamente</div>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 80px 70px 90px 110px 36px 36px;gap:8px;align-items:center;padding:6px 0;border-bottom:2px solid var(--border);margin-bottom:4px;">
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;">CURSO</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">CÓDIGO</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">CRED</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">NOTA</span>
      <span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">SEMESTRE</span>
      <span></span><span></span>
    </div>
    ${courses.map((c,i) => {
      const g = parseFloat(c.grade)||0;
      const col = g >= 61 ? '#4ade80' : g >= 50 ? '#fbbf24' : '#f87171';
      return `<div style="display:grid;grid-template-columns:1fr 80px 70px 90px 110px 36px 36px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;font-weight:600;">${c.name}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);text-align:center;">${c.code||'—'}</span>
        <span style="font-size:12px;font-family:'Space Mono',monospace;color:var(--accent2);text-align:center;font-weight:700;">${c.credits||0}</span>
        <span style="font-size:13px;font-weight:800;color:${col};text-align:center;">${g.toFixed(1)}</span>
        <span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;text-align:center;">${c.semester||'—'}</span>
        <button class="btn btn-ghost btn-sm" onclick="editApprovedCourse(${i})" style="padding:3px 6px;" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteApprovedCourse(${i})" style="padding:3px 6px;">✕</button>
      </div>`;
    }).join('')}`;
}

function openAddApprovedCourse() {
  document.getElementById('ac-modal-title').textContent = '✅ Agregar Curso Aprobado';
  document.getElementById('ac-edit-idx').value = '';
  document.getElementById('ac-name').value    = '';
  document.getElementById('ac-code').value    = '';
  document.getElementById('ac-credits').value = '';
  document.getElementById('ac-grade').value   = '';
  document.getElementById('ac-semester').value = '';
  document.getElementById('modal-approved-course').classList.add('open');
}

function editApprovedCourse(idx) {
  const courses = _getApprovedCourses();
  const c = courses[idx];
  if (!c) return;
  document.getElementById('ac-modal-title').textContent = '✏️ Editar Curso Aprobado';
  document.getElementById('ac-edit-idx').value = idx;
  document.getElementById('ac-name').value     = c.name || '';
  document.getElementById('ac-code').value     = c.code || '';
  document.getElementById('ac-credits').value  = c.credits || '';
  document.getElementById('ac-grade').value    = c.grade || '';
  document.getElementById('ac-semester').value = c.semester || '';
  document.getElementById('modal-approved-course').classList.add('open');
}

function saveApprovedCourse() {
  const name = document.getElementById('ac-name')?.value.trim();
  if (!name) { alert('El nombre del curso es obligatorio'); return; }
  const data = {
    name,
    code:     document.getElementById('ac-code')?.value.trim()    || '',
    credits:  parseFloat(document.getElementById('ac-credits')?.value) || 0,
    grade:    parseFloat(document.getElementById('ac-grade')?.value)   || 0,
    semester: document.getElementById('ac-semester')?.value.trim() || '',
  };
  const editIdx = document.getElementById('ac-edit-idx')?.value;
  const courses = _getApprovedCourses();
  if (editIdx !== '' && editIdx !== undefined && courses[parseInt(editIdx)]) {
    Object.assign(courses[parseInt(editIdx)], data);
  } else {
    courses.push(data);
  }
  saveState(['all']);
  closeModal('modal-approved-course');
  recalcProfile();
  renderApprovedCourses();
}

function deleteApprovedCourse(idx) {
  if (!confirm('¿Eliminar este curso?')) return;
  _getApprovedCourses().splice(idx, 1);
  saveState(['all']);
  recalcProfile();
  renderApprovedCourses();
}

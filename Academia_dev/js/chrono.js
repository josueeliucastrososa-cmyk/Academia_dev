// ── STREAK SYSTEM ────────────────────────────────────────────
function _getStreakData() {
  return JSON.parse(localStorage.getItem('academia_streak') || '{"count":0,"lastDate":""}');
}
function _saveStreakData(d) { localStorage.setItem('academia_streak', JSON.stringify(d)); }
function _updateStreak() {
  const today = new Date().toDateString();
  const sd = _getStreakData();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (sd.lastDate === today) return sd.count; // already counted today
  if (sd.lastDate === yesterday) { sd.count++; } 
  else if (sd.lastDate !== today) { sd.count = 1; } // reset or first
  sd.lastDate = today;
  _saveStreakData(sd);
  return sd.count;
}

// Streak is updated inside toggleTask directly

// ── ¿QUÉ HAGO HOY? PAGE ──────────────────────────────────────
function renderHoyPage() {
  const container = document.getElementById('hoy-container');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const todayStr = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  const todayD = new Date(); todayD.setHours(0,0,0,0);

  // Streak
  const streak = _getStreakData();
  const streakHtml = streak.count > 0
    ? `<div class="streak-badge"><span class="streak-fire">🔥</span> ${streak.count} día${streak.count!==1?'s':''} de racha</div>` : '';

  // Overdue + today tasks
  const dueTasks = State.tasks.filter(t => !t.done && t.due && t.due <= today);
  const noDateTasks = State.tasks.filter(t => !t.done && !t.due).slice(0, 5);

  // Today events
  const todayEvents = [...(State.events||[]), ...State.tasks.filter(t=>t.due===today && !t.done)]
    .filter(e => (e.date||e.due) === today);

  // Topics with low comprehension
  const weakTopics = (State.topics||[]).filter(t => (t.comprension||3) <= 2).slice(0, 4);

  // Weekly load for today
  const todayMinutes = State.tasks.filter(t => !t.done && t.due === today && t.timeEst)
    .reduce((s,t) => s + (t.timeEst||0), 0);

  // Motivational message based on pending count
  const pending = dueTasks.length + noDateTasks.length;
  const motivations = [
    '¡Excelente! No tienes pendientes urgentes. 🎉',
    '¡Casi todo en orden! Solo un pendiente. 💪',
    `Tienes ${pending} cosas pendientes. ¡Puedes con todo! 🚀`,
    `${pending} pendientes. Empieza con la más pequeña. 🎯`,
    `${pending} pendientes. Divide y conquista. ⚡`
  ];
  const motivIdx = Math.min(pending, motivations.length - 1);

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      <div>
        <div style="font-size:10px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:2px;text-transform:uppercase;">${todayStr}</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px;">☀️ ¿Qué hago hoy?</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${streakHtml}
        ${todayMinutes ? `<div style="background:var(--accent-glow);border:1px solid rgba(124,106,255,.3);color:var(--accent2);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;">⏱ ~${todayMinutes>=60?(todayMinutes/60).toFixed(1)+'h':todayMinutes+'min'} estimados hoy</div>` : ''}
      </div>
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:13px;">
      ${motivations[motivIdx]}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      
      <div class="card">
        <div class="card-header"><span class="card-title">🔥 Pendientes urgentes${dueTasks.length ? ` (${dueTasks.length})` : ''}</span></div>
        <div class="card-body" style="padding:0;">
          ${dueTasks.length ? dueTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">✅ Sin pendientes vencidos</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📅 Eventos de hoy</span></div>
        <div class="card-body" style="padding:0;">
          ${todayEvents.length ? todayEvents.map(e => `
            <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:13px;">
              <div style="font-weight:700;">${e.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${e.type||'Evento'} ${e.time ? '· '+e.time : ''}</div>
            </div>`).join('') : '<div class="hoy-empty">📭 Sin eventos hoy</div>'}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">📋 Sin fecha asignada</span></div>
        <div class="card-body" style="padding:0;">
          ${noDateTasks.length ? noDateTasks.map(t => _hoyTaskHtml(t)).join('') : '<div class="hoy-empty">Todo organizado ✨</div>'}
        </div>
      </div>

      ${weakTopics.length ? `
      <div class="card">
        <div class="card-header"><span class="card-title">📚 Temas para repasar</span></div>
        <div class="card-body" style="padding:0;">
          ${weakTopics.map(tp => {
            const m = getMat(tp.matId);
            return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);">
              <div style="font-size:12px;font-weight:700;">${tp.title}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px;">${m.icon||'📚'} ${m.name} · ${'⭐'.repeat(tp.comprension||1)} comprensión</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

    </div>`;
}

function _hoyTaskHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;">
    <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}');renderHoyPage();" style="margin-top:1px;flex-shrink:0;"></div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;">${t.title}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px;">
        ${m.icon||'📚'} ${m.name||'—'} 
        ${t.due ? `· <span class="${dc}" style="font-size:11px;">📅 ${fmtD(t.due)}</span>` : ''}
        ${t.timeEst ? `· ⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}` : ''}
      </div>
    </div>
  </div>`;
}

// ── KANBAN ────────────────────────────────────────────────────
const KANBAN_COLS = [
  { id:'todo',       label:'📋 Por Hacer',    color:'var(--text3)' },
  { id:'inprogress', label:'⚡ En Progreso',   color:'var(--yellow)' },
  { id:'done',       label:'✅ Completado',   color:'var(--green)' },
];

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  fillMatSels();

  board.innerHTML = KANBAN_COLS.map(col => {
    const tasks = State.tasks.filter(t => {
      const tCol = t.kanbanCol || (t.done ? 'done' : 'todo');
      return tCol === col.id;
    });
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <span class="kanban-col-title" style="color:${col.color};">${col.label}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text3);">${tasks.length}</span>
      </div>
      <div class="kanban-col-body kanban-drop-zone" id="kcol-${col.id}"
        ondragover="kDragOver(event,'${col.id}')"
        ondrop="kDrop(event,'${col.id}')"
        ondragleave="kDragLeave(event)">
        ${tasks.map(t => _kanbanCardHtml(t)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _kanbanCardHtml(t) {
  const m = getMat(t.matId);
  const dc = dueClass(t.due);
  const tagsHtml = (t.tags||[]).map(tg=>`<span class="tag-chip">#${tg}</span>`).join('');
  return `<div class="kanban-card" draggable="true" data-id="${t.id}"
    ondragstart="kCardDragStart(event,'${t.id}')" onclick="openTaskModal('${t.id}')">
    <div class="kc-title">${t.title}</div>
    <div class="kc-meta">
      <span style="color:${m.color||'var(--accent)'};">${m.icon||'📚'} ${m.code||'?'}</span>
      ${prioBadge(t.priority)}
      ${t.due ? `<span class="task-due ${dc}">📅 ${fmtD(t.due)}</span>` : ''}
      ${t.timeEst ? `<span>⏱ ${t.timeEst>=60?(t.timeEst/60)+'h':t.timeEst+'min'}</span>` : ''}
    </div>
    ${tagsHtml ? `<div style="margin-top:6px;">${tagsHtml}</div>` : ''}
  </div>`;
}

let _kDragId = null;
function kCardDragStart(e, id) { _kDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function kDragOver(e, colId) { e.preventDefault(); document.getElementById('kcol-'+colId)?.classList.add('over'); }
function kDragLeave(e) { e.currentTarget.classList.remove('over'); }
function kDrop(e, colId) {
  e.preventDefault();
  e.currentTarget.classList.remove('over');
  if (!_kDragId) return;
  const t = State.tasks.find(x => x.id === _kDragId);
  if (t) {
    t.kanbanCol = colId;
    if (colId === 'done') { const wasDone = t.done; t.done = true; if (!wasDone) _uiClick('task-done'); }
    else if (colId === 'todo') t.done = false;
    saveState(['tasks']); updateBadge(); renderKanban(); renderOverview();
  }
  _kDragId = null;
}

// ── TASK DRAG & DROP (list reorder) ──────────────────────────
let _taskDragId = null;
function taskDragStart(e, id) { _taskDragId = id; e.dataTransfer.effectAllowed = 'move'; }
function taskDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function taskDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function taskDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_taskDragId || _taskDragId === targetId) return;
  const tasks = State.tasks;
  const fromIdx = tasks.findIndex(t => t.id === _taskDragId);
  const toIdx   = tasks.findIndex(t => t.id === targetId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = tasks.splice(fromIdx, 1);
  tasks.splice(toIdx, 0, moved);
  saveState(['tasks']); renderTasks();
  _taskDragId = null;
}

// ── FLASHCARDS ───────────────────────────────────────────────
function _getFlashcards() {
  return JSON.parse(localStorage.getItem('academia_flashcards') || '[]');
}
function _saveFlashcards(arr) { localStorage.setItem('academia_flashcards', JSON.stringify(arr)); }

function renderFlashcards() {
  const container = document.getElementById('flashcards-container');
  if (!container) return;
  const cards = _getFlashcards();

  // Fill mat select
  const fcMat = document.getElementById('fc-mat');
  if (fcMat && !fcMat.children.length) {
    fcMat.innerHTML = '<option value="">— General —</option>';
    State.materias.forEach(m => { const o = document.createElement('option'); o.value=m.id; o.textContent=`${m.icon||'📚'} ${m.name}`; fcMat.appendChild(o); });
  }

  if (!cards.length) {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);">
      <div style="font-size:48px;margin-bottom:12px;">🃏</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:8px;">Sin flashcards aún</div>
      <div style="font-size:12px;margin-bottom:16px;">Crea tarjetas para estudiar o selecciona texto en una nota</div>
      <button class="btn btn-primary" onclick="openNewFlashcardModal()">+ Primera flashcard</button>
    </div>`;
    return;
  }

  // Group by mat
  const byMat = {};
  cards.forEach(c => { const k = c.matId||'general'; if (!byMat[k]) byMat[k] = []; byMat[k].push(c); });

  let html = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
    <span style="font-size:12px;color:var(--text3);">${cards.length} tarjetas totales · </span>
    <span style="font-size:12px;color:var(--green);">${cards.filter(c=>c.score>=2).length} dominadas</span>
    <span style="font-size:12px;color:var(--yellow);">· ${cards.filter(c=>c.score===1).length} practicando</span>
    <span style="font-size:12px;color:var(--red);">· ${cards.filter(c=>!c.score).length} nuevas</span>
    ${cards.filter(c=>c.nextReview && c.nextReview<=Date.now()).length > 0 ? `<span style="font-size:12px;color:#f97316;font-weight:700;">· ⏰ ${cards.filter(c=>c.nextReview && c.nextReview<=Date.now()).length} para revisar hoy</span>` : ''}
  </div>`;

  Object.entries(byMat).forEach(([matId, mCards]) => {
    const m = matId === 'general' ? { name:'General', icon:'📋' } : getMat(matId);
    html += `<div style="margin-bottom:20px;">
      <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;">${m.icon||'📚'} ${m.name}</div>
      <div class="fc-grid">
        ${mCards.map(c => {
          const isOverdue = c.nextReview && c.nextReview <= Date.now();
          const daysUntil = c.nextReview ? Math.ceil((c.nextReview - Date.now()) / 86400000) : null;
          const reviewBadge = c.nextReview
            ? `<div style="font-size:9px;font-family:'Space Mono',monospace;margin-top:5px;color:${isOverdue?'#f87171':daysUntil<=1?'#fbbf24':'var(--text3)'};">⏰ ${isOverdue?'¡Revisar hoy!':daysUntil===0?'Revisar hoy':'Revisar en '+daysUntil+'d'}</div>`
            : '';
          return `<div class="fc-card" onclick="openNewFlashcardModal('${c.id}')">
          <div class="fc-front">${c.front}</div>
          <div class="fc-back-preview">${(c.back||'').slice(0,60)}${c.back?.length>60?'…':''}</div>
          ${(c.tags||[]).map(t=>`<span class="fc-tag">#${t}</span>`).join('')}
          <div class="fc-score-bar"><div class="fc-score-fill" style="width:${(c.score||0)*50}%;background:${c.score>=2?'var(--green)':c.score===1?'var(--yellow)':'var(--red)'}"></div></div>
          ${reviewBadge}
        </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function openNewFlashcardModal(editId) {
  const cards = _getFlashcards();
  const c = editId ? cards.find(x => x.id === editId) : null;
  document.getElementById('fc-edit-id').value = editId || '';
  document.getElementById('fc-modal-title').textContent = editId ? '✏️ Editar Flashcard' : '🃏 Nueva Flashcard';
  document.getElementById('fc-front').value = c?.front || '';
  document.getElementById('fc-back').value  = c?.back  || '';
  document.getElementById('fc-tags').value  = (c?.tags||[]).join(', ');
  // Fill mat select
  const fcMat = document.getElementById('fc-mat');
  if (fcMat) {
    if (!fcMat.children.length) {
      fcMat.innerHTML = '<option value="">— General —</option>';
      State.materias.forEach(m => { const o = document.createElement('option'); o.value=m.id; o.textContent=`${m.icon||'📚'} ${m.name}`; fcMat.appendChild(o); });
    }
    fcMat.value = c?.matId || '';
  }
  _uiClick('modal-open');
  document.getElementById('modal-flashcard').classList.add('open');
}

function saveFlashcard() {
  const front = document.getElementById('fc-front').value.trim();
  const back  = document.getElementById('fc-back').value.trim();
  if (!front) { document.getElementById('fc-front').style.borderColor='var(--red)'; return; }
  document.getElementById('fc-front').style.borderColor = '';
  const cards = _getFlashcards();
  const editId = document.getElementById('fc-edit-id').value;
  const tags = (document.getElementById('fc-tags').value||'').split(',').map(t=>t.trim()).filter(Boolean);
  const matId = document.getElementById('fc-mat').value;
  if (editId) {
    const idx = cards.findIndex(c => c.id === editId);
    if (idx>=0) { cards[idx] = { ...cards[idx], front, back, tags, matId }; }
  } else {
    cards.push({ id: 'fc_'+Date.now(), front, back, tags, matId, score:0, createdAt:Date.now() });
  }
  _saveFlashcards(cards);
  closeModal('modal-flashcard');
  renderFlashcards();
  _uiClick('save');
}

function deleteFlashcard(id) {
  const cards = _getFlashcards().filter(c => c.id !== id);
  _saveFlashcards(cards);
  renderFlashcards();
}

// Create flashcard from selected note text
function createFlashcardFromSelection() {
  const sel = window.getSelection()?.toString().trim();
  if (!sel) { alert('Selecciona texto en la nota primero'); return; }
  openNewFlashcardModal();
  setTimeout(() => { document.getElementById('fc-front').value = sel; }, 50);
}

// ── FLASHCARD STUDY MODE ──────────────────────────────────────
let _studyDeck = [], _studyIdx = 0, _studyFlipped = false;

function startFlashcardStudy() {
  const cards = _getFlashcards();
  if (!cards.length) { alert('No tienes flashcards aún. ¡Crea algunas primero!'); return; }
  // Prioritize: overdue first, then unseen/low-score
  const now = Date.now();
  _studyDeck = [...cards].sort((a,b) => {
    const aOverdue = a.nextReview && a.nextReview <= now ? 0 : 1;
    const bOverdue = b.nextReview && b.nextReview <= now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return (a.score||0) - (b.score||0);
  });
  _studyIdx = 0;
  _studyFlipped = false;
  _uiClick('modal-open');
  document.getElementById('modal-fc-study').classList.add('open');
  _renderStudyCard();
}

function _renderStudyCard() {
  if (_studyIdx >= _studyDeck.length) {
    // Done!
    document.getElementById('fc-study-text').textContent = '¡Terminaste el mazo! 🎉';
    document.getElementById('fc-study-side').textContent = 'COMPLETADO';
    document.getElementById('fc-study-actions').style.display = 'none';
    document.getElementById('fc-study-flip-hint').textContent = 'Cierra para terminar';
    document.getElementById('fc-study-progress').textContent = `${_studyDeck.length} / ${_studyDeck.length}`;
    _uiClick('task-done');
    return;
  }
  const c = _studyDeck[_studyIdx];
  _studyFlipped = false;
  document.getElementById('fc-study-progress').textContent = `${_studyIdx+1} / ${_studyDeck.length}`;
  const m = c.matId ? getMat(c.matId) : { name:'General', icon:'📋' };
  document.getElementById('fc-study-mat').textContent = `${m.icon||'📚'} ${m.name}`;
  document.getElementById('fc-study-side').textContent = 'PREGUNTA';
  document.getElementById('fc-study-text').textContent = c.front;
  document.getElementById('fc-study-actions').style.display = 'none';
  document.getElementById('fc-study-flip-hint').style.display = 'block';
  document.getElementById('fc-card-wrap').style.borderColor = 'var(--border2)';
  const nrEl = document.getElementById('fc-study-next-review');
  if (nrEl) nrEl.style.display = 'none';
}

function flipStudyCard() {
  if (_studyIdx >= _studyDeck.length) return;
  if (_studyFlipped) return;
  _studyFlipped = true;
  const c = _studyDeck[_studyIdx];
  const wrap = document.getElementById('fc-card-wrap');
  wrap.style.animation = 'fc-flip .3s ease';
  setTimeout(() => {
    wrap.style.animation = '';
    document.getElementById('fc-study-side').textContent = 'RESPUESTA';
    document.getElementById('fc-study-text').textContent = c.back || '(sin respuesta)';
    document.getElementById('fc-study-actions').style.display = 'flex';
    document.getElementById('fc-study-flip-hint').style.display = 'none';
    wrap.style.borderColor = 'var(--accent)';
    // Show current interval info
    const nrEl = document.getElementById('fc-study-next-review');
    if (nrEl) {
      const intervalDays = c.intervalDays || 1;
      nrEl.style.display = 'block';
      nrEl.textContent = `Intervalo actual: ${intervalDays} día${intervalDays!==1?'s':''}${c.nextReview ? ' · Próx. repaso: ' + new Date(c.nextReview).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''}`;
    }
  }, 150);
}

function fcRate(score) {
  // score: 2=easy, 1=medium, 0=hard
  const c = _studyDeck[_studyIdx];
  const cards = _getFlashcards();
  const idx = cards.findIndex(x => x.id === c.id);
  if (idx >= 0) {
    const card = cards[idx];
    // Update score
    card.score = Math.max(0, Math.min(2, (card.score||0) + (score===2?1 : score===1?0 : -1)));
    card.lastStudied = Date.now();
    // Spaced repetition: calculate nextReview
    const now = Date.now();
    let intervalDays;
    if (score === 2) {        // Fácil
      const prev = card.intervalDays || 1;
      intervalDays = Math.round(prev * 2.5);
    } else if (score === 1) { // Media
      intervalDays = card.intervalDays || 1;
    } else {                  // Difícil
      intervalDays = 1;
    }
    intervalDays = Math.max(1, Math.min(intervalDays, 90));
    card.intervalDays = intervalDays;
    card.nextReview   = now + intervalDays * 86400000;
    _saveFlashcards(cards);
  }
  _studyIdx++;
  if (score === 2) _uiClick('save'); else _uiClick('click');
  _renderStudyCard();
}

// ── NOTES SEARCH ─────────────────────────────────────────────
function openModal(id) {
  _uiClick('modal-open');
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('open');
    // Auto-focus search input if present
    setTimeout(() => { el.querySelector('input[autofocus], input[type="text"]')?.focus(); }, 80);
  }
}

function renderNotesSearchResults() {
  const q = (document.getElementById('notes-search-inp')?.value || '').toLowerCase().trim();
  const container = document.getElementById('notes-search-results');
  if (!container) return;
  if (!q) { container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Escribe para buscar...</div>'; return; }

  const notes = _getNotesArray();
  const results = notes.filter(n =>
    (n.title||'').toLowerCase().includes(q) ||
    (n.content||'').toLowerCase().includes(q) ||
    (n.tags||[]).some(t => t.toLowerCase().includes(q))
  );

  if (!results.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px;">Sin resultados para "${q}"</div>`;
    return;
  }

  container.innerHTML = results.map(n => {
    const mat = n.matId ? State.materias.find(m => m.id === n.matId) : null;
    // Highlight matching text in content
    const content = (n.content||'').replace(/\n/g,' ');
    const qIdx = content.toLowerCase().indexOf(q);
    const snippet = qIdx >= 0
      ? '…' + content.slice(Math.max(0,qIdx-30), qIdx+80) + '…'
      : content.slice(0, 80);
    const highlighted = snippet.replace(new RegExp(q,'gi'), m => `<mark style="background:rgba(124,106,255,.3);color:var(--accent2);border-radius:2px;">${m}</mark>`);
    return `<div onclick="closeModal('modal-notes-search');goPage('notas',document.querySelector('[onclick*=notas]'));setTimeout(()=>selectProNote('${n.id}'),300);"
      style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">${(n.title||'Sin título').replace(new RegExp(q,'gi'), m=>`<mark style="background:rgba(124,106,255,.3);color:var(--accent2);">${m}</mark>`)}</div>
      <div style="font-size:11px;color:var(--text3);">${highlighted}</div>
      ${mat ? `<div style="font-size:10px;color:var(--text3);margin-top:3px;">${mat.icon||'📚'} ${mat.name}</div>` : ''}
    </div>`;
  }).join('');
}

// ── NOTE TAGS ─────────────────────────────────────────────────
function onNoteTagsInput() {
  if (!_currentNoteId) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  note.tags = (document.getElementById('notes-tags-inp')?.value || '').split(',').map(t=>t.trim()).filter(Boolean);
  _renderTagsDisplay(note.tags);
  _scheduleAutoSave();
}
function _renderTagsDisplay(tags) {
  const d = document.getElementById('notes-tags-display');
  if (d) d.innerHTML = tags.map(t=>`<span class="tag-chip active">#${t}</span>`).join('');
}

// Tags are now populated directly in _loadNoteInProEditor above

// ── RICH TEXT EDITOR (RTE) ────────────────────────────────────

function onRteInput() {
  if (!_currentNoteId) return;
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (note) note.content = rte.innerHTML;
  _updateWordCount(rte.textContent || '');
  _scheduleAutoSave();
}

function onRteKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
  }
  setTimeout(rteUpdateToolbarState, 10);
}

function rteExec(cmd, val) {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  rte.focus();
  document.execCommand(cmd, false, val || null);
  rteUpdateToolbarState();
  onRteInput();
}

function rteApplyHeading(tag) {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  rte.focus();
  document.execCommand('formatBlock', false, tag);
  rteUpdateToolbarState();
  onRteInput();
  setTimeout(() => { const s = document.getElementById('rte-heading'); if(s) s.value = 'p'; }, 50);
}

function rteUpdateToolbarState() {
  const cmds = ['bold','italic','underline','strikeThrough'];
  const ids  = ['rte-bold','rte-italic','rte-underline','rte-strikethrough'];
  cmds.forEach((cmd, i) => {
    const btn = document.getElementById(ids[i]);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

function rteCopyFormatted() {
  const rte = document.getElementById('notes-rte');
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!rte || !note) return;
  const styledHtml = `<h2 style="font-family:Georgia,serif;">${note.title||'Nota'}</h2>` + rte.innerHTML;
  try {
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const blobPlain = new Blob([rte.textContent], { type: 'text/plain' });
    const data = new ClipboardItem({ 'text/html': blob, 'text/plain': blobPlain });
    navigator.clipboard.write([data]).then(() => {
      const ind = document.getElementById('notes-autosave-indicator');
      if (ind) { ind.textContent = '📋 Copiado con formato!'; setTimeout(()=>{ ind.textContent='—'; },2500); }
    }).catch(() => {
      const range = document.createRange();
      range.selectNodeContents(rte);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
    });
  } catch(e) {
    const range = document.createRange();
    range.selectNodeContents(rte);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('copy'); sel.removeAllRanges();
  }
}

function rteCopyPlain() {
  const rte = document.getElementById('notes-rte');
  if (!rte) return;
  navigator.clipboard.writeText(rte.textContent || '').then(() => {
    const ind = document.getElementById('notes-autosave-indicator');
    if (ind) { ind.textContent = '📄 Texto copiado!'; setTimeout(()=>{ ind.textContent='—'; },2000); }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = rte.textContent || '';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  });
}

function _handleRtePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file && _currentNoteId) {
        const note = _getNotesArray().find(n => n.id === _currentNoteId);
        if (note) {
          const key = 'img_' + Date.now();
          const reader = new FileReader();
          reader.onload = async ev => {
            try {
              const idbKey = 'note_img_' + Date.now();
              await idbSaveImage(idbKey, ev.target.result);
              if (!note.images) note.images = {};
              note.images[key] = 'IDB:' + idbKey;
            } catch {
              if (!note.images) note.images = {};
              note.images[key] = ev.target.result;
            }
            saveState(['all']); _renderImagesStrip(note);
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }
  }
}

function _plaintextToRteHtml(text) {
  if (!text) return '';
  if (text.trim().startsWith('<')) return text;
  const lines = text.split('\n');
  let html = '';
  let inCodeBlock = false, codeBuffer = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCodeBlock) { html += `<pre><code>${_rteEsc(codeBuffer.trim())}</code></pre>`; codeBuffer=''; inCodeBlock=false; }
      else { inCodeBlock=true; }
      continue;
    }
    if (inCodeBlock) { codeBuffer+=line+'\n'; continue; }
    if (/^# /.test(line))   { html+=`<h1>${_rteEsc(line.slice(2))}</h1>`; continue; }
    if (/^## /.test(line))  { html+=`<h2>${_rteEsc(line.slice(3))}</h2>`; continue; }
    if (/^### /.test(line)) { html+=`<h3>${_rteEsc(line.slice(4))}</h3>`; continue; }
    if (/^[-*] /.test(line)){ html+=`<ul><li>${_rteEsc(line.slice(2))}</li></ul>`; continue; }
    if (/^\d+\. /.test(line)){html+=`<ol><li>${_rteEsc(line.replace(/^\d+\. /,''))}</li></ol>`; continue; }
    if (/^> /.test(line))   { html+=`<blockquote>${_rteEsc(line.slice(2))}</blockquote>`; continue; }
    if (!line.trim())       { html+='<p><br></p>'; continue; }
    if (/^[=\-]{3,}$/.test(line)){ html+='<hr>'; continue; }
    html+=`<p>${_rteEscInline(line)}</p>`;
  }
  return html || '<p></p>';
}
function _rteEsc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _rteEscInline(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
}

// ── END RICH TEXT EDITOR ──────────────────────────────────────


// ── EXPORT NOTE ───────────────────────────────────────────────
function exportCurrentNote() {
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const title = note.title || 'nota';
  const content = note.content || '';
  const isHtml = content.trim().startsWith('<') || /<[bhi][1-3rp][\s>]/i.test(content);
  if (isHtml) {
    const htmlDoc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${note.title||'Nota'}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 30px;line-height:1.8;color:#1a1a2e;}h1{font-size:26px;border-bottom:2px solid #7c6aff;padding-bottom:8px;}h2{font-size:20px;margin-top:28px;}h3{font-size:16px;color:#7c6aff;}blockquote{border-left:3px solid #7c6aff;padding:8px 16px;margin:12px 0;color:#555;background:#f5f3ff;border-radius:0 6px 6px 0;}code{font-family:monospace;background:#f0f0f0;padding:2px 6px;border-radius:4px;}ul,ol{padding-left:28px;}</style>
</head><body><h1>${note.title||'Sin título'}</h1><p style="color:#888;font-size:13px;margin-bottom:24px;">Exportado el ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>${content}</body></html>`;
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_').slice(0,50)}.html`;
    a.click(); URL.revokeObjectURL(url);
  } else {
    const text = `${note.title||'Sin título'}\n${'='.repeat(40)}\n\n${content}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g,'_').slice(0,50)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
  _uiClick('save');
}

// ── NOTE TEMPLATES ────────────────────────────────────────────
const NOTE_TEMPLATES = {
  clase: `# Clase — [Tema]
Fecha: ${new Date().toLocaleDateString('es-ES')}
Materia: 

## Objetivos
- 

## Conceptos clave
- 

## Ejemplos
- 

## Dudas / Preguntas
- 

## Tarea para próxima clase
- `,
  parcial: `# Repaso Parcial — [Materia]
Fecha del parcial: 

## Temas que entran
1. 
2. 
3. 

## Fórmulas importantes
\`\`\`

\`\`\`

## Conceptos clave
- 

## Lo que debo repasar más
- [ ] 
- [ ] 

## Notas del profe
- `,
  laboratorio: `# Laboratorio — [Número y Nombre]
Fecha: ${new Date().toLocaleDateString('es-ES')}
Materia: 
Integrantes: 

## Objetivos
1. 

## Materiales
- 

## Procedimiento
1. 

## Resultados / Datos
| Medición | Valor | Unidad |
|----------|-------|--------|
|          |       |        |

## Análisis y conclusiones
- 

## Preguntas del informe
1. `,
};

function openNoteTemplateMenu() {
  const menu = `<div style="position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;" onclick="this.remove()">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;min-width:280px;box-shadow:var(--shadow);" onclick="event.stopPropagation()">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px;">📋 Elegir plantilla</div>
      ${Object.entries({clase:'🎓 Apuntes de clase',parcial:'📝 Repaso para parcial',laboratorio:'🔬 Informe de laboratorio'})
        .map(([k,v]) => `<button class="btn btn-ghost" style="width:100%;text-align:left;margin-bottom:6px;" onclick="applyNoteTemplate('${k}');this.closest('[style*=fixed]').remove();">${v}</button>`).join('')}
      <button class="btn btn-ghost" style="width:100%;text-align:left;color:var(--text3);" onclick="this.closest('[style*=fixed]').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', menu);
}

function applyNoteTemplate(key) {
  if (!_currentNoteId) { addNewNote(); setTimeout(()=>applyNoteTemplate(key), 200); return; }
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  const plainText = NOTE_TEMPLATES[key] || '';
  const htmlContent = _plaintextToRteHtml(plainText);
  note.content = htmlContent;
  const rte = document.getElementById('notes-rte');
  if (rte) rte.innerHTML = htmlContent;
  saveState(['all']);
  _uiClick('save');
}

// Template button is rendered via applyNoteTemplate() called from HTML


// Streak is now updated directly inside toggleTask above


// Hoy badge update is handled inside updateBadge() directly

// Hoy badge is now updated directly inside updateBadge above

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  updateBadge(); // also updates hoy badge
  // Add "Flashcard" button to note editor toolbar when note is selected
});

// Add "🃏 Flashcard" and "📋 Plantilla" buttons to notes title toolbar
// Use MutationObserver instead of setInterval to avoid polling
(function _patchNotesToolbar() {
  function _tryInject() {
    const wrap = document.getElementById('notes-title-wrap');
    if (!wrap) return false;
    const row = wrap.querySelector('div[style*="display:flex"]');
    if (row && !row.querySelector('#btn-fc-from-note')) {
      const fcBtn = document.createElement('button');
      fcBtn.id = 'btn-fc-from-note';
      fcBtn.className = 'btn btn-ghost btn-sm';
      fcBtn.title = 'Crear flashcard del texto seleccionado';
      fcBtn.textContent = '🃏';
      fcBtn.onclick = createFlashcardFromSelection;
      const tplBtn = document.createElement('button');
      tplBtn.className = 'btn btn-ghost btn-sm';
      tplBtn.title = 'Aplicar plantilla';
      tplBtn.textContent = '📋';
      tplBtn.onclick = openNoteTemplateMenu;
      const canvasBtn = row.querySelector('[title*="canvas"]');
      if (canvasBtn) { row.insertBefore(tplBtn, canvasBtn); row.insertBefore(fcBtn, canvasBtn); }
      else { row.appendChild(fcBtn); row.appendChild(tplBtn); }
    }
    return true;
  }
  if (!_tryInject()) {
    const obs = new MutationObserver(() => { if (_tryInject()) obs.disconnect(); });
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();

// ══════════════════════════════════════════════════════════════
// CRONÓMETRO INTELIGENTE — 3 contadores
//   chronoWorkSec  = solo cuenta cuando el pomodoro está corriendo
//   chronoBreakSec = cuenta en fase descanso (pom corriendo o manual)
//   chronoTotalSec = siempre cuenta desde que se inicia (tiempo real)
// ══════════════════════════════════════════════════════════════
var chronoR        = false;    // cronómetro activo (total siempre corre)
var chronoPhase    = 'work';   // 'work' | 'break'
var chronoPomLive  = false;    // true solo cuando pomodoro está running
var chronoWorkSec  = 0;
var chronoBreakSec = 0;
var chronoTotalSec = 0;        // tiempo real (no para con pausa del pom)
var chronoI        = null;

function _chronoFmt(s) {
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function _chronoTickStart() {
  if (chronoI) clearInterval(chronoI);
  chronoI = setInterval(() => {
    if (!chronoR) return;
    // Total siempre corre
    chronoTotalSec++;
    // Trabajo: solo si pom está vivo Y fase es trabajo
    if (chronoPomLive && chronoPhase === 'work') chronoWorkSec++;
    // Descanso: si fase es descanso (independiente de pausa)
    else if (chronoPhase === 'break') chronoBreakSec++;
    // Si es independiente (sin pom): ambos work/break cuentan normalmente
    else if (!chronoPomLive && chronoPhase === 'work') chronoWorkSec++;
    _chronoUpdateUI();
  }, 1000);
}

function _chronoUpdateUI() {
  const wEl  = document.getElementById('chrono-work');
  const bEl  = document.getElementById('chrono-break');
  const tEl  = document.getElementById('chrono-total');
  const stEl = document.getElementById('chrono-status');
  const pctEl= document.getElementById('chrono-pct');
  const barEl= document.getElementById('chrono-bar');
  const wBlk = document.getElementById('chrono-work-block');
  const bBlk = document.getElementById('chrono-break-block');
  const tBlk = document.getElementById('chrono-total-block');

  if (wEl) wEl.textContent = _chronoFmt(chronoWorkSec);
  if (bEl) bEl.textContent = _chronoFmt(chronoBreakSec);
  if (tEl) tEl.textContent = _chronoFmt(chronoTotalSec);

  // Highlight: work pulses when pom is live+work, break when in break
  const workActive  = chronoR && chronoPomLive && chronoPhase === 'work';
  const workIndep   = chronoR && !chronoPomLive && chronoPhase === 'work';
  const breakActive = chronoR && chronoPhase === 'break';
  if (wBlk) {
    wBlk.style.opacity     = (workActive || workIndep) ? '1' : '0.45';
    wBlk.style.borderColor = (workActive || workIndep) ? 'rgba(74,222,128,.6)' : 'rgba(74,222,128,.2)';
    wBlk.style.boxShadow   = (workActive || workIndep) ? '0 0 20px rgba(74,222,128,.15)' : 'none';
  }
  if (bBlk) {
    bBlk.style.opacity     = breakActive ? '1' : '0.45';
    bBlk.style.borderColor = breakActive ? 'rgba(96,165,250,.6)' : 'rgba(96,165,250,.2)';
    bBlk.style.boxShadow   = breakActive ? '0 0 20px rgba(96,165,250,.15)' : 'none';
  }
  if (tBlk) {
    tBlk.style.opacity = chronoR ? '1' : '0.6';
  }

  // Status
  if (stEl) {
    if (!chronoR && chronoTotalSec === 0) stEl.textContent = '⏹ Detenido — presiona Iniciar';
    else if (!chronoR) stEl.textContent = '⏸ Pausado (tiempo real también detenido)';
    else if (chronoPomLive && chronoPhase === 'work')  stEl.textContent = '📚 Pomodoro corriendo — tiempo efectivo acumulando';
    else if (!chronoPomLive && chronoPhase === 'work') stEl.textContent = '📚 Modo independiente — estudiando';
    else stEl.textContent = '☕ Descansando — tiempo real sigue corriendo';
  }

  // Efficiency: work / total
  const pct = chronoTotalSec > 0 ? Math.round((chronoWorkSec / chronoTotalSec) * 100) : 0;
  if (pctEl) {
    pctEl.textContent = chronoTotalSec > 0 ? `${pct}%` : '—';
    pctEl.style.color = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
  }
}

function _chronoUpdateSwitchBtn() {
  const btn = document.getElementById('chrono-switch-btn');
  if (!btn) return;
  btn.textContent = chronoPhase === 'work' ? '☕ Cambiar a descanso' : '📚 Cambiar a estudio';
}

function chronoToggle() {
  const btn = document.getElementById('chrono-btn');
  if (chronoR) {
    chronoR = false;
    if (btn) btn.textContent = '▶ Continuar';
  } else {
    chronoR = true;
    // Sync phase with pom if running
    if (typeof pomR !== 'undefined' && pomR) {
      chronoPhase   = pomB ? 'break' : 'work';
      chronoPomLive = !pomB; // pomR is true means pom interval is running
      document.getElementById('chrono-mode-badge').textContent = 'POMODORO';
    } else {
      chronoPomLive = false;
      document.getElementById('chrono-mode-badge').textContent = 'INDEPENDIENTE';
    }
    if (btn) btn.textContent = '⏸ Pausar';
    if (!chronoI) _chronoTickStart();
  }
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

// Called from pomToggle when pom starts/pauses
function _chronoNotifyPomState(running, phase) {
  chronoPomLive = running;
  if (phase) chronoPhase = phase;
  if (running && !chronoR) {
    // Auto-start chrono when pom starts
    chronoR = true;
    document.getElementById('chrono-mode-badge').textContent = 'POMODORO';
    document.getElementById('chrono-btn').textContent = '⏸ Pausar';
    if (!chronoI) _chronoTickStart();
  }
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

function chronoSwitchPhase() {
  chronoPhase = chronoPhase === 'work' ? 'break' : 'work';
  _chronoUpdateSwitchBtn();
  _chronoUpdateUI();
}

function chronoReset() {
  if (chronoTotalSec > 0) {
    if (!confirm('¿Reiniciar el cronómetro? Se perderá el tiempo acumulado.')) return;
  }
  chronoR = false; chronoPhase = 'work'; chronoPomLive = false;
  chronoWorkSec = 0; chronoBreakSec = 0; chronoTotalSec = 0;
  if (chronoI) { clearInterval(chronoI); chronoI = null; }
  const btn   = document.getElementById('chrono-btn');
  const badge = document.getElementById('chrono-mode-badge');
  if (btn)   btn.textContent   = '▶ Iniciar';
  if (badge) badge.textContent = 'INDEPENDIENTE';
  document.getElementById('chrono-summary').style.display = 'none';
  _chronoUpdateUI();
  _chronoUpdateSwitchBtn();
}

function chronoSave() {
  if (chronoTotalSec < 60) {
    alert('Menos de 1 minuto registrado. ¡Estudia un poco más! 😄'); return;
  }
  chronoR = false; chronoPomLive = false;
  if (chronoI) { clearInterval(chronoI); chronoI = null; }
  const btn = document.getElementById('chrono-btn');
  if (btn) btn.textContent = '▶ Iniciar';

  const workMins  = Math.round(chronoWorkSec  / 60);
  const breakMins = Math.round(chronoBreakSec / 60);
  const totalMins = Math.round(chronoTotalSec / 60);
  const pct       = chronoTotalSec > 0 ? Math.round((chronoWorkSec / chronoTotalSec) * 100) : 0;

  const summary     = document.getElementById('chrono-summary');
  const summaryText = document.getElementById('chrono-summary-text');
  if (summary && summaryText) {
    summary.style.display = 'block';
    summaryText.innerHTML = [
      `📚 Efectivo &nbsp;: ${_chronoFmt(chronoWorkSec)} (${workMins} min)`,
      `☕ Descanso &nbsp;: ${_chronoFmt(chronoBreakSec)} (${breakMins} min)`,
      `⏱️ Tiempo real: ${_chronoFmt(chronoTotalSec)} (${totalMins} min)`,
      `📊 Eficiencia &nbsp;: <strong style="color:${pct>=70?'var(--green)':pct>=50?'var(--yellow)':'var(--red)'}">${pct}%</strong>`,
    ].join('<br>');
  }

  document.getElementById('chrono-mode-badge').textContent = 'GUARDADO';
  if (workMins >= 1) { _recordPomWeekSession(workMins); _updateStreak(); renderPomGoal(); }
  _chronoUpdateUI();
  alert(`✅ Sesión guardada!\n📚 Efectivo: ${workMins} min\n☕ Descanso: ${breakMins} min\n⏱️ Real: ${totalMins} min\n📊 ${pct}% eficiencia`);
}

// ═══ PDF ADJUNTO EN NOTAS — chip + visor iframe ═══
// Los PDFs se guardan como base64 en note.pdfAttachments = [{name, data}]

function loadPDFIntoNotes(filesInput) {
  const files = filesInput instanceof FileList
    ? Array.from(filesInput)
    : filesInput instanceof File
      ? [filesInput]
      : Array.isArray(filesInput) ? filesInput : [];

  if (!files.length) return;
  if (!_currentNoteId) { alert('Selecciona o crea una nota primero.'); return; }

  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note) return;
  if (!note.pdfAttachments) note.pdfAttachments = [];

  let loaded = 0;
  files.forEach(file => {
    if (file.type !== 'application/pdf') return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      if (!note.pdfAttachments.some(p => p.name === file.name)) {
        note.pdfAttachments.push({ name: file.name, data: base64 });
      }
      loaded++;
      if (loaded === files.length) {
        note.updatedAt = Date.now();
        saveState(['all']);
        _renderPDFStrip(note);
      }
    };
    reader.readAsDataURL(file);
  });
}

function _renderPDFStrip(note) {
  const strip = document.getElementById('notes-pdf-strip');
  if (!strip) return;
  const pdfs  = note && note.pdfAttachments && note.pdfAttachments.length ? note.pdfAttachments : [];

  if (!pdfs.length) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }

  strip.style.display = 'flex';
  strip.innerHTML = pdfs.map((pdf, i) => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface);border:1px solid var(--border2);border-radius:8px;cursor:pointer;max-width:220px;transition:border-color .15s;"
         onclick="openPDFModal('${_escAttr(pdf.name)}',${i})"
         onmouseover="this.style.borderColor='var(--accent)'"
         onmouseout="this.style.borderColor='var(--border2)'"
         title="Clic para visualizar — ${_escAttr(pdf.name)}">
      <span style="font-size:16px;flex-shrink:0;">📑</span>
      <span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${_escHtml(pdf.name)}</span>
      <button onclick="event.stopPropagation();removePDFAttachment(${i})"
        style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;padding:0 2px;line-height:1;"
        title="Quitar adjunto">✕</button>
    </div>`).join('');
}

function openPDFModal(name, idx) {
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note || !note.pdfAttachments) return;
  const pdf  = note.pdfAttachments[idx];
  if (!pdf) return;

  // Convertir base64 → Blob → object URL para que el iframe lo abra nativamente
  const byteString = atob(pdf.data.split(',')[1]);
  const ab   = new ArrayBuffer(byteString.length);
  const ia   = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);

  // En móvil, los iframes no renderizan PDFs — abrir en nueva pestaña
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const a = document.createElement('a');
    a.href   = url;
    a.target = '_blank';
    a.rel    = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  // Desktop: usar iframe normal
  const frame = document.getElementById('pdf-modal-frame');
  if (frame._blobUrl) URL.revokeObjectURL(frame._blobUrl);
  frame._blobUrl = url;
  frame.src      = url;

  document.getElementById('pdf-modal-name').textContent = name;
  const modal = document.getElementById('modal-pdf-view');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closePDFModal() {
  const modal = document.getElementById('modal-pdf-view');
  if (modal) modal.style.display = 'none';
  const frame = document.getElementById('pdf-modal-frame');
  if (frame) {
    frame.src = '';
    if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); frame._blobUrl = null; }
  }
  document.body.style.overflow = '';
}

function removePDFAttachment(idx) {
  const note = _getNotesArray().find(n => n.id === _currentNoteId);
  if (!note || !note.pdfAttachments) return;
  note.pdfAttachments.splice(idx, 1);
  note.updatedAt = Date.now();
  saveState(['all']);
  _renderPDFStrip(note);
}

// Helpers para escapar atributos y HTML
function _escAttr(str) { return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function _escHtml(str) { return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Cerrar modal con Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const m = document.getElementById('modal-pdf-view');
    if (m && m.style.display !== 'none') closePDFModal();
  }
});

// ═══ FOCUS MODE ═══
function enterFocusMode() {
  // Crear overlay focus mode
  const focusOverlay = document.createElement('div');
  focusOverlay.id = 'focus-mode-overlay';
  focusOverlay.className = 'focus-mode-container';
  
  // Obtener tiempo actual del pomodoro
  const pomTimeEl = document.getElementById('pom-time');
  const currentTime = pomTimeEl ? pomTimeEl.textContent : '25:00';
  
  focusOverlay.innerHTML = `
    <button class="focus-exit-btn" onclick="exitFocusMode()">✕ Salir Focus</button>
    
    <div style="display:flex;flex-direction:column;align-items:center;gap:40px;">
      <div class="focus-timer" id="focus-timer">${currentTime}</div>
      
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;">
        <button onclick="focusTogglePom()" style="padding:12px 24px;font-size:14px;background:var(--accent);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;transition:all .2s;" id="focus-pom-btn">▶ Iniciar</button>
        <button onclick="focusResetPom()" style="padding:12px 24px;font-size:14px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-weight:700;cursor:pointer;transition:all .2s;">↻ Reiniciar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(focusOverlay);
  document.body.style.overflow = 'hidden';
  
  // Variables de control
  let focusTime = 25 * 60; // 25 minutos en segundos
  let focusRunning = false;
  let focusInterval = null;
  
  // Sincronizar con el pomodoro real si está corriendo
  if (document.getElementById('pom-btn')) {
    const pomBtn = document.getElementById('pom-btn');
    if (pomBtn.textContent.includes('Pausar')) {
      focusRunning = true;
    }
  }
  
  // Función para actualizar display
  function updateFocusDisplay() {
    const mins = Math.floor(focusTime / 60);
    const secs = focusTime % 60;
    const timerEl = document.getElementById('focus-timer');
    if (timerEl) {
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }
  
  // Funciones globales para focus
  window.focusTogglePom = function() {
    const btn = document.getElementById('focus-pom-btn');
    if (focusRunning) {
      focusRunning = false;
      clearInterval(focusInterval);
      btn.textContent = '▶ Reanudar';
    } else {
      focusRunning = true;
      btn.textContent = '⏸ Pausar';
      focusInterval = setInterval(() => {
        focusTime--;
        updateFocusDisplay();
        if (focusTime <= 0) {
          focusTime = 25 * 60;
          focusRunning = false;
          clearInterval(focusInterval);
          btn.textContent = '▶ Iniciar';
          alert('🎉 ¡Sesión de enfoque completada!');
        }
      }, 1000);
    }
  };
  
  window.focusResetPom = function() {
    focusRunning = false;
    clearInterval(focusInterval);
    focusTime = 25 * 60;
    updateFocusDisplay();
    document.getElementById('focus-pom-btn').textContent = '▶ Iniciar';
  };
}

function exitFocusMode() {
  const overlay = document.getElementById('focus-mode-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.body.style.overflow = 'auto';
}

document.addEventListener('DOMContentLoaded', () => { _chronoUpdateUI(); _chronoUpdateSwitchBtn(); });

/* ─── DOM Cache: cache frequently-accessed nodes once at startup ─── */
const _DOM = {};
function _el(id) {
  if (!_DOM[id]) _DOM[id] = document.getElementById(id);
  return _DOM[id];
}
function _clearDOMCache() { for (const k in _DOM) delete _DOM[k]; }

/* ─── rAF Render Scheduler: batch multiple render() calls into one frame ─── */
const _pending = new Set();
let   _rafId   = null;
function _schedRender(fn) {
  _pending.add(fn);
  if (!_rafId) _rafId = requestAnimationFrame(() => {
    _rafId = null;
    const batch = [..._pending]; _pending.clear();
    batch.forEach(f => f());
  });
}

const DB_KEYS = {
  SEMESTRES: 'academia_v4_semestres',
  POM_TODAY: 'academia_v3_pom_today',
  POM_DATE:  'academia_v3_pom_date',
  SETTINGS:  'academia_v3_settings',
};

// ─── IndexedDB for large image data ────────────────────────────
let _idb = null;
function _openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('academia_images', 1);
    req.onupgradeneeded = e => { e.target.result.createObjectStore('images'); };
    req.onsuccess = e => { _idb = e.target.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}
async function idbSetImage(key, dataUrl) {
  try {
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readwrite');
      tx.objectStore('images').put(dataUrl, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  } catch(e) { console.warn('IDB set error', e); return false; }
}
async function idbGetImage(key) {
  try {
    const db = await _openIDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('images','readonly');
      const req = tx.objectStore('images').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch(e) { return null; }
}
async function idbDeleteImage(key) {
  try {
    const db = await _openIDB();
    return new Promise((res) => {
      const tx = db.transaction('images','readwrite');
      tx.objectStore('images').delete(key);
      tx.oncomplete = () => res(true);
    });
  } catch(e) { return false; }
}

const DEFAULT_MATERIAS = [];

const DEFAULT_SETTINGS = { minGrade: 70, theme: 'dark', semester: '1er Año · 2do Sem', font: 'Syne', soundVariant: 'classic', accentColor: '#7c6aff' };

function dbGet(key, fallback = null) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function dbSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('Storage error', e); }
}

(function _stripDemoCourses() {
  const DEMO_IDS = new Set(['mat1','mat2','mat3','mat4','mat5','mat6']);
  const MIGRATION_KEY = 'academia_v84_demo_stripped';
  if (localStorage.getItem(MIGRATION_KEY)) return;
  try {
    const raw = localStorage.getItem('academia_v4_semestres');
    if (!raw) { localStorage.setItem(MIGRATION_KEY,'1'); return; }
    const sems = JSON.parse(raw);
    let changed = false;
    sems.forEach(s => {
      const before = (s.materias||[]).length;
      s.materias = (s.materias||[]).filter(m => !DEMO_IDS.has(m.id));

      if (s.grades) DEMO_IDS.forEach(id => { delete s.grades[id]; });
      if (s.tasks)  s.tasks = s.tasks.filter(t => !DEMO_IDS.has(t.matId));
      if ((s.materias||[]).length !== before) changed = true;
    });
    if (changed) localStorage.setItem('academia_v4_semestres', JSON.stringify(sems));
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch(e) { console.warn('Demo strip failed', e); }
})();

function _buildDefaultSemester(id, nombre) {
  return {
    id,
    nombre,
    activo: true,
    cerrado: false,
    promedioObjetivo: 70,
    prevAvg:  0,
    prevCred: 0,
    materias:  [],
    grades:    {},
    tasks:     [],
    events:    [],
    topics:    [],
    notes:     {},
    notesArray: [],
  };
}

function _migrateLegacyData() {

  const oldMats = dbGet('academia_v3_materias', null);
  const sem = _buildDefaultSemester('sem_' + Date.now(), '1er Año · 2do Sem');
  sem.materias = oldMats || DEFAULT_MATERIAS;
  sem.grades   = dbGet('academia_v3_grades',  {});
  sem.tasks    = dbGet('academia_v3_tasks',   []);
  sem.events   = dbGet('academia_v3_events',  []);
  sem.topics   = dbGet('academia_v3_topics',  []);
  return [sem];
}

let _rawSemestres = dbGet(DB_KEYS.SEMESTRES, null);
if (!_rawSemestres || !Array.isArray(_rawSemestres) || !_rawSemestres.length) {
  _rawSemestres = _migrateLegacyData();
  dbSet(DB_KEYS.SEMESTRES, _rawSemestres);
}

if (!_rawSemestres.some(s => s.activo)) _rawSemestres[0].activo = true;

const State = {

  semestres: _rawSemestres,

  get _activeSem() {
    return this.semestres.find(s => s.activo) || this.semestres[0];
  },

  get materias()    { return this._activeSem.materias;           },
  set materias(v)   { this._activeSem.materias = v;              },
  get grades()      { return this._activeSem.grades;             },
  set grades(v)     { this._activeSem.grades   = v;              },
  get tasks()       { return this._activeSem.tasks;              },
  set tasks(v)      { this._activeSem.tasks    = v;              },
  get events()      { return this._activeSem.events;             },
  set events(v)     { this._activeSem.events   = v;              },
  get topics()      { return this._activeSem.topics;             },
  set topics(v)     { this._activeSem.topics   = v;              },
  get notes()       { return this._activeSem.notes  || (this._activeSem.notes = {}); },
  set notes(v)      { this._activeSem.notes    = v;              },
  get notesArray()  { return this._activeSem.notesArray || (this._activeSem.notesArray = []); },
  set notesArray(v) { this._activeSem.notesArray = v;            },

  pomSessions: (() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(DB_KEYS.POM_DATE) !== today) {
      dbSet(DB_KEYS.POM_TODAY, []); dbSet(DB_KEYS.POM_DATE, today); return [];
    }
    return dbGet(DB_KEYS.POM_TODAY, []);
  })(),
  settings: { ...DEFAULT_SETTINGS, ...dbGet(DB_KEYS.SETTINGS, {}) },
};

/* ─── Debounced save: batches rapid saveState calls into one write every 400ms ─── */
let _saveTimer = null;
let _pendingKeys = new Set();
function saveState(keys = ['all']) {
  keys.forEach(k => _pendingKeys.add(k));
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushSave, 400);
}
function _flushSave() {
  const keys = [..._pendingKeys]; _pendingKeys.clear(); _saveTimer = null;
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
}
function saveStateNow(keys = ['all']) {
  clearTimeout(_saveTimer); _pendingKeys.clear();
  const all = keys.includes('all');
  if (all || keys.includes('materias')) getMat.bust();
  dbSet(DB_KEYS.SEMESTRES, State.semestres);
  if (all || keys.includes('settings')) dbSet(DB_KEYS.SETTINGS, State.settings);
}
function savePom() {
  dbSet(DB_KEYS.POM_TODAY, State.pomSessions);
  dbSet(DB_KEYS.POM_DATE, new Date().toDateString());
}

function getActiveSem() { return State._activeSem; }

function switchSemester(id) {
  State.semestres.forEach(s => { s.activo = (s.id === id); });
  saveStateNow(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function createSemester(nombre, promedioObjetivo) {
  State.semestres.forEach(s => s.activo = false);
  const sem = _buildDefaultSemester('sem_' + Date.now(), nombre || 'Nuevo Semestre');
  sem.promedioObjetivo = parseFloat(promedioObjetivo) || 70;
  State.semestres.push(sem);
  saveState(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function closeSemester(id) {
  const s = State.semestres.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`¿Cerrar el semestre "${s.nombre}"? Quedará archivado y no podrás editarlo.`)) return;
  s.cerrado = true;
  s.activo  = false;

  const open = State.semestres.filter(x => !x.cerrado);
  if (open.length) open[open.length - 1].activo = true;
  saveState(['semestres']);
  _refreshAllViews();
  renderSemesterBadge();
}

function _refreshAllViews() {
  try {
    fillMatSels(); fillTopicMatSel(); fillPomSel(); fillNotesSel(); fillExamSel();
    renderOverview(); renderMaterias(); renderGrades();
    renderTasks(); renderCalendar(); updateBadge();
    renderSemestresList();
    updateGPADisplay();
  } catch(e) {  }
}

function parseCredits(credStr) {
  if (!credStr) return 0;
  const n = parseFloat(String(credStr).replace(/[^0-9.]/g,''));
  return isNaN(n) ? 0 : n;
}

function calcSemesterGPA(semId) {
  const sem = State.semestres.find(s => s.id === semId) || State._activeSem;
  const min = State.settings.minGrade || 70;
  const roots = sem.materias.filter(m => !m.parentId);

  let weightedSum = 0, totalCred = 0, creditosAprobados = 0;
  const materiaStats = roots.map(m => {
    const cred = parseCredits(m.credits);

    const savedActive = State.semestres.find(s => s.activo);

    const mGrades = sem.grades || {};
    let total = 0, filled = 0;
    if (m.zones) {
      m.zones.forEach(z => {
        if (z.isLabZone) {

          const lab = sem.materias.find(x => x.id === m.linkedLabId);
          if (lab) {
            let labGrade = mGrades[lab.id]?.nota ?? '';
            if (labGrade === '' && lab.zones?.[0]?.subs?.[0])
              labGrade = mGrades[lab.id]?.[lab.zones[0].subs[0].key] ?? '';
            if (labGrade !== '' && labGrade != null) {
              const scale  = m.labScale || 100;
              const maxPts = m.labMaxPts || 10;
              const net    = (Math.min(parseFloat(labGrade)||0, scale) / scale) * maxPts;
              total += Math.min(net, z.maxPts); filled++;
            }
          }
        } else {
          z.subs.forEach(s => {
            const v = mGrades[m.id]?.[s.key] ?? '';
            if (v !== '') { total += Math.min((parseFloat(v)||0)/100 * s.maxPts, s.maxPts); filled++; }
          });
        }
      });
    }
    const maxTotal = (m.zones||[]).reduce((a,z)=>a+z.maxPts,0) || 100;
    const nota     = filled ? total : null;
    const aprobado = nota !== null && nota >= min;
    if (nota !== null) {
      weightedSum     += nota * cred;
      totalCred       += cred;
      if (aprobado) creditosAprobados += cred;
    } else {
      totalCred += cred;
    }
    return { materia: m, nota, cred, maxTotal, aprobado };
  });

  const promedioSemestre = totalCred > 0 ? weightedSum / totalCred : null;
  return { promedioSemestre, totalCreditos: totalCred, creditosAprobados, materiaStats };
}

function calcOverallGPA() {
  const s        = State._activeSem;
  const prevAvg  = parseFloat(s.prevAvg)  || 0;
  const prevCred = parseFloat(s.prevCred) || 0;
  const g        = calcSemesterGPA(s.id);
  const semCred  = g.totalCreditos;
  const semAvg   = g.promedioSemestre;
  const totalCred   = prevCred + semCred;
  const approvedCred= prevCred + g.creditosAprobados;
  const overallAvg  =
    totalCred > 0 && (prevCred > 0 || semAvg !== null)
      ? (prevAvg * prevCred + (semAvg || 0) * semCred) / totalCred
      : semAvg;
  return { overallAvg, totalCred, approvedCred, semAvg, semCred };
}

function exportData() {
  const blob = new Blob([JSON.stringify({
    version: 4, exportedAt: new Date().toISOString(),
    semestres: State.semestres,
    settings:  State.settings,
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'academia-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click(); URL.revokeObjectURL(a.href);
}

function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);

    if (data.semestres && Array.isArray(data.semestres)) {
      State.semestres = data.semestres;
      if (!State.semestres.some(s => s.activo)) State.semestres[0].activo = true;
    } else if (data.materias) {

      const sem = _buildDefaultSemester('sem_legacy', 'Importado');
      sem.activo   = true;
      sem.materias = data.materias;
      sem.grades   = data.grades  || {};
      sem.tasks    = data.tasks   || [];
      sem.events   = data.events  || [];
      sem.topics   = data.topics  || [];
      State.semestres = [sem];
    } else throw new Error('Formato inválido');
    if (data.settings) State.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    saveState(['all']);
    return { ok: true, msg: 'Datos importados correctamente.' };
  } catch(e) { return { ok: false, msg: 'Error al importar: ' + e.message }; }
}

function exportPDF() {
  // Build a clean printable HTML report with only grades + GPA data
  const sem = getActiveSem ? getActiveSem() : (State.semestres?.find(s=>s.activo));
  const semName = sem?.nombre || 'Semestre';
  const mats = State.materias || [];
  const gpa  = calcOverallGPA ? calcOverallGPA() : {};
  const minG = parseFloat(document.getElementById('min-grade')?.value) || (State.settings?.minGrade || 70);

  let rows = '';
  mats.forEach(mat => {
    const t = calcTotal ? calcTotal(mat.id) : null;
    const avg = t ? t.total : null;
    const color = avg !== null ? (avg >= minG ? '#16a34a' : '#dc2626') : '#6b7280';
    const zones = mat.zones || [];
    let zoneRows = '';
    zones.forEach(z => {
      const pts = (State.grades?.[mat.id]?.[z.key] ?? '');
      const net = pts !== '' ? (parseFloat(pts)/100 * z.maxPts).toFixed(2) : '—';
      zoneRows += `<tr><td style="padding:4px 10px;color:#555;font-size:12px;">${z.label}</td><td style="text-align:center;font-size:12px;">${pts !== '' ? pts+'%' : '—'}</td><td style="text-align:center;font-size:12px;">${net !== '—' ? net+' / '+z.maxPts : '—'}</td></tr>`;
    });
    rows += `
      <tr style="background:#f8f8ff;">
        <td style="padding:8px 10px;font-weight:700;font-size:13px;border-left:3px solid ${mat.color||'#7c6aff'};">${mat.nombre}</td>
        <td style="text-align:center;font-weight:700;color:${color};font-size:13px;">${avg !== null ? avg.toFixed(1) : '—'}</td>
        <td style="text-align:center;font-size:12px;color:#555;">${mat.creditos || '—'} cr.</td>
        <td style="font-size:12px;color:#555;">${mat.seccion||''} ${mat.catedratico ? '· '+mat.catedratico : ''}</td>
      </tr>
      ${zoneRows ? `<tr><td colspan="4" style="padding:0 10px 6px 24px;"><table style="width:100%;border-collapse:collapse;">${zoneRows}</table></td></tr>` : ''}`;
  });

  const overallAvg = gpa.overallAvg !== null && gpa.overallAvg !== undefined ? gpa.overallAvg.toFixed(2) : '—';
  const semAvg     = gpa.semAvg     !== null && gpa.semAvg !== undefined     ? gpa.semAvg.toFixed(2)     : (calcSemesterGPA ? calcSemesterGPA(sem?.id)?.promedioSemestre?.toFixed(2) : '—');

  const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte Académico — ${semName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: 'Segoe UI', sans-serif; color:#1a1a2e; background:#fff; padding:32px 40px; }
  h1  { font-size:22px; font-weight:800; color:#1a1a2e; margin-bottom:4px; }
  .sub { font-size:13px; color:#666; margin-bottom:24px; }
  .gpa-row { display:flex; gap:24px; margin-bottom:28px; flex-wrap:wrap; }
  .gpa-box { background:#f5f3ff; border:1px solid #c4b5fd; border-radius:10px; padding:14px 20px; min-width:130px; }
  .gpa-lbl { font-size:10px; color:#7c3aed; letter-spacing:1.5px; text-transform:uppercase; font-weight:700; margin-bottom:4px; }
  .gpa-val { font-size:28px; font-weight:800; color:#4c1d95; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1a1a2e; color:#fff; padding:9px 10px; font-size:11px; letter-spacing:1px; text-align:left; }
  tr + tr { border-top:1px solid #e5e7eb; }
  .footer { margin-top:28px; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:12px; }
  @media print { body { padding:16px 24px; } }
</style>
</head><body>
<h1>📊 Reporte Académico</h1>
<div class="sub">${semName} · Generado el ${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
<div class="gpa-row">
  <div class="gpa-box"><div class="gpa-lbl">Promedio Semestre</div><div class="gpa-val">${semAvg || '—'}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Promedio Global</div><div class="gpa-val">${overallAvg}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Materias</div><div class="gpa-val">${mats.length}</div></div>
  <div class="gpa-box"><div class="gpa-lbl">Mínimo aprobatorio</div><div class="gpa-val">${minG}</div></div>
</div>
<table>
  <thead><tr><th>Materia</th><th style="text-align:center;">Promedio</th><th style="text-align:center;">Créditos</th><th>Catedrático / Sección</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Academia · academia.app</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;

  const win = window.open('','_blank','width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    // Fallback: blob download
    const blob = new Blob([html], {type:'text/html'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${semName.replace(/\s+/g,'_')}.html`;
    a.click();
  }
}

const HEX_COLORS = [
  '#7c6aff','#60a5fa','#4ade80','#fbbf24','#f472b6','#fb923c','#22d3ee','#a78bfa','#f87171','#34d399',
  '#10b981','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#14b8a6','#6366f1','#ef4444','#84cc16','#06b6d4',
  '#e11d48','#7c3aed'
];
const ICONS      = ['📚','🔬','🧪','📐','💻','📊','✏️','🧮','🌐','⚡','🎓','📋','🔭','🧬','📝',
                    '🏗️','🎯','🔐','🧠','📡','⚗️','🗜️','🔋','🧲','🎨','🛠️','📈','🔢'];
let newColorSel  = '#7c6aff';
let newIconSel   = '📚';
let zoneRowCount = 0;

const PAGE_TITLES = {
  overview:'Resumen', materias:'Materias', tareas:'Tareas',
  calendario:'Calendario', calificaciones:'Calificaciones',
  temas:'Temas del Curso', estadisticas:'Estadísticas', pomodoro:'Pomodoro',
  semestres:'Semestres', horario:'Mi Horario', notas:'Bloc de Notas',
  perfil:'Mi Perfil Académico', general:'General',
  flashcards:'Flashcards'
};

function goPage(id, el) {
  _uiClick('nav');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + id);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (el) el.classList.add('active');
  _el('page-title').textContent = PAGE_TITLES[id] || id;
  closeCompPopup();

  switch(id) {
    case 'overview':       renderOverview(); break;
    case 'materias':       renderMaterias(); break;
    case 'tareas':         fillMatSels(); document.getElementById('tf-mat').value=''; renderTasks(); break;
    case 'calendario':     fillMatSels(); renderCalendar(); break;
    case 'calificaciones': renderGrades(); break;
    case 'temas':          fillMatSels(); fillTopicMatSel(); renderTopics(); break;
    case 'estadisticas':   renderStats(); break;
    case 'pomodoro':       fillPomSel(); renderPomHistory(); renderPomGoal(); break;
    case 'semestres':      renderSemestresList(); break;
    case 'horario':        renderHorario(); break;
    case 'notas':          fillNotesSel(); renderNotesProPage(); break;
    case 'perfil':         renderProfilePage(); break;
    case 'general':        renderGeneralHub(); break;
    case 'flashcards':     renderFlashcards(); break;
  }
}

function fillMatSels() {
  const targets = ['t-mat','ev-mat','tp-mat','tf-mat'];
  targets.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    State.materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon||'📚'} ${m.name}`; el.appendChild(o);
    });
    if (prev) el.value = prev;
  });
  const tf = document.getElementById('tf-mat');
  if (tf) {
    tf.innerHTML = '<option value="">Todas las materias</option>';
    State.materias.forEach(m => {
      const o = document.createElement('option'); o.value = m.id;
      o.textContent = `${m.icon||'📚'} ${m.name}`; tf.appendChild(o);
    });

  }
}
function fillTopicMatSel() {
  const sel = document.getElementById('topics-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}
function fillPomSel() {
  const sel = document.getElementById('pom-subject'); if (!sel) return;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  // Also fill task selector
  const taskSel = document.getElementById('pom-task-sel');
  if (taskSel) {
    const prev = taskSel.value;
    taskSel.innerHTML = '<option value="">— Sin tarea específica —</option>';
    const pending = State.tasks.filter(t => !t.done);
    pending.forEach(t => {
      const m = getMat(t.matId);
      const o = document.createElement('option'); o.value = t.id;
      o.textContent = `${m.icon||'📚'} ${t.title}${t.due?' · '+fmtD(t.due):''}`;
      taskSel.appendChild(o);
    });
    if (prev) taskSel.value = prev;
  }
}
function fillNotesSel() {
  const sel = document.getElementById('notes-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.filter(m=>!m.parentId).forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}
function fillExamSel() {
  const sel = document.getElementById('exam-mat-sel'); if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Selecciona materia —</option>';
  State.materias.filter(m=>!m.parentId).forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; sel.appendChild(o);
  });
  if (prev) sel.value = prev;
}

function renderOverview() { _schedRender(_renderOverview); }

function renderMaterias() { _schedRender(_renderMaterias); }
function _renderMaterias() {
  const min  = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const grid = _el('materias-grid');
  if (!grid) return;
  const roots = State.materias.filter(m => !m.parentId);
  let html = '';

  roots.forEach(m => {
    const t        = calcTotal(m.id);
    const pts      = t ? t.total.toFixed(1) : '—';
    const maxPts   = m.zones.reduce((a,z) => a+z.maxPts, 0);
    const pct      = t ? t.pct : 0;
    const pend     = State.tasks.filter(x => x.matId===m.id && !x.done).length;
    const sc       = t ? (t.total>=min?'#4ade80':t.total>=min*.8?'#fbbf24':'#f87171') : '#5a5a72';
    const sl       = t ? (t.total>=min?'✓ Aprobado':t.total>=min*.8?'⚠ En zona':'✗ En riesgo') : 'Sin notas';
    const linkedLab= m.linkedLabId ? getMat(m.linkedLabId) : null;
    const labData  = m.linkedLabId ? getLabNetPts(m) : null;

    const zonaMin = State.settings?.zonaMin || 36, zonaGanada = State.settings?.zonaGanada || 61;
    const totalPts = t ? t.total : null;
    const isGanada = totalPts !== null && totalPts >= zonaGanada;
    const hasZona  = totalPts !== null && totalPts >= zonaMin;
    const usacBanner = totalPts !== null ? (
      isGanada
        ? `<div style="margin-top:8px;background:rgba(74,222,128,.15);border:2px solid #4ade80;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:800;color:#4ade80;display:flex;align-items:center;gap:6px;">🏆 GANADA — ${totalPts.toFixed(1)} pts ≥ 61</div>`
        : hasZona
          ? `<div class="usac-zona-min-ok" style="margin-top:8px;">✅ Zona mín. alcanzada (${totalPts.toFixed(1)} ≥ ${zonaMin}) — Faltan ${(zonaGanada-totalPts).toFixed(1)} pts para ganar</div>`
          : `<div class="usac-zona-min-no" style="margin-top:8px;">⚠ Sin zona mín. — Faltan ${(zonaMin-totalPts).toFixed(1)} pts</div>`
    ) : '';

    const cardStyle = isGanada
      ? `--mc:${m.color}; border:2px solid #4ade80; box-shadow:0 0 20px rgba(74,222,128,.2);`
      : `--mc:${m.color};`;

    const catedratico = m.catedratico ? `<div style="font-size:10px;color:var(--text3);">👤 ${m.catedratico}</div>` : '';
    const horarioInfo = (m.dias||m.horario) ? `<div style="font-size:10px;color:var(--text3);">🕐 ${[m.seccion,m.dias,m.horario].filter(Boolean).join(' · ')}</div>` : '';

    html += `<div class="mat-card" style="${cardStyle}">
      <div class="mat-card-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="padding-left:8px;">
            <div style="font-size:15px;font-weight:800;margin-bottom:3px;">${m.icon||'📚'} ${m.name} ${isGanada ? '🏆' : ''}</div>
            <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">${m.code} · ${m.credits}</div>
            ${catedratico}${horarioInfo}
            ${linkedLab ? `<div style="margin-top:5px;"><span class="lab-link-badge">🧪 ${linkedLab.name}</span></div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:800;color:${m.color};">${pts}</div>
            <div style="font-size:10px;color:var(--text3);">/ ${maxPts} pts</div>
          </div>
        </div>
      </div>
      <div class="mat-card-body">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;color:var(--text3);">Progreso</span>
          <span style="font-size:11px;color:${sc};font-weight:700;">${sl}</span>
        </div>
        <div class="prog-bar"><div class="prog-fill" style="background:${m.color};width:${Math.min(pct,100)}%;"></div></div>
        ${usacBanner}
        ${labData ? `<div style="margin-top:8px;font-size:11px;background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:6px;padding:6px 8px;color:#4ade80;">🧪 Lab: ${labData.labGrade.toFixed(0)}/${labData.labScale} → <strong>${labData.netPts.toFixed(2)}/${labData.labMaxPts} pts</strong></div>` : ''}
        <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;">
          ${t ? `<span style="font-size:11px;background:${m.color}1a;color:${m.color};padding:2px 8px;border-radius:4px;font-weight:700;">${pct.toFixed(1)}%</span>` : ''}
          ${pend > 0 ? `<span style="font-size:11px;background:var(--red-dim);color:var(--red);padding:2px 8px;border-radius:4px;font-weight:700;">✅ ${pend}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="goPage('calificaciones',document.querySelector('[onclick*=calificaciones]'));setTimeout(()=>scrollToMat('${m.id}'),200)">🎯 Notas</button>
          <button class="btn btn-ghost btn-sm" onclick="goPage('notas',document.querySelector('[onclick*=notas]'));setTimeout(()=>setNotesMat('${m.id}'),200)">📝</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditClassModal('${m.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass('${m.id}')">🗑️</button>
        </div>
        <!-- Survival Calculator -->
        ${t ? `<div class="survival-widget">
          <div class="sw-title">⚡ Calculadora de Supervivencia</div>
          ${isGanada
            ? `<div style="font-size:12px;color:var(--green);font-weight:700;">🏆 Clase ganada — ya aprobaste</div>`
            : hasZona
              ? `<div class="survival-row"><span style="color:var(--text2);">Puntos actuales:</span><strong style="color:var(--yellow);">${totalPts.toFixed(1)} / 61</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Necesita en examen final:</span><strong style="color:#f87171;">${Math.max(0,(61-totalPts)).toFixed(1)} pts</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Para zona mínima:</span><strong style="color:var(--green);">✓ Alcanzada</strong></div>`
              : `<div class="survival-row"><span style="color:var(--text2);">Puntos actuales:</span><strong style="color:#f87171;">${totalPts.toFixed(1)} / 36</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Faltan para zona mín:</span><strong style="color:#f87171;">${Math.max(0,(36-totalPts)).toFixed(1)} pts</strong></div>
                 <div class="survival-row"><span style="color:var(--text2);">Faltan para ganar:</span><strong style="color:var(--text3);">${Math.max(0,(61-totalPts)).toFixed(1)} pts</strong></div>`
          }
        </div>` : ''}
        <!-- Fórmulas clave (colapsable) -->
        <div class="formulas-section">
          <div class="formulas-toggle" onclick="toggleFormulas('${m.id}')">
            <span id="formulas-arrow-${m.id}">▶</span> 📐 Fórmulas clave
          </div>
          <div class="formulas-body" id="formulas-body-${m.id}">
            ${[0,1,2,3,4].map(i => {
              const val = (m.formulas && m.formulas[i]) ? m.formulas[i].replace(/"/g,'&quot;') : '';
              return `<input class="formula-inp" placeholder="Fórmula ${i+1}…" value="${val}" onchange="saveFormula('${m.id}',${i},this.value)">`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;

    if (linkedLab) {

      const labColor = m.color;
      const lt   = calcTotal(linkedLab.id);
      const lPts = lt ? lt.total.toFixed(1) : '—';
      html += `<div style="margin-left:16px;margin-top:-8px;margin-bottom:8px;padding-left:14px;border-left:3px solid ${labColor};position:relative;">
        <div style="position:absolute;left:-1px;top:0;width:3px;height:100%;background:linear-gradient(to bottom,${labColor}88,${labColor}22);border-radius:0 0 0 3px;"></div>
        <div class="mat-card" style="--mc:${labColor};border-color:${labColor}33;background:${labColor}0a;">
          <div class="mat-card-header" style="padding:10px 14px 8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:12px;font-weight:800;">${linkedLab.icon||'🧪'} ${linkedLab.name} <span style="font-size:9px;color:${labColor};background:${labColor}22;padding:1px 5px;border-radius:4px;border:1px solid ${labColor}44;font-family:'Space Mono',monospace;">LAB</span></div>
                <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${linkedLab.code} · ${linkedLab.credits}</div>
                ${linkedLab.catedratico ? `<div style="font-size:10px;color:var(--text3);">👤 ${linkedLab.catedratico}</div>` : ''}
                ${linkedLab.dias ? `<div style="font-size:10px;color:var(--text3);">📅 ${linkedLab.dias}${linkedLab.horario?' · '+linkedLab.horario:''}</div>` : ''}
              </div>
              <div style="text-align:right;">
                <div style="font-size:18px;font-weight:800;color:${labColor};">${lPts}</div>
                <div style="font-size:9px;color:var(--text3);">/100 pts</div>
              </div>
            </div>
          </div>
          <div class="mat-card-body" style="padding:8px 14px 10px;">
            ${labData ? `<div style="font-size:11px;color:${labColor};font-weight:600;">🧪 ${labData.labGrade.toFixed(0)}/${labData.labScale} en lab = ${labData.netPts.toFixed(2)}/${labData.labMaxPts} pts en ${m.name}</div>` : `<div style="font-size:11px;color:var(--text3);">Ingresa nota en Calificaciones → ${linkedLab.name}</div>`}
            <div style="display:flex;gap:6px;margin-top:8px;">
              <button class="btn btn-ghost btn-sm" onclick="goPage('calificaciones',document.querySelector('[onclick*=calificaciones]'));setTimeout(()=>scrollToMat('${linkedLab.id}'),200)">🎯 Ingresar nota</button>
              <button class="btn btn-ghost btn-sm" onclick="openEditClassModal('${linkedLab.id}')">✏️ Editar Lab</button>
            </div>
          </div>
        </div>
      </div>`;
    }
  });

  grid.innerHTML = html || `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);">
    <div style="font-size:32px;margin-bottom:10px;">📚</div>
    <div>No hay materias aún. <button class="btn btn-primary btn-sm" onclick="openAddClassModal()">+ Agregar primera clase</button></div>
  </div>`;
}

function renderSemesterBadge() { updateGPADisplay(); }

function updateGPADisplay() {
  const sem     = getActiveSem();
  const overall = calcOverallGPA();

  const snEl   = document.getElementById('sidebar-sem-nombre');
  const scEl   = document.getElementById('sidebar-sem-cred');
  const saEl   = document.getElementById('sidebar-sem-avg');
  if (snEl && !snEl.classList.contains('editing')) snEl.textContent = sem.nombre || '—';
  if (scEl) scEl.textContent = '🪙 ' + overall.totalCred + ' cred';
  if (saEl) saEl.textContent = '📈 ' + (overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—');

  const tgEl = document.getElementById('tb-gpa-val');
  const tcEl = document.getElementById('tb-cred-val');
  if (tgEl) tgEl.textContent = overall.overallAvg !== null ? overall.overallAvg.toFixed(1) : '—';
  if (tcEl) tcEl.textContent = overall.totalCred + ' cred';
}

function startSemEdit() {
  const snEl  = document.getElementById('sidebar-sem-nombre');
  const btnEl = document.getElementById('sem-edit-btn');
  if (!snEl || snEl.classList.contains('editing')) return;
  snEl.classList.add('editing');
  const current = getActiveSem().nombre || '';
  snEl.innerHTML = `<input class="sem-name-input" id="sem-name-inp" value="${current.replace(/"/g,'&quot;')}" maxlength="40" onclick="event.stopPropagation()">`;
  const inp = document.getElementById('sem-name-inp');
  inp.focus(); inp.select();
  const commit = () => {
    const val = inp.value.trim();
    if (val) { getActiveSem().nombre = val; saveState(['semestres']); }
    snEl.classList.remove('editing');
    snEl.textContent = getActiveSem().nombre || '—';
    renderSemestresList();
  };
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => { if (e.key==='Enter') inp.blur(); if (e.key==='Escape') { snEl.classList.remove('editing'); snEl.textContent=current; } });
  if (btnEl) btnEl.style.display = 'none';
  setTimeout(() => { if (btnEl) btnEl.style.display=''; }, 1500);
}

function toggleSemSwitcher(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('sem-sw-dd');
  if (!dd) return;
  if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }

  const list = document.getElementById('sem-sw-list');
  list.innerHTML = State.semestres.map(s => {
    const g   = calcSemesterGPA(s.id);
    const avg = g.promedioSemestre;
    return `<div class="sem-sw-item ${s.activo ? 'sem-active' : ''}" onclick="switchSemAndClose('${s.id}')">
      <div>
        <div>${s.activo ? '● ' : '○ '}${s.nombre}</div>
        <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;">${g.totalCreditos} cred · prom ${avg !== null ? avg.toFixed(1) : '—'}</div>
      </div>
      ${s.activo ? '<span style="font-size:9px;color:var(--accent);font-family:\'Space Mono\',monospace;">ACTIVO</span>' : ''}
    </div>`;
  }).join('');
  dd.classList.add('open');
}
function switchSemAndClose(id) {
  switchSemester(id);
  document.getElementById('sem-sw-dd')?.classList.remove('open');
}

function openConfigModal() {
  const sem = getActiveSem();
  document.getElementById('cfg-prev-avg').value   = sem.prevAvg  || '';
  document.getElementById('cfg-prev-cred').value  = sem.prevCred || '';
  document.getElementById('cfg-min-grade').value  = State.settings.minGrade || 70;
  document.getElementById('cfg-sem-target').value = sem.promedioObjetivo || 70;
  _updateConfigPreview();
  document.getElementById('modal-config').classList.add('open');
}
function _updateConfigPreview() {
  const prevAvg  = parseFloat(document.getElementById('cfg-prev-avg')?.value)  || 0;
  const prevCred = parseFloat(document.getElementById('cfg-prev-cred')?.value) || 0;

  const sem = getActiveSem();
  sem.prevAvg  = prevAvg;
  sem.prevCred = prevCred;

  const g        = calcSemesterGPA(sem.id);
  const semAvg   = g.promedioSemestre;
  const semCred  = g.totalCreditos;
  const total    = prevCred + semCred;
  const overall  = total > 0 ? (prevAvg * prevCred + (semAvg||0) * semCred) / total : semAvg;

  const elO = document.getElementById('cfg-prev-overall');
  const elC = document.getElementById('cfg-prev-tcred');
  const elS = document.getElementById('cfg-prev-sem');
  if (elO) elO.textContent = overall !== null ? overall.toFixed(2) : '—';
  if (elC) elC.textContent = total;
  if (elS) elS.textContent = semAvg !== null ? semAvg.toFixed(2) : '—';

  renderOverview();
}
function saveConfigModal() {
  const sem = getActiveSem();
  sem.prevAvg          = parseFloat(document.getElementById('cfg-prev-avg').value)  || 0;
  sem.prevCred         = parseFloat(document.getElementById('cfg-prev-cred').value) || 0;
  sem.promedioObjetivo = parseFloat(document.getElementById('cfg-sem-target').value)|| 70;
  State.settings.minGrade = parseFloat(document.getElementById('cfg-min-grade').value) || 70;
  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;
  saveState(['all']);
  closeModal('modal-config');
  renderOverview(); renderGrades(); updateGPADisplay();
}

// renderSemestresList is defined below (card view version)

let _editSemId = null;

function openSemestreModal() {
  _editSemId = null;
  document.getElementById('ns-nombre').value    = '';
  document.getElementById('ns-objetivo').value  = '70';
  document.getElementById('ns-prev-avg').value  = '';
  document.getElementById('ns-prev-cred').value = '';
  const cb = document.getElementById('ns-activar');
  if (cb) { cb.checked = true; cb.disabled = false; }
  document.querySelector('#modal-semestre .modal-title').textContent = '🗂️ Nuevo Semestre';
  document.getElementById('modal-semestre').classList.add('open');
}

function openSemestreEditModal(id) {
  _editSemId = id;
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  document.getElementById('ns-nombre').value    = sem.nombre;
  document.getElementById('ns-objetivo').value  = sem.promedioObjetivo || 70;
  document.getElementById('ns-prev-avg').value  = sem.prevAvg  || '';
  document.getElementById('ns-prev-cred').value = sem.prevCred || '';
  const cb = document.getElementById('ns-activar');
  if (cb) { cb.checked = sem.activo; cb.disabled = sem.activo; }
  document.querySelector('#modal-semestre .modal-title').textContent = '✏️ Editar Semestre';
  document.getElementById('modal-semestre').classList.add('open');
}

function saveSemestreModal() {
  const nombre   = document.getElementById('ns-nombre').value.trim();
  const objetivo = parseFloat(document.getElementById('ns-objetivo').value) || 70;
  const activar  = document.getElementById('ns-activar')?.checked ?? true;
  const prevAvg  = parseFloat(document.getElementById('ns-prev-avg')?.value)  || 0;
  const prevCred = parseFloat(document.getElementById('ns-prev-cred')?.value) || 0;
  if (!nombre) { alert('Ingresa un nombre para el semestre.'); return; }

  if (_editSemId) {
    const sem = State.semestres.find(s => s.id === _editSemId);
    if (sem) { sem.nombre = nombre; sem.promedioObjetivo = objetivo; sem.prevAvg = prevAvg; sem.prevCred = prevCred; }
    if (activar && !sem?.activo) switchSemester(_editSemId);
  } else {
    if (activar) State.semestres.forEach(s => s.activo = false);
    const sem = _buildDefaultSemester('sem_' + Date.now(), nombre);
    sem.promedioObjetivo = objetivo;
    sem.prevAvg  = prevAvg;
    sem.prevCred = prevCred;
    sem.activo   = activar;
    State.semestres.push(sem);
  }
  saveState(['semestres']);
  closeModal('modal-semestre');
  _refreshAllViews();
  renderSemesterBadge();
}

function deleteSemester(id) {
  const sem = State.semestres.find(s => s.id === id);
  if (!sem) return;
  if (sem.activo) { alert('No puedes eliminar el semestre activo.'); return; }
  if (!confirm(`¿Eliminar "${sem.nombre}" y todos sus datos? Esta acción es irreversible.`)) return;
  State.semestres = State.semestres.filter(s => s.id !== id);
  saveState(['semestres']);
  renderSemestresList();
}

function deleteClass(matId) {
  const mat = getMat(matId);
  if (mat.linkedLabId) {
    State.materias = State.materias.filter(m => m.id !== mat.linkedLabId);
    delete State.grades[mat.linkedLabId];
    State.topics = State.topics.filter(t => t.matId !== mat.linkedLabId);
  }
  State.materias = State.materias.filter(m => m.id !== matId);
  delete State.grades[matId];
  State.topics = State.topics.filter(t => t.matId !== matId);
  saveState(['materias','grades','topics']);
  renderMaterias(); renderGrades(); renderOverview(); fillMatSels(); fillTopicMatSel(); fillPomSel();
}

function openAddClassModal() {
  document.getElementById('nc-name').value    = '';
  document.getElementById('nc-code').value    = '';
  document.getElementById('nc-credits').value = '';
  document.getElementById('nc-lab-name').value  = '';
  document.getElementById('nc-lab-code').value  = '';
  document.getElementById('nc-lab-pts').value   = '';
  document.getElementById('nc-lab-scale').value = '100';
  document.getElementById('nc-nolab').checked   = true;
  document.getElementById('lab-section').style.display = 'none';

  ['nc-seccion','nc-catedratico','nc-horario'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  // Clear dias checkboxes
  document.querySelectorAll('#nc-dias-checks input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('nc-dias').value = '';

  const defaults = { lab:{on:false,pts:10,n:2}, tar:{on:false,pts:15,n:3},
                     par:{on:true,pts:75,n:2}, fin:{on:true,pts:25,n:1}, extra:{on:false,pts:5,n:1} };
  Object.entries(defaults).forEach(([id, cfg]) => {
    const cb = document.getElementById('uz-'+id+'-on');
    if (cb) { cb.checked = cfg.on; }
    const pts = document.getElementById('uz-'+id+'-pts');
    if (pts) pts.value = cfg.pts;
    const n = document.getElementById('uz-'+id+'-n');
    if (n) n.value = cfg.n;
    const ctrl = document.getElementById('uzc-'+id);
    if (ctrl) ctrl.style.display = cfg.on ? 'flex' : 'none';
  });
  updateUsacSuma();

  document.getElementById('zones-builder').innerHTML = '';
  zoneRowCount = 0;

  const ps = document.getElementById('nc-parent');
  ps.innerHTML = '<option value="">— No es un lab —</option>';
  State.materias.forEach(m => {
    const o = document.createElement('option'); o.value = m.id;
    o.textContent = `${m.icon||'📚'} ${m.name}`; ps.appendChild(o);
  });

  newColorSel = '#7c6aff'; newIconSel = '📚';
  document.querySelectorAll('.color-opt').forEach(el => el.classList.toggle('selected', el.dataset.color === newColorSel));
  document.querySelectorAll('.icon-opt').forEach(el  => el.classList.toggle('selected', el.dataset.icon  === newIconSel));
  document.getElementById('modal-addclass').classList.add('open');
}
function toggleLabSection() {
  document.getElementById('lab-section').style.display =
    document.getElementById('nc-haslab').checked ? 'block' : 'none';
}
function selectColor(el) {
  newColorSel = el.dataset.color;
  document.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function selectIcon(el) {
  newIconSel = el.dataset.icon;
  document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}
function addZoneRow(labelVal, ptsVal, subsArr) {
  zoneRowCount++;
  const id   = 'zr-' + zoneRowCount;
  const subs = subsArr || (labelVal ? [{label: labelVal, pts: ptsVal || 0}] : []);
  const div  = document.createElement('div');
  div.id = id;
  div.style.cssText = 'border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--surface2);';

  const buildSubsHtml = (subsList) => subsList.map((s, i) => `
    <div class="zone-sub-row" id="${id}-sub-${i}">
      <input type="text" class="form-input zone-sub-label" placeholder="Apartado (ej: Tarea P1)" value="${(s.label||'').replace(/"/g,'&quot;')}" style="font-size:12px;">
      <input type="number" class="form-input zone-sub-pts" placeholder="Pts" value="${s.pts||''}" min="0" max="200" style="font-size:12px;text-align:center;" oninput="updateZoneTotal('${id}')">
      <button class="btn btn-danger btn-sm" onclick="removeZoneSub('${id}', ${i})" style="padding:3px 6px;">✕</button>
    </div>`).join('');

  const totalPts = subs.reduce((a, s) => a + (parseFloat(s.pts) || 0), 0);

  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <input type="text" class="form-input zone-name-inp" data-zone-name="1" placeholder="Nombre de la zona (ej: Exámenes Parciales)" value="${(labelVal||'').replace(/"/g,'&quot;')}" style="font-size:13px;font-weight:600;flex:1;">
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;font-family:'Space Mono',monospace;white-space:nowrap;">
        Total: <strong id="${id}-total" style="color:var(--accent2);margin-left:4px;">${totalPts.toFixed(1)}</strong> pts
      </div>
      <button class="btn btn-danger btn-sm" onclick="document.getElementById('${id}').remove()" style="padding:3px 8px;">✕</button>
    </div>
    <div id="${id}-subs" class="zone-subs-area">${buildSubsHtml(subs)}</div>
    <button class="btn btn-ghost btn-sm" onclick="addZoneSub('${id}')" style="margin-top:4px;font-size:11px;">+ Apartado</button>`;

  document.getElementById('zones-builder').appendChild(div);
}

function updateZoneTotal(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  const totalEl = document.getElementById(zoneId + '-total');
  if (!subsDiv || !totalEl) return;
  let total = 0;
  subsDiv.querySelectorAll('input[type="number"]').forEach(inp => { total += parseFloat(inp.value) || 0; });
  totalEl.textContent = total.toFixed(1);
}

function addZoneSub(zoneId) {
  const subsDiv = document.getElementById(zoneId + '-subs');
  if (!subsDiv) return;
  const idx = subsDiv.querySelectorAll('[id^="' + zoneId + '-sub-"]').length;
  const row = document.createElement('div');
  row.className = 'zone-sub-row';
  row.id = zoneId + '-sub-' + idx;
  row.innerHTML = `
    <input type="text" class="form-input" placeholder="Apartado" style="font-size:12px;">
    <input type="number" class="form-input" placeholder="Pts" min="0" max="200" style="font-size:12px;text-align:center;" oninput="updateZoneTotal('${zoneId}')">
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();updateZoneTotal('${zoneId}')" style="padding:3px 6px;">✕</button>`;
  subsDiv.appendChild(row);
}

function removeZoneSub(zoneId, idx) {
  const row = document.getElementById(zoneId + '-sub-' + idx);
  if (row) { row.remove(); updateZoneTotal(zoneId); }
}

function saveNewClass() {
  const name = document.getElementById('nc-name').value.trim();
  const code = document.getElementById('nc-code').value.trim();
  if (!name || !code) { alert('Ingresa nombre y código.'); return; }
  const credits  = document.getElementById('nc-credits').value.trim() || '3 cred';
  const hasLab   = document.getElementById('nc-haslab').checked;
  const parentId = document.getElementById('nc-parent').value || null;

  const zones = [];
  document.getElementById('zones-builder').querySelectorAll('div[id^="zr-"]').forEach(row => {
    const nameInp = row.querySelector('.zone-name-inp');
    const lbl     = nameInp ? nameInp.value.trim() : '';
    if (!lbl) return;
    const key = lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,20);
    const subsRows = row.querySelectorAll('.zone-sub-row');
    const subs = [];
    let totalPts = 0;
    subsRows.forEach((sr, i) => {
      const subLabel = sr.querySelector('.zone-sub-label')?.value.trim() || lbl + ' ' + (i+1);
      const subPts   = parseFloat(sr.querySelector('.zone-sub-pts')?.value) || 0;
      if (subPts > 0) {
        subs.push({ key: key + '_' + (i+1), label: subLabel, maxPts: subPts });
        totalPts += subPts;
      }
    });
    if (totalPts > 0) {
      zones.push({ key, label: lbl, maxPts: totalPts, color: newColorSel, subs });
    }
  });
  if (!zones.length) { alert('Agrega al menos una zona de calificación.\n\nUsa "✅ Generar Zonas" para crear las zonas de calificación.'); return; }

  const newId  = 'mat_' + Date.now();
  const ncDias = Array.from(document.querySelectorAll('#nc-dias-checks input[type=checkbox]:checked')).map(cb=>cb.value).join(', ');
  const newMat = {
    id:newId, name, code, color:newColorSel, icon:newIconSel, credits, zones,
    seccion:      document.getElementById('nc-seccion')?.value.trim()     || '',
    catedratico:  document.getElementById('nc-catedratico')?.value.trim() || '',
    dias:         ncDias,
    horario:      document.getElementById('nc-horario')?.value.trim()     || '',
  };

  if (parentId) {

    newMat.parentId   = parentId;
    newMat.labScale   = 100;
    newMat.labMaxPts  = 10;

    const parentMat = State.materias.find(m => m.id === parentId);
    if (parentMat) { newMat.color = parentMat.color; }
    newMat.zones      = [{ key:'g', label:'Calificación (/100)', maxPts:100, color:newMat.color, subs:[{key:'nota', label:'Nota General', maxPts:100}] }];

    const pidx = State.materias.findIndex(m => m.id === parentId);
    if (pidx >= 0) {
      State.materias[pidx].linkedLabId = newId;
      State.materias[pidx].labMaxPts   = 10;
      State.materias[pidx].labScale    = 100;
      if (!State.materias[pidx].zones.some(z => z.isLabZone)) {
        State.materias[pidx].zones.push({ key:'lab', label:'Laboratorio (auto)', maxPts:10, color:newMat.color, isLabZone:true,
          subs:[{key:'lab', label:name+' (enlazado)', maxPts:10}] });
      }
    }
  }
  State.materias.push(newMat);

  if (hasLab && !parentId) {
    const labName  = document.getElementById('nc-lab-name').value.trim()  || name + ' Lab';
    const labCode  = document.getElementById('nc-lab-code').value.trim()  || code + '-L';
    const labPts   = parseFloat(document.getElementById('nc-lab-pts').value)   || 10;
    const labScale = parseFloat(document.getElementById('nc-lab-scale').value) || 100;
    const labId    = 'mat_lab_' + Date.now();
    State.materias.push({
      id:labId, name:labName, code:labCode, color:'#4ade80', icon:'🧪', credits:'1 cred',
      parentId:newId, labScale, labMaxPts:labPts,
      zones:[{ key:'g', label:`Calificación (/${labScale})`, maxPts:labScale, color:'#4ade80',
        subs:[{key:'nota', label:'Nota General', maxPts:labScale}] }]
    });
    newMat.linkedLabId = labId;
    newMat.labMaxPts   = labPts;
    newMat.labScale    = labScale;
    newMat.zones.push({ key:'lab', label:'Laboratorio (auto)', maxPts:labPts, color:'#4ade80', isLabZone:true,
      subs:[{key:'lab', label:labName+' (enlazado)', maxPts:labPts}] });
  }

  saveState(['materias']);
  closeModal('modal-addclass');
  fillMatSels(); fillTopicMatSel(); fillPomSel();
  renderMaterias(); renderGrades(); renderOverview();
}

let compTarget = null;
function openTopicModal() {
  fillMatSels();
  document.getElementById('tp-name').value = '';
  document.getElementById('tp-subs').value  = '';
  document.getElementById('modal-topic').classList.add('open');
}
function saveTopic() {
  const name = document.getElementById('tp-name').value.trim(); if (!name) return;
  const subsRaw = document.getElementById('tp-subs').value.trim();
  const subs = subsRaw ? subsRaw.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({name:s,seen:false,comp:0})) : [];
  State.topics.push({ id:Date.now().toString(), matId:document.getElementById('tp-mat').value,
    parcial:document.getElementById('tp-parcial').value, name, seen:false, comp:0, subs });
  saveState(['topics']); closeModal('modal-topic'); renderTopics();
}
function deleteTopic(id)  { State.topics = State.topics.filter(t=>t.id!==id); saveState(['topics']); renderTopics(); }
function toggleTopicSeen(id) {
  const t = State.topics.find(x=>x.id===id); if (!t) return;
  t.seen = !t.seen;
  if (t.seen && t.comp===0) t.comp=100;   // al marcar → 100% si estaba en 0
  if (!t.seen) t.comp=0;                  // al desmarcar → reset comprensión
  saveState(['topics']); renderTopics();
}
function toggleSubSeen(tid,idx) {
  const t = State.topics.find(x=>x.id===tid); if (!t?.subs?.[idx]) return;
  t.subs[idx].seen = !t.subs[idx].seen;
  if (t.subs[idx].seen && t.subs[idx].comp===0) t.subs[idx].comp=100;
  if (!t.subs[idx].seen) t.subs[idx].comp=0; // al desmarcar → reset
  saveState(['topics']); renderTopics();
}
function openCompPopup(e,topicId,subIdx) {
  e.stopPropagation();
  compTarget = { topicId, subIdx: subIdx!=null ? subIdx : null };
  const t   = State.topics.find(x=>x.id===topicId);
  const cur = subIdx!=null ? t.subs[subIdx].comp : t.comp;
  const slider = document.getElementById('comp-slider');
  slider.value = cur;
  document.getElementById('comp-val').textContent = cur+'%';
  slider.oninput = () => { document.getElementById('comp-val').textContent = slider.value+'%'; };
  const popup = document.getElementById('comp-popup');
  popup.style.display = 'block';
  const rect = e.currentTarget.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 8 + window.scrollY) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth-200) + 'px';
}
function applyComp() {
  if (!compTarget) return;
  const val = parseInt(document.getElementById('comp-slider').value)||0;
  const t   = State.topics.find(x=>x.id===compTarget.topicId);
  if (t) { if (compTarget.subIdx!=null) t.subs[compTarget.subIdx].comp=val; else t.comp=val; }
  saveState(['topics']); closeCompPopup(); renderTopics();
}
function closeCompPopup() { const p=document.getElementById('comp-popup'); if(p) p.style.display='none'; compTarget=null; }

function renderTopics() {
  const matId = document.getElementById('topics-mat-sel')?.value || '';
  const container = document.getElementById('topics-container');
  if (!container) return;
  if (!matId) { container.innerHTML=''; return; }
  const mat      = getMat(matId);
  const matTopics = State.topics.filter(t=>t.matId===matId);
  const totalT   = matTopics.length, seenT = matTopics.filter(t=>t.seen).length;
  const avgComp  = totalT ? Math.round(matTopics.reduce((a,t)=>a+t.comp,0)/totalT) : 0;
  const needRev  = matTopics.filter(t=>t.comp<70&&t.seen).length;

  let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
    <div class="stat-mini"><div class="stat-mini-lbl">✅ TEMAS VISTOS</div><div class="stat-mini-val" style="color:#4ade80;">${seenT}<span style="font-size:13px;color:var(--text3);">/${totalT}</span></div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:#4ade80;width:${totalT?seenT/totalT*100:0}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">🧠 COMPRENSIÓN</div><div class="stat-mini-val" style="color:${barColor(avgComp)};">${avgComp}%</div><div class="prog-bar" style="margin-top:8px;"><div class="prog-fill" style="background:${barColor(avgComp)};width:${avgComp}%;"></div></div></div>
    <div class="stat-mini"><div class="stat-mini-lbl">⚠️ REPASO</div><div class="stat-mini-val" style="color:#fbbf24;">${needRev}</div><div style="font-size:11px;color:var(--text3);margin-top:4px;">&lt;70% comprensión</div></div>
  </div>`;

  const parcials = [{v:'1',l:'Parcial 1'},{v:'2',l:'Parcial 2'},{v:'3',l:'Parcial 3'},{v:'final',l:'Final'}];
  let anyFound = false;
  parcials.forEach(p => {
    const pts = matTopics.filter(t=>t.parcial===p.v);
    if (!pts.length) return;
    anyFound = true;
    const pSeen = pts.filter(t=>t.seen).length;
    const pComp = pts.length ? Math.round(pts.reduce((a,t)=>a+t.comp,0)/pts.length) : 0;
    html += `<div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="border-left:3px solid ${mat.color};">
        <span class="card-title" style="padding-left:8px;">📖 ${p.l}</span>
        <div style="display:flex;gap:10px;align-items:center;">
          <span style="font-size:11px;color:var(--text3);">${pSeen}/${pts.length} vistos</span>
          <span style="font-size:11px;font-weight:700;color:${barColor(pComp)};">Comprensión: ${pComp}%</span>
        </div>
      </div>
      <div class="card-body">
        ${pts.map(t => {
          const subsHtml = t.subs.length
            ? `<div style="padding-left:28px;margin-top:4px;border-left:2px solid var(--border);margin-left:10px;">
                ${t.subs.map((s,i)=>`
                  <div class="topic-item" style="padding:6px 0;">
                    <div class="topic-seen-btn ${s.seen?'seen':''}" onclick="toggleSubSeen('${t.id}',${i})"></div>
                    <div style="flex:1;font-size:12px;color:${s.seen?'var(--text2)':'var(--text)'};">${s.name}</div>
                    <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',${i})">
                      <div style="width:80px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${s.comp}%;background:${barColor(s.comp)};border-radius:3px;transition:width .3s;"></div></div>
                      <span style="font-size:10px;font-family:'Space Mono',monospace;color:${barColor(s.comp)};width:30px;text-align:right;">${s.comp}%</span>
                    </div>
                  </div>`).join('')}
              </div>` : '';
          return `<div>
            <div class="topic-item">
              <div class="topic-seen-btn ${t.seen?'seen':''}" onclick="toggleTopicSeen('${t.id}')"></div>
              <div style="flex:1;font-size:13.5px;font-weight:600;color:${t.seen?'var(--text2)':'var(--text)'};">${t.name}</div>
              <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="openCompPopup(event,'${t.id}',null)">
                <div style="width:90px;height:6px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${t.comp}%;background:${barColor(t.comp)};border-radius:4px;transition:width .3s;"></div></div>
                <span style="font-size:11px;font-family:'Space Mono',monospace;color:${barColor(t.comp)};width:34px;text-align:right;">${t.comp}%</span>
              </div>
              <button class="btn btn-danger btn-sm" style="margin-left:6px;" onclick="deleteTopic('${t.id}')">✕</button>
            </div>
            ${subsHtml}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });
  if (!anyFound) html += `<div style="text-align:center;padding:48px;color:var(--text3);">📖 Presiona "+ Agregar Tema" para comenzar</div>`;
  container.innerHTML = html;
}

// ── GENERAL HUB ──────────────────────────────────────────────
function openFromHub(page) {
  const navEl = document.querySelector(`.nav-item[onclick*="'${page}'"]`);
  goPage(page, navEl);
}

function renderGeneralHub() {
  // Calificaciones stat
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const atRisk = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total < min; }).length;
  const passed = State.materias.filter(m => { const t = calcTotal(m.id); return t && t.total >= min; }).length;
  const calStat = document.getElementById('hub-stat-cal');
  if (calStat) calStat.textContent = State.materias.length
    ? `${passed} aprobada${passed!==1?'s':''} · ${atRisk} en riesgo`
    : 'Sin materias aún';

  // Flashcards stat
  const fcAll = (() => { try { return JSON.parse(localStorage.getItem('academia_flashcards')||'[]'); } catch { return []; } })();
  const fcStat = document.getElementById('hub-stat-fc');
  if (fcStat) fcStat.textContent = fcAll.length ? `${fcAll.length} tarjeta${fcAll.length!==1?'s':''}` : 'Sin tarjetas aún';

  // Stats stat
  const gpa = calcOverallGPA();
  const statsStat = document.getElementById('hub-stat-stats');
  if (statsStat) statsStat.textContent = gpa.overallAvg !== null ? `Promedio: ${gpa.overallAvg.toFixed(1)} pts` : 'Sin datos aún';

  // Temas stat
  const tc = (State.topics||[]).length;
  const temasStat = document.getElementById('hub-stat-temas');
  if (temasStat) temasStat.textContent = tc ? `${tc} tema${tc!==1?'s':''} registrado${tc!==1?'s':''}` : 'Sin temas aún';
}

// ── GRADES CARD VIEW ─────────────────────────────────────────
let _gradesDetailMatId = null;

function gradesShowIndex() {
  _gradesDetailMatId = null;
  document.getElementById('grades-index-view').style.display = '';
  document.getElementById('grades-detail-view').style.display = 'none';
  _renderGradeCards();
}

function openGradesForMat(matId) {
  _gradesDetailMatId = matId;
  document.getElementById('grades-index-view').style.display = 'none';
  document.getElementById('grades-detail-view').style.display = '';
  const mat = getMat(matId);
  document.getElementById('grades-detail-title').textContent = `${mat.icon||'📚'} ${mat.name}`;
  _renderGrades();
}

function _renderGradeCards() {
  const grid = document.getElementById('grades-cards-grid');
  if (!grid) return;
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const USAC_GANADA = 61;
  grid.innerHTML = State.materias.map(mat => {
    const t = calcTotal(mat.id);
    const total = t ? t.total : 0;
    const maxT = mat.zones.reduce((a,z) => a+z.maxPts, 0);
    const pct = t ? t.pct : 0;
    const isGanada = t && total >= USAC_GANADA;
    const sc = !t ? '#5a5a72' : isGanada ? '#4ade80' : total >= min ? '#4ade80' : total >= min*.8 ? '#fbbf24' : '#f87171';
    const sl = !t ? 'Sin datos' : isGanada ? '🏆 Ganada' : total >= min ? '✓ Aprobado' : total >= min*.8 ? '⚠ En zona' : '✗ En riesgo';
    const border = isGanada ? '#4ade80' : mat.color;
    return `<div class="card" onclick="openGradesForMat('${mat.id}')" style="cursor:pointer;border-left:4px solid ${border};transition:transform .15s,box-shadow .15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,.3)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
      <div class="card-body" style="padding:16px 18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:14px;font-weight:800;">${mat.icon||'📚'} ${mat.name}</div>
            <div style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:2px;">${mat.code||''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:26px;font-weight:800;line-height:1;color:${sc};">${t?total.toFixed(1):'—'}</div>
            <div style="font-size:10px;color:var(--text3);">/ ${maxT} pts</div>
          </div>
        </div>
        <div class="prog-bar" style="margin-bottom:8px;"><div class="prog-fill" style="background:${border};width:${Math.min(pct,100)}%;"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:700;color:${sc};">${sl}</span>
          <span style="font-size:10px;color:var(--text3);">${pct.toFixed(1)}%</span>
        </div>
      </div>
    </div>`;
  }).join('') || `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text3);">📚 Sin materias. Agrega una desde <b>Materias</b>.</div>`;
}

// ── SEMESTRES AS CARDS ────────────────────────────────────────
function renderSemestresList() {
  const container = document.getElementById('semestres-list');
  if (!container) return;
  if (!State.semestres.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text3);">🗂️ Sin semestres. Crea el primero.</div>`;
    return;
  }
  container.innerHTML = State.semestres.map(sem => {
    const gpa = calcSemesterGPA(sem.id);
    const isActive = sem.activo;
    const isClosed = sem.cerrado;
    const avg = gpa.promedioSemestre;
    const obj = sem.promedioObjetivo || 70;
    const avgColor = avg === null ? 'var(--text3)' : avg >= obj ? '#4ade80' : avg >= obj*.8 ? '#fbbf24' : '#f87171';
    const matCount = sem.materias.filter(m => !m.parentId).length;
    const taskDone = (sem.tasks||[]).filter(t => t.done).length;
    const taskCount = (sem.tasks||[]).length;
    const border = isActive ? 'var(--accent)' : isClosed ? 'var(--border)' : 'var(--border)';
    const statusLabel = isClosed ? '🔒 Cerrado' : isActive ? '✅ Activo' : '📁 Archivado';
    const statusColor = isClosed ? 'var(--text3)' : isActive ? 'var(--green)' : 'var(--text2)';
    return `
      <div class="card sem-hub-card" style="border:2px solid ${border};overflow:hidden;">
        <div class="card-body" style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div>
              <div style="font-size:15px;font-weight:800;">🗂️ ${sem.nombre}
                ${isActive ? `<span style="font-size:9px;font-family:'Space Mono',monospace;background:rgba(124,106,255,.2);color:var(--accent2);padding:2px 7px;border-radius:4px;margin-left:6px;vertical-align:middle;">ACTIVO</span>` : ''}
              </div>
              <div style="font-size:11px;color:${statusColor};margin-top:3px;">${statusLabel} · obj: ${obj} pts</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:28px;font-weight:800;color:${avgColor};">${avg !== null ? avg.toFixed(1) : '—'}</div>
              <div style="font-size:10px;color:var(--text3);">promedio</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:var(--surface2);border-radius:10px;padding:10px;">
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--accent2);">${gpa.totalCreditos}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">CRÉDITOS</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--green);">${matCount}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">MATERIAS</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;color:var(--blue);">${taskDone}/${taskCount}</div>
              <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;">TAREAS</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${!isActive && !isClosed ? `<button class="btn btn-primary btn-sm" onclick="switchSemester('${sem.id}');event.stopPropagation()">↩ Activar</button>` : ''}
            ${!isClosed ? `<button class="btn btn-ghost btn-sm" onclick="openSemestreEditModal('${sem.id}');event.stopPropagation()">✏️ Editar</button>` : ''}
            ${!isClosed && !isActive ? `<button class="btn btn-danger btn-sm" onclick="closeSemester('${sem.id}');event.stopPropagation()">🔒 Cerrar</button>` : ''}
            ${State.semestres.length > 1 && !isActive ? `<button class="btn btn-danger btn-sm" onclick="deleteSemester('${sem.id}');event.stopPropagation()">🗑️</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderStats() {

  const ctx1 = document.getElementById('chart-grades');
  if (!ctx1) return;
  const labels  = State.materias.map(m => m.code);
  const data    = State.materias.map(m => { const t = calcTotal(m.id); return t ? parseFloat(t.total.toFixed(1)) : 0; });
  const maxVals = State.materias.map(m => m.zones.reduce((a,z)=>a+z.maxPts,0));
  const colors  = State.materias.map(m => m.color);

  const canvas = ctx1; canvas.width = canvas.offsetWidth || 600; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { left:10, right:10, top:20, bottom:40 };
  const barW = (W - pad.left - pad.right) / (labels.length * 2);
  ctx.clearRect(0,0,W,H);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  ctx.fillStyle = isDark ? '#2a2a38' : '#e5e7eb';
  ctx.strokeStyle = isDark ? '#2a2a38' : '#e5e7eb';

  data.forEach((v,i) => {
    const maxV = maxVals[i] || 100;
    const x = pad.left + i*(barW*2) + barW*0.5;
    const barH = ((v/maxV) * (H - pad.top - pad.bottom));
    const y = H - pad.bottom - barH;
    ctx.fillStyle = colors[i] + 'cc';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, [4,4,0,0]);
    else ctx.rect(x,y,barW,barH);
    ctx.fill();

    ctx.fillStyle = isDark ? '#9090a8' : '#6b7280';
    ctx.font = '10px Space Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW/2, H - 10);

    ctx.fillStyle = colors[i];
    ctx.font = 'bold 11px Syne, sans-serif';
    ctx.fillText(v || '—', x + barW/2, y - 6);
  });

  const ctx2 = document.getElementById('chart-tasks');
  if (!ctx2) return;
  const done    = State.tasks.filter(t=>t.done).length;
  const pending = State.tasks.filter(t=>!t.done).length;
  const total   = done + pending;
  ctx2.width = ctx2.height = 160;
  const c2 = ctx2.getContext('2d');
  c2.clearRect(0,0,160,160);
  if (total > 0) {
    const startAngle = -Math.PI/2;
    const doneAngle  = (done/total) * 2*Math.PI;
    c2.beginPath(); c2.moveTo(80,80);
    c2.arc(80,80,70,startAngle,startAngle+doneAngle); c2.closePath();
    c2.fillStyle = '#4ade80'; c2.fill();
    c2.beginPath(); c2.moveTo(80,80);
    c2.arc(80,80,70,startAngle+doneAngle,startAngle+2*Math.PI); c2.closePath();
    c2.fillStyle = isDark?'#2a2a38':'#e5e7eb'; c2.fill();

    c2.beginPath(); c2.arc(80,80,44,0,2*Math.PI); c2.fillStyle=isDark?'#111118':'#ffffff'; c2.fill();

    c2.fillStyle=isDark?'#e8e8f0':'#111827';
    c2.font='bold 22px Syne,sans-serif'; c2.textAlign='center'; c2.textBaseline='middle';
    c2.fillText(total>0?Math.round(done/total*100)+'%':'0%',80,80);
  }

  const statsEl = document.getElementById('stats-summary');
  if (statsEl) {
    const tots2   = State.materias.map(m=>calcTotal(m.id)).filter(Boolean);
    const gpaData = calcSemesterGPA(getActiveSem().id);
    const avg     = gpaData.promedioSemestre !== null ? gpaData.promedioSemestre.toFixed(1) : '—';
    const highest = tots2.length ? tots2.reduce((a,b)=>b.total>a.total?b:a) : null;
    const atRisk  = State.materias.filter(m=>{ const t=calcTotal(m.id); return t && t.total < State.settings.minGrade*0.8; }).length;
    statsEl.innerHTML = `
      <div class="stat-mini"><div class="stat-mini-lbl">📊 PROM. PONDERADO</div><div class="stat-mini-val" style="color:#7c6aff;">${avg}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">${gpaData.totalCreditos} créditos</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">🏆 MEJOR MATERIA</div><div class="stat-mini-val" style="color:#4ade80;font-size:15px;">${highest ? State.materias.find(m=>calcTotal(m.id)?.total===highest.total)?.name||'—' : '—'}</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">⚠️ EN RIESGO</div><div class="stat-mini-val" style="color:#f87171;">${atRisk}</div></div>
      <div class="stat-mini"><div class="stat-mini-lbl">✅ CRED. APROBADOS</div><div class="stat-mini-val" style="color:#60a5fa;">${gpaData.creditosAprobados}/${gpaData.totalCreditos}</div></div>`;
  }
}

function globalSearch(q) {
  if (!q.trim()) { _el('search-results').style.display='none'; return; }
  const ql = q.toLowerCase();
  const results = [];
  State.tasks.forEach(t => {
    if (t.title.toLowerCase().includes(ql) || (t.notes||'').toLowerCase().includes(ql))
      results.push({ type:'task', icon:'✅', label:t.title, sub: getMat(t.matId).name||'', id:t.id });
  });
  State.events.forEach(e => {
    if (e.title.toLowerCase().includes(ql))
      results.push({ type:'event', icon:'📅', label:e.title, sub: getMat(e.matId).name||'', id:e.id });
  });
  State.materias.forEach(m => {
    if (m.name.toLowerCase().includes(ql) || m.code.toLowerCase().includes(ql))
      results.push({ type:'materia', icon:m.icon||'📚', label:m.name, sub:m.code, id:m.id });
  });
  const box = _el('search-results');
  if (!results.length) {
    box.innerHTML = `<div style="padding:12px 14px;color:var(--text3);font-size:13px;">Sin resultados para "${q}"</div>`;
  } else {
    box.innerHTML = results.slice(0,8).map(r => `
      <div class="search-result-item" onclick="searchGoTo('${r.type}','${r.id}')">
        <span style="font-size:16px;">${r.icon}</span>
        <div><div style="font-size:13px;font-weight:600;">${r.label}</div><div style="font-size:11px;color:var(--text3);">${r.sub}</div></div>
      </div>`).join('');
  }
  box.style.display = 'block';
}
function searchGoTo(type, id) {
  _el('search-results').style.display='none';
  document.getElementById('global-search').value = '';
  if (type==='task')    { goPage('tareas',document.querySelector('[onclick*=tareas]')); setTimeout(()=>{ document.getElementById('search-input').value=''; renderTasks(); },200); }
  if (type==='event')   goPage('calendario',document.querySelector('[onclick*=calendario]'));
  if (type==='materia') goPage('materias',document.querySelector('[onclick*=materias]'));
}

let pomI=null, pomR=false, pomB=false, pomSL=0, pomTS=0, pomD=0;

let _pomAudioCtx = null;
function initAudioContext() {
  if (_pomAudioCtx) return _pomAudioCtx;
  try {
    _pomAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_pomAudioCtx.state === 'suspended') _pomAudioCtx.resume();
  } catch(e) { console.warn('AudioContext init failed', e); }
  return _pomAudioCtx;
}

document.addEventListener('click', function _unlockAudio() {
  initAudioContext();
  document.removeEventListener('click', _unlockAudio);
}, { once: true, passive: true });

function _pomAudio() { return initAudioContext(); }
function pomPlayAlarm(isBreak) {
  try {
    const ctx = _pomAudio();
    const _doPlay = () => {
      const now = ctx.currentTime;
      const notes = isBreak ? [523,659,784,1047] : [880,659,523];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = isBreak ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const t = now + i * 0.20;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
        osc.start(t); osc.stop(t + 0.55);
      });
    };
    if (ctx.state === 'suspended') ctx.resume().then(_doPlay).catch(e => console.warn('Alarm resume failed', e));
    else _doPlay();
  } catch(e) { console.warn('Alarm audio failed', e); }
}

// Short beep for UI events
function _pomBeep(type) {
  try {
    const ctx = _pomAudio();
    if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'start') {
        // Two ascending soft tones
        [[440, 0], [550, 0.12]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.22, now+delay+0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.28);
          o.start(now+delay); o.stop(now+delay+0.3);
        });
      } else if (type === 'pause') {
        // One descending soft tone
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now);
        o.frequency.linearRampToValueAtTime(330, now+0.18);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now+0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now+0.22);
        o.start(now); o.stop(now+0.25);
      } else if (type === 'break') {
        // Three soft ascending pleasant tones — "relax"
        [[392,0],[494,0.15],[587,0.30]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.25, now+delay+0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.45);
          o.start(now+delay); o.stop(now+delay+0.5);
        });
      } else if (type === 'resume') {
        // Work resume: short energetic ascending double
        [[523,0],[659,0.10]].forEach(([freq, delay]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle'; o.frequency.value = freq;
          g.gain.setValueAtTime(0, now+delay);
          g.gain.linearRampToValueAtTime(0.2, now+delay+0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.2);
          o.start(now+delay); o.stop(now+delay+0.22);
        });
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// UI SOUND SYSTEM — subtle click/feedback sounds + white noise
// ══════════════════════════════════════════════════════════════
let _uiSoundsEnabled = true;
let _noiseNode = null, _noiseGain = null, _noiseType = null;
let _noiseVol = 0.30;

function toggleUiSounds() {
  _uiSoundsEnabled = !_uiSoundsEnabled;
  const btn = document.getElementById('ui-sound-btn');
  if (btn) btn.textContent = _uiSoundsEnabled ? '🔔' : '🔕';
  // If disabling, play one last click so user hears feedback
  if (!_uiSoundsEnabled) { _uiSoundsEnabled = true; _uiClick('off'); _uiSoundsEnabled = false; }
  localStorage.setItem('academia_ui_sounds', _uiSoundsEnabled ? '1' : '0');
}

// Central UI sound dispatcher
function _uiClick(type) {
  if (!_uiSoundsEnabled) return;
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const variant = (typeof State !== 'undefined' && State.settings?.soundVariant) || 'classic';
    // Volume multiplier per variant
    const vol = variant === 'minimal' ? 0.5 : variant === 'digital' ? 0.6 : 1.0;
    // Oscillator type per variant
    const oType = variant === 'digital' ? 'square' : 'sine';
    const _do = () => {
      const now = ctx.currentTime;
      if (type === 'nav') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 480;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+0.08);
          o.start(now); o.stop(now+0.1);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 600;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.setValueAtTime(0.04*vol, now+0.03); g.gain.linearRampToValueAtTime(0, now+0.04);
          o.start(now); o.stop(now+0.05);
        } else {
          // Classic nav: soft warm tap
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(520, now+0.06);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.12);
          o.start(now); o.stop(now+0.15);
        }
      } else if (type === 'click') {
        if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.setValueAtTime(800, now); o.frequency.exponentialRampToValueAtTime(600, now+0.05);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.005); g.gain.exponentialRampToValueAtTime(0.001, now+0.06);
          o.start(now); o.stop(now+0.07);
        } else if (variant === 'digital') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'square'; o.frequency.value = 1200;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.04*vol, now+0.002); g.gain.setValueAtTime(0.04*vol, now+0.04); g.gain.linearRampToValueAtTime(0, now+0.05);
          o.start(now); o.stop(now+0.06);
        } else {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine'; o.frequency.value = 660;
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05*vol, now+0.008); g.gain.exponentialRampToValueAtTime(0.001, now+0.07);
          o.start(now); o.stop(now+0.08);
        }
      } else if (type === 'modal-open') {
        if (variant === 'digital') {
          [[800,0],[1000,0.04],[1200,0.08]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.035*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.06);
            o.start(now+d); o.stop(now+d+0.07);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=520;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.04*vol,now+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
          o.start(now); o.stop(now+0.12);
        } else {
          [[440,0],[554,0.05],[659,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.06*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.15);
            o.start(now+d); o.stop(now+d+0.18);
          });
        }
      } else if (type === 'modal-close') {
        if (variant === 'digital') {
          [[1000,0],[800,0.04]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='square'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.03*vol,now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.05);
            o.start(now+d); o.stop(now+d+0.06);
          });
        } else if (variant === 'minimal') {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type='sine'; o.frequency.value=400;
          g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(0.03*vol,now+0.008); g.gain.exponentialRampToValueAtTime(0.001,now+0.07);
          o.start(now); o.stop(now+0.08);
        } else {
          [[659,0],[554,0.05],[440,0.10]].forEach(([f,d]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type='sine'; o.frequency.value=f;
            g.gain.setValueAtTime(0,now+d); g.gain.linearRampToValueAtTime(0.05*vol,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001,now+d+0.12);
            o.start(now+d); o.stop(now+d+0.15);
          });
        }
      } else if (type === 'task-done') {
        // Celebratory ascending ding
        const freqs = variant === 'digital' ? [[800,0],[1000,0.07],[1200,0.14]] : [[523,0],[659,0.09],[784,0.18],[1047,0.29]];
        freqs.forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.14*vol, now+d+0.03); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.35);
          o.start(now+d); o.stop(now+d+0.40);
        });
      } else if (type === 'task-undone') {
        [[523,0],[415,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.07*vol, now+d+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.15);
          o.start(now+d); o.stop(now+d+0.18);
        });
      } else if (type === 'save') {
        [[660,0],[880,0.10]].forEach(([f,d]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = oType; o.frequency.value = f;
          g.gain.setValueAtTime(0, now+d); g.gain.linearRampToValueAtTime(0.09*vol, now+d+0.01); g.gain.exponentialRampToValueAtTime(0.001, now+d+0.12);
          o.start(now+d); o.stop(now+d+0.14);
        });
      } else if (type === 'delete') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = oType; o.frequency.setValueAtTime(220, now); o.frequency.linearRampToValueAtTime(110, now+0.12);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1*vol, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.18);
        o.start(now); o.stop(now+0.20);
      } else if (type === 'off') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(440, now); o.frequency.linearRampToValueAtTime(220, now+0.2);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.08, now+0.02); g.gain.exponentialRampToValueAtTime(0.001, now+0.25);
        o.start(now); o.stop(now+0.28);
      }
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do).catch(() => {});
    else _do();
  } catch(e) {}
}

// ── WHITE / BROWN / RAIN NOISE ────────────────────────────────
function _buildNoiseBuffer(ctx, type) {
  const sr = ctx.sampleRate;
  const bufSize = sr * 3; // 3 sec loop
  const buf = ctx.createBuffer(1, bufSize, sr);
  const data = buf.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02;
      last = data[i]; data[i] *= 3.5;
    }

  } else if (type === 'rain') {
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      const env = 0.6 + 0.4 * Math.sin(i * 0.0003) * Math.sin(i * 0.00007);
      data[i] = w * env;
    }

  } else if (type === 'fire') {
    // Crackling fire: low rumble + random sharp crackles
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      // Brown base
      data[i] = (last + 0.015 * w) / 1.015;
      last = data[i]; data[i] *= 4;
      // Random crackles
      if (Math.random() < 0.0008) data[i] += (Math.random() - 0.5) * 2.5;
      // Slow breathing envelope
      const breathe = 0.7 + 0.3 * Math.sin(i * 0.00015) * Math.sin(i * 0.00004);
      data[i] *= breathe;
    }

  } else if (type === 'cafe') {
    // Coffee shop: low murmur base + occasional distant clinking
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.01 * w) / 1.01;
      last = data[i]; data[i] *= 2.5;
      // Occasional "clink" sounds
      if (Math.random() < 0.00015) {
        const clinkLen = Math.floor(sr * 0.05);
        for (let k = 0; k < clinkLen && i + k < bufSize; k++) {
          data[i + k] += Math.sin(k * 0.8) * Math.exp(-k * 0.05) * 0.4;
        }
      }
      // Room tone modulation
      const room = 0.5 + 0.5 * Math.abs(Math.sin(i * 0.00002));
      data[i] *= room;
    }

  } else if (type === 'forest') {
    // Forest: wind base + chirping birds
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.018 * w) / 1.018;
      last = data[i]; data[i] *= 1.8;
      // Wind sway
      const wind = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(i * 0.00008) * Math.sin(i * 0.000023));
      data[i] *= wind;
      // Bird chirps
      if (Math.random() < 0.0002) {
        const chirpLen = Math.floor(sr * 0.12);
        const chirpFreq = 2200 + Math.random() * 1400;
        for (let k = 0; k < chirpLen && i + k < bufSize; k++) {
          const t = k / sr;
          const env2 = Math.exp(-k / (chirpLen * 0.4));
          data[i + k] += Math.sin(2 * Math.PI * chirpFreq * t) * env2 * 0.25;
        }
      }
    }

  } else if (type === 'ocean') {
    // Ocean waves: rhythmic swell + splash texture
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1;
      // Wave rhythm ~6s cycle
      const wave = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(i * 0.00011));
      const splash = 0.4 + 0.6 * Math.abs(Math.sin(i * 0.00011));
      data[i] = w * wave * splash * 0.8;
      // Low-freq rumble
      if (i > 0) data[i] = data[i] * 0.3 + data[i - 1] * 0.7;
    }
  }
  return buf;
}

function toggleNoise(type) {
  const ctx = initAudioContext();
  if (!ctx) return;
  if (_noiseType === type && _noiseNode) { _stopNoise(); return; }
  _stopNoise();
  _uiClick('click');

  const _start = () => {
    try {
      const buf = _buildNoiseBuffer(ctx, type);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      _noiseGain = ctx.createGain();
      _noiseGain.gain.value = _noiseVol;

      // Apply type-specific filters
      if (type === 'rain') {
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1200; f.Q.value=0.7;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'brown') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'fire') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600; f.Q.value=0.5;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'cafe') {
        const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=800; f.Q.value=0.4;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'forest') {
        const f = ctx.createBiquadFilter(); f.type='lowshelf'; f.frequency.value=200; f.gain.value=-4;
        src.connect(f); f.connect(_noiseGain);
      } else if (type === 'ocean') {
        const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400;
        src.connect(f); f.connect(_noiseGain);
      } else {
        src.connect(_noiseGain);
      }

      _noiseGain.connect(ctx.destination);
      _noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      _noiseGain.gain.linearRampToValueAtTime(_noiseVol, ctx.currentTime + 0.8);
      src.start();
      _noiseNode = src; _noiseType = type;
      _updateNoiseButtons();

      // Update "now playing" label
      const labels = { white:'Ruido Blanco', brown:'Ruido Café', rain:'Lluvia', fire:'🔥 Fuego', cafe:'☕ Café', forest:'🌿 Bosque', ocean:'🌊 Océano' };
      const np = document.getElementById('sound-now-playing');
      if (np) np.textContent = '▶ ' + (labels[type] || type);
    } catch(e) { console.warn('Noise error', e); }
  };

  if (ctx.state === 'suspended') ctx.resume().then(_start).catch(() => {}); else _start();
}

function _stopNoise() {
  if (_noiseNode) {
    try {
      if (_noiseGain && _pomAudioCtx) {
        _noiseGain.gain.linearRampToValueAtTime(0, _pomAudioCtx.currentTime + 0.4);
        const n = _noiseNode;
        setTimeout(() => { try { n.stop(); } catch(e) {} }, 450);
      } else { _noiseNode.stop(); }
    } catch(e) {}
    _noiseNode = null; _noiseGain = null;
  }
  _noiseType = null;
  _updateNoiseButtons();
  const np = document.getElementById('sound-now-playing');
  if (np) np.textContent = '— Sin sonido —';
}

function _updateNoiseButtons() {
  ['white','brown','rain','fire','cafe','forest','ocean'].forEach(t => {
    const btn  = document.getElementById('noise-' + t + '-btn');
    const icon = document.getElementById('noise-' + t + '-icon');
    if (btn)  btn.classList.toggle('playing', _noiseType === t);
    if (icon) icon.textContent = _noiseType === t ? '⏸' : '▶';
  });
}

function setNoiseVol(v) {
  _noiseVol = parseInt(v) / 100;
  if (_noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.1);
  }
}

// ── INTEGRATE UI SOUNDS INTO EXISTING FUNCTIONS ───────────────
// Attach sound to all .btn clicks globally
document.addEventListener('click', e => {
  if (!_uiSoundsEnabled) return;
  const btn = e.target.closest('.btn, .nav-item, .mobile-nav-item, .task-check, .notes-folder-item');
  if (!btn) return;
  // Skip noise buttons (they handle their own sound)
  const skipIds = ['noise-white-btn','noise-brown-btn','noise-rain-btn','noise-fire-btn','noise-cafe-btn','noise-forest-btn','noise-ocean-btn','ui-sound-btn'];
  if (skipIds.some(id => btn.id === id)) return;
  // Skip pom-btn (has its own sounds)
  if (btn.id === 'pom-btn') return;
  // Determine sound type from context
  const onclick = btn.getAttribute('onclick') || '';
  if (btn.classList.contains('nav-item') || btn.classList.contains('mobile-nav-item')) {
    _uiClick('nav'); return;
  }
  if (btn.classList.contains('task-check')) {
    // Sound played inside toggleTask itself
    return;
  }
  if (onclick.includes('closeModal') || onclick.includes('modal-close') || btn.classList.contains('modal-close')) {
    _uiClick('modal-close'); return;
  }
  if (onclick.match(/open\w*Modal|Modal\w*open|\bopen[A-Z]/i)) {
    _uiClick('modal-open'); return;
  }
  if (onclick.match(/save[A-Z]|Save|create[A-Z]|Create|guardar/i)) {
    _uiClick('save'); return;
  }
  if (onclick.match(/delete[A-Z]|Delete|eliminar|remove/i)) {
    _uiClick('delete'); return;
  }
  _uiClick('click');
}, true); // capture phase

// Init: load ui sounds preference
(function _initUiSoundsPref() {
  const saved = localStorage.getItem('academia_ui_sounds');
  if (saved === '0') { _uiSoundsEnabled = false; const btn = document.getElementById('ui-sound-btn'); if (btn) btn.textContent = '🔕'; }
})();
let _mp3Playing = false;

function loadLocalMusic(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const audio = _el('pom-audio');
  if (!audio) return;

  if (audio._objectURL) URL.revokeObjectURL(audio._objectURL);
  const url = URL.createObjectURL(file);
  audio._objectURL = url;
  audio.src = url;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  _mp3Ready = true;
  _mp3Playing = false;

  const btn = document.getElementById('pom-music-btn');
  if (btn) btn.style.display = 'inline-flex';
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-label').textContent  = file.name.replace(/\.[^.]+$/,'').slice(0,28);
  document.getElementById('pom-music-status').textContent = `📁 ${file.name} · listo`;
}

function togglePomMusic() {
  if (!_mp3Ready) {
    document.getElementById('pom-mp3-input')?.click();
    return;
  }
  _mp3Playing ? _mp3Stop() : _mp3Start();
}
function _mp3Start() {
  const audio = _el('pom-audio');
  if (!audio || !_mp3Ready) return;
  audio.volume = (parseInt(document.getElementById('pom-vol')?.value) || 60) / 100;
  audio.play().catch(e => console.warn('Audio play failed', e));
  _mp3Playing = true;
  document.getElementById('pom-music-btn')?.classList.add('playing');
  document.getElementById('pom-music-icon').textContent   = '⏸';
  document.getElementById('pom-music-status').textContent = '🎵 Reproduciendo en bucle';
}
function _mp3Stop() {
  const audio = _el('pom-audio');
  if (audio) audio.pause();
  _mp3Playing = false;
  document.getElementById('pom-music-btn')?.classList.remove('playing');
  document.getElementById('pom-music-icon').textContent   = '▶';
  document.getElementById('pom-music-status').textContent = '⏸ Pausado · presiona ▶ para continuar';
}
function setPomVol(v) {
  const audio = _el('pom-audio');
  if (audio) audio.volume = parseInt(v) / 100;
}

function pomWork()  { return (parseInt(document.getElementById('pom-work')?.value)||25)*60; }
function pomBreak() { return (parseInt(document.getElementById('pom-break')?.value)||5)*60; }
function pomReset() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomB=false; pomSL=pomTS=pomWork();
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp();
}

// ── Countdown beep (5s before switch) ────────────────────────
function _pomCountdownBeep(secsLeft) {
  try {
    const ctx = _pomAudio(); if (!ctx) return;
    const _do = () => {
      const now = ctx.currentTime;
      const freq = secsLeft === 1 ? 880 : 600;
      const dur  = secsLeft === 1 ? 0.30 : 0.12;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.start(now); o.stop(now + dur + 0.02);
    };
    if (ctx.state === 'suspended') ctx.resume().then(_do); else _do();
  } catch(e) {}
}

// ── Pause/resume music when switching phases ──────────────────
function _pomMusicOnBreak() {
  if (_mp3Playing) { _mp3Stop(); _mp3Playing = '_pom_paused'; }
  if (_noiseType && _noiseNode && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(0, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = true;
  }
}
function _pomMusicOnWork() {
  if (_mp3Playing === '_pom_paused') { _mp3Playing = false; _mp3Start(); }
  if (_noiseNode && _noiseNode._pausedByPom && _noiseGain && _pomAudioCtx) {
    _noiseGain.gain.setTargetAtTime(_noiseVol, _pomAudioCtx.currentTime, 0.3);
    _noiseNode._pausedByPom = false;
  }
}

function pomToggle() {
  try { const ctx = _pomAudio(); if (ctx.state === 'suspended') ctx.resume(); } catch(e) {}
  if (pomR) {
    clearInterval(pomI); pomI=null; pomR=false;
    _el('pom-btn').textContent='▶ Reanudar';
    _pomBeep('pause');
    // Notify chrono: pom paused → stop counting work time
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  } else {
    if (pomSL<=0||pomTS===0) pomReset();
    pomR=true; _el('pom-btn').textContent='⏸ Pausar';
    _pomBeep(pomB ? 'break' : 'start');
    // Notify chrono: pom running
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(true, pomB ? 'break' : 'work');
    pomI = setInterval(() => {
      pomSL--; updatePomDisp();
      if (pomSL <= 10 && pomSL > 0) _pomCountdownBeep(pomSL);
      if (pomSL <= 0) {
        clearInterval(pomI); pomI=null; pomR=false;
        pomPlayAlarm(pomB);
        if (!pomB) {
          pomD++;
          const subj = document.getElementById('pom-subject').value;
          const m = getMat(subj);
          State.pomSessions.push({
            subject: m.name||subj||'General',
            time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
            taskId: document.getElementById('pom-task-sel')?.value || '',
            taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
            mins: pomWork() / 60
          });
          _recordPomWeekSession(pomWork() / 60);
          _updateStreak();
          savePom(); renderPomHistory(); renderPomGoal();
          const ovSess = document.getElementById('ov-sessions'); if(ovSess) ovSess.textContent = State.pomSessions.length;
          pomB=true; pomSL=pomTS=pomBreak();
          _pomMusicOnBreak();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
        } else {
          pomB=false; pomSL=pomTS=pomWork();
          _pomMusicOnWork();
          if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
        }
        _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
      }
    }, 1000);
  }
}
function pomSkip() {
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false;
  if (!pomB) {
    pomD++; pomB=true; pomSL=pomTS=pomBreak(); _pomBeep('break');
    _pomMusicOnBreak();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'break');
  } else {
    pomB=false; pomSL=pomTS=pomWork(); _pomBeep('resume');
    _pomMusicOnWork();
    if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, 'work');
  }
  _el('pom-btn').textContent='▶ Iniciar'; updatePomDisp(); updatePomDots();
}
function updatePomDisp() {
  const m=Math.floor(pomSL/60), s=pomSL%60;
  document.getElementById('pom-time').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const circ=2*Math.PI*82, prog=pomTS>0?pomSL/pomTS:1;
  const ring=document.getElementById('pom-ring');
  ring.style.strokeDashoffset=circ*(1-prog);
  ring.style.stroke=pomB?'#4ade80':'var(--accent)';
  document.getElementById('pom-mode').textContent=pomB?'DESCANSO':'ENFOQUE';
}
function updatePomDots() {
  const cycles = parseInt(document.getElementById('pom-cycles')?.value) || 4;
  document.getElementById('pom-dots').innerHTML=Array.from({length:cycles},(_,i)=>
    `<div style="width:9px;height:9px;border-radius:50%;background:${i<pomD%cycles?'var(--accent)':'var(--border2)'};"></div>`
  ).join('');
}
function renderPomHistory() {
  const hist = document.getElementById('pom-history'); if (!hist) return;
  const sess = State.pomSessions;
  if (!sess.length) {
    hist.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3);">⏱️ Sin sesiones hoy aún<br><span style="font-size:11px;margin-top:6px;display:block;">¡Inicia tu primera sesión!</span></div>`;
  } else {
    hist.innerHTML = sess.slice().reverse().map((s, i) => {
      const num = sess.length - i;
      const partialBadge = s.partial ? `<span style="font-size:9px;background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3);border-radius:4px;padding:1px 5px;font-family:'Space Mono',monospace;">PARCIAL</span>` : '';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);border-left:3px solid ${s.partial?'#fbbf24':'var(--accent)'};">
        <div style="font-size:11px;font-family:'Space Mono',monospace;color:var(--accent2);font-weight:700;flex-shrink:0;padding-top:1px;">#${num}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;">${s.subject} ${partialBadge}</div>
          ${s.taskTitle && !s.taskTitle.includes('Sin tarea') ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">📋 ${s.taskTitle.replace(/^[^\s]+ /,'').split(' · ')[0].substring(0,40)}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${s.time} · ${s.mins||25} min enfocado</div>
        </div>
        <div style="font-size:18px;">${s.partial ? '⏳' : '✅'}</div>
      </div>`;
    }).join('');
  }
  // Update stats
  const totalEl = document.getElementById('pom-stat-total');
  const minsEl  = document.getElementById('pom-stat-mins');
  if (totalEl) totalEl.textContent = sess.length;
  if (minsEl)  minsEl.textContent  = sess.reduce((a,s) => a + (s.mins||25), 0);
  renderPomGoal();
}

function renderPomGoal() {
  const goal = parseInt(document.getElementById('pom-goal')?.value) || 4;
  const done = State.pomSessions.length;
  const pct  = Math.min((done / goal) * 100, 100);
  const doneEl  = document.getElementById('pom-goal-done');
  const barEl   = document.getElementById('pom-goal-bar');
  const labelEl = document.getElementById('pom-goal-label');
  const streakEl = document.getElementById('pom-stat-streak');
  if (doneEl)  doneEl.textContent  = done;
  if (barEl)   barEl.style.width   = pct + '%';
  if (barEl)   barEl.style.background = pct >= 100 ? '#4ade80' : 'var(--accent2)';
  if (labelEl) labelEl.textContent = pct >= 100
    ? `🎉 ¡Meta alcanzada! ${done} sesiones hoy`
    : `${done} de ${goal} sesiones · ${Math.round(pct)}%`;
  // Streak
  if (streakEl) {
    const sd = typeof _getStreakData === 'function' ? _getStreakData() : {count:0};
    streakEl.textContent = `🔥 ${sd.count}`;
  }
  // Week stats
  _renderPomWeekStats();
}

function _getPomWeekHistory() {
  try { return JSON.parse(localStorage.getItem('academia_pom_week') || '[]'); } catch(e) { return []; }
}
function _savePomWeekHistory(arr) {
  try { localStorage.setItem('academia_pom_week', JSON.stringify(arr)); } catch(e) {} 
}
function _recordPomWeekSession(mins) {
  const arr = _getPomWeekHistory();
  const today = new Date().toISOString().slice(0,10);
  arr.push({ date: today, mins: mins || 0 });
  // Keep last 60 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
  const cutStr = cutoff.toISOString().slice(0,10);
  _savePomWeekHistory(arr.filter(s => s.date >= cutStr));
}
function _renderPomWeekStats() {
  const arr = _getPomWeekHistory();
  const today = new Date();
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6-i));
    return d.toISOString().slice(0,10);
  });
  const weekSessions = arr.filter(s => days.includes(s.date));
  const weekMins = weekSessions.reduce((a,s) => a + (s.mins||0), 0);
  const wsEl = document.getElementById('pom-stat-week-sessions');
  const wmEl = document.getElementById('pom-stat-week-mins');
  if (wsEl) wsEl.textContent = weekSessions.length;
  if (wmEl) wmEl.textContent = weekMins;
  // Mini bar chart
  const barsEl = document.getElementById('pom-week-bars');
  if (barsEl) {
    const maxMins = Math.max(1, ...days.map(d => arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0)));
    const dayNames = ['D','L','M','X','J','V','S'];
    barsEl.innerHTML = days.map(d => {
      const mins = arr.filter(s=>s.date===d).reduce((a,s)=>a+(s.mins||0),0);
      const h = Math.round((mins / maxMins) * 36) || 2;
      const isToday = d === today.toISOString().slice(0,10);
      const dd = new Date(d); const dayIdx = dd.getDay();
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;">
        <div title="${mins} min" style="width:100%;height:${h}px;background:${isToday?'var(--accent2)':'var(--accent)'};border-radius:3px 3px 0 0;opacity:${mins>0?1:0.2};min-height:2px;"></div>
        <div style="font-size:8px;color:${isToday?'var(--accent2)':'var(--text3)'};font-family:'Space Mono',monospace;">${dayNames[dayIdx]}</div>
      </div>`;
    }).join('');
  }
}

function pomSavePartial() {
  const totalWork = pomWork();
  const elapsed = pomB ? totalWork : (totalWork - pomSL);
  if (elapsed < 60) { alert('Debes estudiar al menos 1 minuto para guardar.'); return; }
  const mins = Math.round(elapsed / 60);
  const subj = document.getElementById('pom-subject')?.value;
  const m    = getMat(subj);
  State.pomSessions.push({
    subject: m.name || subj || 'General',
    time: new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}),
    taskId: document.getElementById('pom-task-sel')?.value || '',
    taskTitle: (() => { const ts = document.getElementById('pom-task-sel'); return ts?.options[ts.selectedIndex]?.text || ''; })(),
    mins, partial: true
  });
  _recordPomWeekSession(mins);
  _updateStreak(); // fix racha
  if (pomI) { clearInterval(pomI); pomI=null; }
  pomR=false; pomReset();
  // Stop chrono if synced
  if (typeof _chronoNotifyPomState !== 'undefined') _chronoNotifyPomState(false, null);
  if (typeof chronoR !== 'undefined' && chronoR) {
    chronoR = false;
    if (chronoI) { clearInterval(chronoI); chronoI=null; }
    const btn = document.getElementById('chrono-btn');
    if (btn) btn.textContent = '▶ Iniciar';
    const badge = document.getElementById('chrono-mode-badge');
    if (badge) badge.textContent = 'GUARDADO';
    if (typeof _chronoUpdateUI !== 'undefined') _chronoUpdateUI();
  }
  savePom(); renderPomHistory(); renderPomGoal();
  alert(`✅ Sesión parcial guardada: ${mins} min de estudio`);
}

function clearPomHistory() {
  if (!confirm('¿Limpiar historial de sesiones de hoy?')) return;
  State.pomSessions = [];
  savePom();
  renderPomHistory();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  State.settings.theme = newTheme;
  saveState(['settings']);
  document.getElementById('theme-btn').textContent = newTheme==='dark' ? '☀️' : '🌙';
}

function _applyFont(fontName) {
  const fontMap = {
    'Syne': "'Syne', sans-serif",
    'Inter': "'Inter', sans-serif",
    'JetBrains Mono': "'JetBrains Mono', monospace",
    'Playfair Display': "'Playfair Display', serif"
  };
  const fontVal = fontMap[fontName] || "'Syne', sans-serif";
  document.documentElement.style.setProperty('--app-font', fontVal);
}

function setFont(fontName) {
  _applyFont(fontName);
  State.settings.font = fontName;
  saveState(['settings']);
}

function _applyAccentColor(hex) {
  // Convert hex to rgb values for the glow effects
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  // Calculate lighter accent2 (lighter version)
  const lr = Math.min(255, r + 40);
  const lg = Math.min(255, g + 40);
  const lb = Math.min(255, b + 40);
  const toHex = n => n.toString(16).padStart(2,'0');
  const accent2 = `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--accent2', accent2);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},.15)`);
  // Update active nav item border color variable
  document.documentElement.style.setProperty('--btn-primary-glow', `rgba(${r},${g},${b},.35)`);
  // Update light theme accent too
  document.querySelectorAll('.accent-color-opt').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === hex);
  });
}

function setAccentColor(hex) {
  _applyAccentColor(hex);
  State.settings.accentColor = hex;
  saveState(['settings']);
}

function setSoundVariant(variant) {
  State.settings.soundVariant = variant;
  saveState(['settings']);
}

function openQuickAdd() { _uiClick('modal-open'); document.getElementById('modal-quickadd').classList.add('open'); }
function closeModal(id) { _uiClick('modal-close'); document.getElementById(id)?.classList.remove('open'); }

function _getGreeting() {
  const h = new Date().getHours();
  // Obtener nombre del usuario autenticado (Google) o fallback
  const userName = window._currentUserName || State.settings?.profile?.name?.split(' ')[0] || 'Ingeniero';
  const salud = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${salud}, ${userName} 👋`;
}

function init() {
  // ════════════════════════════════════════════════════════
  // VERIFICACIÓN DE AUTENTICACIÓN — BLOQUEAR SI NO ESTÁ AUTENTICADO
  // ════════════════════════════════════════════════════════
  
  // Crear overlay de loading mientras se verifica
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'auth-check-overlay';
  loadingOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: #0a0a0f;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  loadingOverlay.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
      <div style="color: #e8e8f0; font-size: 14px; font-family: Syne, sans-serif;">Verificando sesión...</div>
    </div>
  `;
  document.body.insertBefore(loadingOverlay, document.body.firstChild);

  // Verificar auth ANTES de hacer nada
  (async () => {
    try {
      const auth = await window.Auth.checkAuth();
      
      if (!auth) {
        console.log('❌ NO AUTENTICADO - Redirigiendo a login');
        window.location.href = 'auth-page.html';
        return; // STOP aquí, no continuar
      }

      console.log('✅ AUTENTICADO:', auth.email);
      
      // Quitar overlay de loading
      const overlay = document.getElementById('auth-check-overlay');
      if (overlay) overlay.remove();
      
      // CONTINUAR CON INIT NORMAL
      continueInit(auth);
      
    } catch (err) {
      console.error('❌ Error verificando auth:', err);
      window.location.href = 'auth-page.html';
    }
  })();
}

function continueInit(auth) {
  // ════════════════════════════════════════════════════════
  // INIT NORMAL (solo si está autenticado)
  // ════════════════════════════════════════════════════════
  
  const now = new Date();
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('ov-date').textContent     = now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase();
  // Start live clock (12hr format, top-right of overview)
  function _updateOvClock() {
    const d = new Date();
    let h = d.getHours(); const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    // Sun/moon/stars icon based on time
    let icon = '☀️'; // default day
    if (h >= 5 && h < 7)   icon = '🌅'; // dawn
    else if (h >= 7 && h < 18)  icon = '☀️'; // day
    else if (h >= 18 && h < 20) icon = '🌆'; // dusk
    else if (h >= 20 || h < 5)  icon = '🌙'; // night
    h = h % 12 || 12;
    const hStr = String(h).padStart(2,'0');
    const mStr = String(m).padStart(2,'0');
    const clk  = document.getElementById('ov-clock');
    const amp  = document.getElementById('ov-clock-ampm');
    const icn  = document.getElementById('ov-clock-icon');
    if (clk) clk.textContent = `${hStr}:${mStr}`;
    if (amp) amp.textContent = ampm;
    if (icn) icn.textContent = icon;
  }
  _updateOvClock();
  setInterval(_updateOvClock, 10000);
  const h = now.getHours();
  
  // Obtener nombre real del usuario autenticado (Google)
  if (auth && auth.name) {
    window._currentUserName = auth.name.split(' ')[0]; // Primer nombre
  }

  
  document.getElementById('ov-greeting').textContent = _getGreeting();

  document.documentElement.setAttribute('data-theme', State.settings.theme||'dark');
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.textContent = State.settings.theme==='light' ? '🌙' : '☀️';

  // Apply saved font
  _applyFont(State.settings.font || 'Syne');
  // Apply saved accent color
  _applyAccentColor(State.settings.accentColor || '#7c6aff');

  const mgEl = document.getElementById('min-grade');
  if (mgEl) mgEl.value = State.settings.minGrade;

  // ── Precargar perfil de FIUSAC (solo si no hay datos guardados) ──────────
  const _fiusacCourses = [
    { name: "TECNICAS DE ESTUDIO E INVESTIGACION", code: "0005", credits: 3, grade: 77.00, semester: "2024-05" },
    { name: "IDIOMA TECNICO 1",                    code: "0006", credits: 3, grade: 0,     semester: "2024-05", obs: "Equivalencia por examen de ubicación" },
    { name: "IDIOMA TECNICO 2",                    code: "0008", credits: 3, grade: 0,     semester: "2024-05", obs: "Equivalencia por examen de ubicación" },
    { name: "AREA SOCIAL HUMANISTICA 1",           code: "0017", credits: 3, grade: 64.00, semester: "2024-05" },
    { name: "DEPORTES 1",                          code: "0039", credits: 2, grade: 83.00, semester: "2024-05" },
    { name: "AREA MATEMATICA BASICA 1",            code: "0101", credits: 9, grade: 75.00, semester: "2024-07" },
    { name: "IDIOMA TECNICO 3",                    code: "0009", credits: 3, grade: 75.00, semester: "2024-11" },
    { name: "AREA SOCIAL HUMANISTICA 2",           code: "0019", credits: 3, grade: 73.00, semester: "2024-11" },
    { name: "DEPORTES 2",                          code: "0040", credits: 2, grade: 81.00, semester: "2024-11" },
    { name: "MATEMATICA PARA COMPUTACION 1",       code: "0960", credits: 5, grade: 68.00, semester: "2024-11" },
    { name: "ETICA PROFESIONAL",                   code: "0001", credits: 2, grade: 68.00, semester: "2025-05" },
    { name: "IDIOMA TECNICO 4",                    code: "0011", credits: 3, grade: 70.00, semester: "2025-05" },
    { name: "FILOSOFIA DE LA CIENCIA",             code: "0018", credits: 1, grade: 65.00, semester: "2025-05" },
    { name: "FISICA BASICA",                       code: "0147", credits: 5, grade: 64.00, semester: "2025-06" },
    { name: "AREA MATEMATICA BASICA 2",            code: "0103", credits: 9, grade: 64.00, semester: "2025-07" },
    { name: "LOGICA DE SISTEMAS",                  code: "0795", credits: 3, grade: 85.00, semester: "2025-11" },
    { name: "MATEMATICA PARA COMPUTACION 2",       code: "0962", credits: 5, grade: 61.00, semester: "2025-11" },
    { name: "LOGICA",                              code: "0010", credits: 1, grade: 63.00, semester: "2025-12" },
    { name: "INTRODUCCION A LA PROGRAMACION Y COMPUTACION 1", code: "0770", credits: 6, grade: 76.00, semester: "2026-01" },
  ];
  // Cursos con "Aprobado" (equivalencias) — grade 0 los tratamos como aprobados sin nota numérica
  // Para el cálculo de promedio, solo usamos los que tienen nota numérica > 0
  const _fiusacProfile = {
    name: "JOSUE ELIU CASTRO SOSA",
    carrera: "Ingeniería en Ciencias y Sistemas",
    registro: "202405110",
    facultad: "Facultad de Ingeniería · USAC",
    totalCredCarrera: 215
  };
  if (!State.settings.profile || !State.settings.profile.name) {
    State.settings.profile = _fiusacProfile;
    State.settings.approvedCourses = _fiusacCourses;
    saveState(['all']);
  }
  // Update greeting with real name
  const firstName = (State.settings.profile?.name || '').split(' ')[0];
  if (firstName) {
    const grEl = document.getElementById('ov-greeting');
    if (grEl) {
      const gHour = new Date().getHours();
      const greet = gHour < 12 ? 'Buenos días' : gHour < 19 ? 'Buenas tardes' : 'Buenas noches';
      grEl.textContent = `${greet}, ${firstName} 👋`;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  fillMatSels(); fillPomSel(); fillTopicMatSel(); fillNotesSel(); fillExamSel();
  renderOverview(); renderMaterias(); updateBadge(); updatePomDots(); pomReset(); initCal();
  renderSemesterBadge();

  ['cfg-prev-avg','cfg-prev-cred'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', _updateConfigPreview);
  });

  document.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-canvas');
    if (modal?.classList.contains('open')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoCanvas(); }
      if (e.key === 'Escape') { closeModal('modal-canvas'); }
    }
  });

  document.addEventListener('click', e => {
    const sr = _el('search-results');
    const sg = document.getElementById('global-search');
    if (sr && sg && !sr.contains(e.target) && e.target !== sg) sr.style.display='none';
    const p  = document.getElementById('comp-popup');
    if (p && p.style.display==='block' && !p.contains(e.target)) closeCompPopup();

    const dd = document.getElementById('sem-sw-dd');
    const sb = document.querySelector('.sidebar-bottom');
    if (dd && dd.classList.contains('open') && sb && !sb.contains(e.target)) dd.classList.remove('open');
  });

  mgEl?.addEventListener('input', () => {
    State.settings.minGrade = parseFloat(mgEl.value)||70;
    saveState(['settings']);
  });

  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target===o) o.classList.remove('open'); })
  );
} // FIN continueInit()


document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════
// MOBILE SIDEBAR — hamburger toggle
// ═══════════════════════════════════════════════════════
function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  const isOpen  = sidebar.classList.toggle('mobile-open');
  overlay.style.display = isOpen ? 'block' : 'none';
  btn && btn.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}
function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  const btn     = document.getElementById('hamburger-btn');
  if (!sidebar) return;
  sidebar.classList.remove('mobile-open');
  overlay.style.display = 'none';
  btn && btn.classList.remove('open');
  document.body.style.overflow = '';
}
// Close sidebar when a nav item is clicked on mobile
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeMobileSidebar();
    });
  });
});

// ════════════════════════════════════════════════════════════
// LOGOUT HANDLER
// ════════════════════════════════════════════════════════════
async function handleLogout() {
  if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) return;
  
  const result = await window.Auth.logoutUser();
  if (result.success) {
    console.log('✅ Sesión cerrada');
    localStorage.clear();
    window.location.href = 'auth-page.html';
  } else {
    alert('Error al cerrar sesión: ' + result.error);
  }
}

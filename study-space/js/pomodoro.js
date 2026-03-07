// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — pomodoro.js
// Pomodoro grupal sincronizado + Mascota (La Vaca)
// ═══════════════════════════════════════════════════════════════

// ── Estado local ────────────────────────────────────────────────
let _pom        = null;   // datos del pomodoro desde Supabase
let _mascot     = null;   // datos de la vaca desde Supabase
let _pomChannel = null;   // realtime channel
let _pomTick    = null;   // setInterval local
let _pomPage    = false;  // si la página está visible

const MODES = {
  focus:       { label: '🎯 Enfoque',     duration: 25 * 60, color: '#6c63ff' },
  short_break: { label: '☕ Pausa corta', duration:  5 * 60, color: '#3ddc84' },
  long_break:  { label: '🛋️ Pausa larga', duration: 15 * 60, color: '#ffd166' },
};

const XP_PER_SESSION  = 50;
const XP_PER_LEVEL    = lvl => lvl * 100;

// ── Cargar página ────────────────────────────────────────────────
async function _loadPomodoro() {
  _pomPage = true;
  _renderPomSkeleton();

  // Cargar o crear pomodoro del grupo
  _pom = await _pomGetOrCreate();
  // Cargar o crear mascota del grupo
  _mascot = await _mascotGetOrCreate();

  // Suscribir realtime
  if (_pomChannel) SS.DB.unsubscribe(_pomChannel);
  _pomChannel = SS.client
    .channel(`pomodoro:${_activeGroup.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public',
      table: 'social_pomodoro',
      filter: `group_id=eq.${_activeGroup.id}`
    }, payload => {
      _pom = { ..._pom, ...payload.new };
      _startLocalTick();
      _renderPomodoro();
    })
    .on('postgres_changes', {
      event: '*', schema: 'public',
      table: 'social_mascot',
      filter: `group_id=eq.${_activeGroup.id}`
    }, payload => {
      _mascot = { ..._mascot, ...payload.new };
      _renderMascot();
    })
    .subscribe();

  _startLocalTick();
  _renderPomodoro();
  _renderMascot();
}

async function _pomGetOrCreate() {
  const { data, error } = await SS.client
    .from('social_pomodoro').select('*')
    .eq('group_id', _activeGroup.id).single();
  if (data) return data;
  // No existe — crear
  const { data: created } = await SS.client
    .from('social_pomodoro')
    .insert({ group_id: _activeGroup.id })
    .select().single();
  return created;
}

async function _mascotGetOrCreate() {
  const { data } = await SS.client
    .from('social_mascot').select('*')
    .eq('group_id', _activeGroup.id).single();
  if (data) return data;
  const { data: created } = await SS.client
    .from('social_mascot')
    .insert({ group_id: _activeGroup.id })
    .select().single();
  return created;
}

// ── Calcular remaining ───────────────────────────────────────────
function _calcRemaining() {
  if (!_pom) return 0;
  let elapsed = _pom.elapsed || 0;
  if (_pom.state === 'running' && _pom.started_at) {
    elapsed += Math.floor((Date.now() - new Date(_pom.started_at).getTime()) / 1000);
  }
  return Math.max(0, (_pom.duration || 1500) - elapsed);
}

function _fmtTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Tick local ───────────────────────────────────────────────────
function _startLocalTick() {
  clearInterval(_pomTick);
  if (_pom?.state !== 'running') return;
  _pomTick = setInterval(() => {
    if (!_pomPage) { clearInterval(_pomTick); return; }
    const rem = _calcRemaining();
    // Actualizar solo el display del timer (sin re-render completo)
    const el = document.getElementById('pom-timer-display');
    if (el) el.textContent = _fmtTime(rem);
    // Ring al llegar a 0
    if (rem <= 0) {
      clearInterval(_pomTick);
      _onPomComplete();
    }
  }, 500);
}

// ── Acciones del pomodoro ────────────────────────────────────────
async function pomStart() {
  if (!_pom || !_activeGroup) return;
  const updates = {
    state:           'running',
    started_at:      new Date().toISOString(),
    controlled_by:   _user.id,
    controlled_name: _profile?.username || 'alguien',
    updated_at:      new Date().toISOString(),
  };
  await SS.client.from('social_pomodoro')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_pom, updates);
  _startLocalTick();
  _renderPomodoro();
}

async function pomPause() {
  if (!_pom) return;
  const elapsed = (_pom.elapsed || 0) + Math.floor((Date.now() - new Date(_pom.started_at).getTime()) / 1000);
  const updates = {
    state: 'paused', elapsed,
    started_at:      null,
    controlled_by:   _user.id,
    controlled_name: _profile?.username || 'alguien',
    updated_at:      new Date().toISOString(),
  };
  await SS.client.from('social_pomodoro')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_pom, updates);
  clearInterval(_pomTick);
  _renderPomodoro();
}

async function pomReset() {
  if (!_pom) return;
  const updates = {
    state: 'idle', elapsed: 0, started_at: null,
    controlled_by: _user.id, controlled_name: _profile?.username || 'alguien',
    updated_at: new Date().toISOString(),
  };
  await SS.client.from('social_pomodoro')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_pom, updates);
  clearInterval(_pomTick);
  _renderPomodoro();
}

async function pomSetMode(mode) {
  if (!_pom || !MODES[mode]) return;
  const updates = {
    mode, state: 'idle',
    duration: MODES[mode].duration,
    elapsed: 0, started_at: null,
    controlled_by: _user.id, controlled_name: _profile?.username || 'alguien',
    updated_at: new Date().toISOString(),
  };
  await SS.client.from('social_pomodoro')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_pom, updates);
  clearInterval(_pomTick);
  _renderPomodoro();
}

async function _onPomComplete() {
  if (!_pom) return;

  // Actualizar estado en DB
  const updates = {
    state: 'completed', elapsed: _pom.duration || 1500,
    started_at: null, updated_at: new Date().toISOString(),
  };
  await SS.client.from('social_pomodoro')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_pom, updates);

  // Solo sessions de enfoque dan XP a la vaca
  if (_pom.mode === 'focus') {
    await _mascotAddXP();
  }

  _renderPomodoro();
  showToast('🎉 ¡Sesión completada!', 'success');
  _playDing();
}

// ── Mascota XP ───────────────────────────────────────────────────
async function _mascotAddXP() {
  if (!_mascot) return;

  let xp    = (_mascot.xp || 0) + XP_PER_SESSION;
  let level = _mascot.level || 1;
  let leveled = false;

  while (xp >= XP_PER_LEVEL(level)) {
    xp -= XP_PER_LEVEL(level);
    level++;
    leveled = true;
  }

  const today = new Date().toDateString();
  const lastDay = _mascot.last_session ? new Date(_mascot.last_session).toDateString() : null;
  const sessionsToday = today === lastDay ? (_mascot.sessions_today || 0) + 1 : 1;

  const updates = {
    xp, level,
    total_sessions: (_mascot.total_sessions || 0) + 1,
    sessions_today: sessionsToday,
    last_session: new Date().toISOString(),
    mood: leveled ? 'celebrating' : 'happy',
    updated_at: new Date().toISOString(),
  };

  await SS.client.from('social_mascot')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_mascot, updates);

  if (leveled) {
    setTimeout(() => {
      showToast(`🐄 ¡Vaquita subió al nivel ${level}!`, 'success');
    }, 800);
    // Volver a happy después de celebrar
    setTimeout(async () => {
      await SS.client.from('social_mascot')
        .update({ mood: 'happy' }).eq('group_id', _activeGroup.id);
      if (_mascot) _mascot.mood = 'happy';
      _renderMascot();
    }, 5000);
  }

  _renderMascot();
}

async function mascotRename() {
  const name = prompt('Nombre para tu vaca:', _mascot?.name || 'Vaquita');
  if (!name?.trim()) return;
  const updates = { name: name.trim(), updated_at: new Date().toISOString() };
  await SS.client.from('social_mascot')
    .update(updates).eq('group_id', _activeGroup.id);
  Object.assign(_mascot, updates);
  _renderMascot();
}

// ── Audio ding ───────────────────────────────────────────────────
function _playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.4);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.5);
    });
  } catch(e) {}
}

// ── Render ───────────────────────────────────────────────────────
function _renderPomSkeleton() {
  const page = document.getElementById('page-pomodoro');
  if (!page) return;
  page.innerHTML = `<div class="empty-state"><div class="spinner spinner-lg"></div></div>`;
}

function _renderPomodoro() {
  if (!_pomPage || !_pom) return;
  const page = document.getElementById('page-pomodoro');
  if (!page) return;

  const rem     = _calcRemaining();
  const state   = _pom.state || 'idle';
  const mode    = _pom.mode  || 'focus';
  const modeInfo = MODES[mode];
  const total   = _pom.duration || modeInfo.duration;
  const pct     = Math.max(0, Math.min(100, ((total - rem) / total) * 100));
  const color   = modeInfo.color;
  const isRunning  = state === 'running';
  const isIdle     = state === 'idle';
  const isComplete = state === 'completed';

  const radius  = 90;
  const circ    = 2 * Math.PI * radius;
  const dash    = circ * (1 - pct / 100);

  page.innerHTML = `
    <div class="pom-page">

      <!-- ── Selector de modo ── -->
      <div class="pom-modes">
        ${Object.entries(MODES).map(([key, m]) => `
          <button class="pom-mode-btn ${mode === key ? 'active' : ''}"
                  style="${mode === key ? `--mc:${m.color}` : ''}"
                  onclick="pomSetMode('${key}')">
            ${m.label}
          </button>
        `).join('')}
      </div>

      <!-- ── Timer ring ── -->
      <div class="pom-ring-wrap">
        <svg class="pom-ring" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="${radius}" fill="none"
                  stroke="var(--border2)" stroke-width="10"/>
          <circle cx="110" cy="110" r="${radius}" fill="none"
                  stroke="${color}" stroke-width="10"
                  stroke-linecap="round"
                  stroke-dasharray="${circ}"
                  stroke-dashoffset="${dash}"
                  transform="rotate(-90 110 110)"
                  style="transition: stroke-dashoffset 0.5s linear;"/>
        </svg>
        <div class="pom-ring-inner">
          <div class="pom-timer-display ${isComplete ? 'done' : ''}" id="pom-timer-display">
            ${isComplete ? '✅' : _fmtTime(rem)}
          </div>
          <div class="pom-timer-label" style="color:${color};">
            ${isComplete ? '¡Completado!' : modeInfo.label}
          </div>
          ${_pom.controlled_name && !isIdle ? `
            <div class="pom-controlled-by">
              ${isRunning ? '▶' : '⏸'} ${_escHtml(_pom.controlled_name)}
            </div>` : ''}
        </div>
      </div>

      <!-- ── Controles ── -->
      <div class="pom-controls">
        ${isRunning
          ? `<button class="pom-btn pom-btn-pause" onclick="pomPause()">⏸ Pausar</button>`
          : isComplete
            ? `<button class="pom-btn pom-btn-start" onclick="pomReset()">🔄 Nueva sesión</button>`
            : `<button class="pom-btn pom-btn-start" onclick="pomStart()" style="--bc:${color};">▶ ${isIdle ? 'Iniciar' : 'Reanudar'}</button>`
        }
        ${!isIdle && !isComplete ? `<button class="pom-btn pom-btn-reset" onclick="pomReset()">↺ Reiniciar</button>` : ''}
      </div>

      <!-- ── Mascota ── -->
      <div id="pom-mascot-section">
        ${_renderMascotHTML()}
      </div>

    </div>
  `;
}

function _renderMascot() {
  const el = document.getElementById('pom-mascot-section');
  if (el) el.innerHTML = _renderMascotHTML();
}

function _renderMascotHTML() {
  if (!_mascot) return '';

  const level  = _mascot.level  || 1;
  const xp     = _mascot.xp    || 0;
  const xpNext = XP_PER_LEVEL(level);
  const xpPct  = Math.min(100, Math.round((xp / xpNext) * 100));
  const mood   = _mascot.mood  || 'happy';
  const name   = _mascot.name  || 'Vaquita';
  const totalSess = _mascot.total_sessions || 0;
  const todaySess = _mascot.sessions_today || 0;

  const cow = _cowArt(level, mood);

  const moodLabel = {
    happy:       '😊 Feliz',
    hungry:      '😮 Con hambre',
    sleeping:    '😴 Dormida',
    celebrating: '🎉 Celebrando',
  }[mood] || '😊 Feliz';

  return `
    <div class="mascot-card">
      <div class="mascot-header">
        <div class="mascot-name-row">
          <span class="mascot-name">${_escHtml(name)}</span>
          <span class="mascot-level-badge">Nv. ${level}</span>
          <span class="mascot-mood">${moodLabel}</span>
          <button class="btn btn-xs btn-ghost" onclick="mascotRename()" title="Renombrar">✏️</button>
        </div>
      </div>

      <div class="mascot-body">
        <div class="cow-art ${mood}" id="cow-art">${cow}</div>
        <div class="mascot-stats">
          <div class="mascot-xp-wrap">
            <div class="mascot-xp-label">
              <span>XP</span>
              <span>${xp} / ${xpNext}</span>
            </div>
            <div class="mascot-xp-bar">
              <div class="mascot-xp-fill" style="width:${xpPct}%;"></div>
            </div>
          </div>
          <div class="mascot-counters">
            <div class="mascot-counter">
              <div class="mascot-counter-val">${todaySess}</div>
              <div class="mascot-counter-lbl">hoy</div>
            </div>
            <div class="mascot-counter">
              <div class="mascot-counter-val">${totalSess}</div>
              <div class="mascot-counter-lbl">total</div>
            </div>
            <div class="mascot-counter">
              <div class="mascot-counter-val">${level}</div>
              <div class="mascot-counter-lbl">nivel</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function _cowArt(level, mood) {
  // La vaca crece y cambia según nivel y mood
  if (mood === 'celebrating') {
    return `<div class="cow-emoji-wrap celebrating">
      <div class="cow-emoji">🎉</div>
      <div class="cow-body">🐄</div>
      <div class="cow-emoji">🎉</div>
    </div>`;
  }
  if (mood === 'sleeping') {
    return `<div class="cow-emoji-wrap sleeping">
      <div class="cow-zzz">💤</div>
      <div class="cow-body">🐄</div>
    </div>`;
  }
  if (mood === 'hungry') {
    return `<div class="cow-emoji-wrap hungry">
      <div class="cow-body">🐄</div>
      <div class="cow-speech">¡Estudia más!</div>
    </div>`;
  }

  // Happy — tamaño según nivel
  const size = Math.min(1 + (level - 1) * 0.12, 2.2);
  const extras = level >= 5  ? '<div class="cow-star">⭐</div>' : '';
  const crown  = level >= 10 ? '<div class="cow-crown">👑</div>' : '';

  return `<div class="cow-emoji-wrap happy" style="transform:scale(${size});">
    ${crown}
    <div class="cow-body">🐄</div>
    ${extras}
  </div>`;
}

let calY, calM;
function initCal() { const n = new Date(); calY = n.getFullYear(); calM = n.getMonth(); }
function calNav(d)  { calM += d; if (calM>11){calM=0;calY++;}else if(calM<0){calM=11;calY--;} renderCalendar(); }

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function renderCalendar() { _schedRender(_renderCalendar); }
function _renderCalendar() {
  const monthStr = `${calY}-${String(calM+1).padStart(2,'0')}`;
  document.getElementById('cal-month-title').textContent = `${MONTHS[calM]} ${calY}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM+1, 0).getDate();

  const legendEl = _el('cal-legend');
  if (legendEl) {
    legendEl.innerHTML = `<span style="font-size:10px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-right:4px;">CLASES:</span>`
      + State.materias.slice(0,8).map(m =>
          `<span class="cal-legend-item" style="--lc:${m.color};">${m.icon||''} ${m.code}</span>`
        ).join('')
      + `<span class="cal-legend-item" style="--lc:#f87171;border-style:dashed;">✅ Tareas</span>`;
  }

  let html = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    .map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let i=0; i<first; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d=1; d<=daysInMonth; d++) {
    const ds   = `${monthStr}-${String(d).padStart(2,'0')}`;
    const cellDate = new Date(calY,calM,d);
    const isT  = cellDate.getTime() === today.getTime();
    const isPast = cellDate.getTime() < today.getTime();
    const de   = State.events.filter(e => e.date === ds);
    const dt   = State.tasks.filter(t => t.due === ds && !t.done);
    const total = de.length + dt.length;

    const eventsHtml = de.slice(0, 2).map(e => {
      const m = getMat(e.matId);
      return `<div class="cal-event" style="background:${m.color||'#7c6aff'}2a;color:${m.color||'#7c6aff'};border-left:2px solid ${m.color||'#7c6aff'};" title="${e.title}">${e.title}</div>`;
    }).join('');

    const tasksHtml = de.length < 2 ? dt.slice(0, 2-de.length).map(t => {
      const pCol = t.priority==='high'?'#f87171':t.priority==='low'?'#4ade80':'#fbbf24';
      return `<div class="cal-event" style="background:${pCol}1a;color:${pCol};border-left:2px dashed ${pCol};" title="✅ ${t.title}">✅ ${t.title}</div>`;
    }).join('') : '';

    const overflow = total > 2 ? `<div style="font-size:9px;color:var(--text3);padding:1px 3px;">+${total-2} más</div>` : '';

    let cellClass = 'cal-cell';
    if (isT) cellClass += ' today';
    else if (isPast) cellClass += ' past';

    html += `<div class="${cellClass}" onclick="calDayClick('${ds}')">
      <div class="cal-num">${d}</div>
      ${eventsHtml}${tasksHtml}${overflow}
    </div>`;
  }
  _el('cal-grid').innerHTML = html;

  const mEvs   = State.events.filter(e => e.date.startsWith(monthStr)).sort((a,b)=>a.date<b.date?-1:1);
  const mTasks = State.tasks.filter(t => t.due?.startsWith(monthStr)).sort((a,b)=>a.due<b.due?-1:1);

  let listHtml = '';
  if (mEvs.length) {
    listHtml += `<div class="section-title">📅 Eventos del mes</div>`;
    listHtml += mEvs.map(e => {
      const m = getMat(e.matId);
      const evDate = new Date(e.date); evDate.setHours(0,0,0,0);
      const dLeft = Math.ceil((evDate - today) / 86400000);
      let cdClass = 'ok', cdText = `${dLeft}d`;
      if (dLeft < 0)      { cdClass='urgent'; cdText=`hace ${-dLeft}d`; }
      else if (dLeft===0) { cdClass='urgent'; cdText='¡HOY!'; }
      else if (dLeft<=3)  { cdClass='urgent'; cdText=`${dLeft} día${dLeft===1?'':'s'}`; }
      else if (dLeft<=7)  { cdClass='warn';   cdText=`${dLeft} días`; }
      else                { cdClass='ok';     cdText=`${dLeft} días`; }
      const countdownBadge = `<span class="ev-countdown-badge ${cdClass}">${cdText}</span>`;
      return `<div class="task-item" style="align-items:center;">
        <div style="width:9px;height:9px;border-radius:50%;background:${m.color||'#7c6aff'};flex-shrink:0;margin-top:0;"></div>
        <div style="flex:1;">
          <div style="font-size:13.5px;font-weight:600;">${e.title}${countdownBadge}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.name||''} · ${fmtD(e.date)}${e.hora?' · '+e.hora:''}${e.desc?' · '+e.desc:''}</div>
        </div>
        <span class="type-badge ${getTypeBadgeClass(e.type)}">${e.type||''}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">🗑️</button>
      </div>`;
    }).join('');
  }
  if (mTasks.length) {
    listHtml += `<div class="section-title" style="margin-top:16px;">✅ Tareas con fecha este mes</div>`;
    listHtml += mTasks.map(t => {
      const m = getMat(t.matId);
      const prog = subtaskProgress(t);
      return `<div class="task-item${t.done?' done':''}">
        <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')"></div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${t.title}</div>
          <div style="font-size:11px;color:var(--text3);">${m.icon||''} ${m.code||''} · ${fmtD(t.due)} · ${t.type||'Tarea'}</div>
          ${prog ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            <div class="prog-bar" style="width:80px;"><div class="prog-fill" style="background:#7c6aff;width:${prog.pct}%;"></div></div>
            <span style="font-size:10px;color:var(--text3);">${prog.done}/${prog.total}</span>
          </div>` : ''}
        </div>
        ${prioBadge(t.priority)}
      </div>`;
    }).join('');
  }
  if (!mEvs.length && !mTasks.length) {
    listHtml = `<div style="text-align:center;padding:28px;color:var(--text3);">📅 Sin eventos ni tareas este mes</div>`;
  }
  _el('cal-events-list').innerHTML = listHtml;
}

function calDayClick(ds) {

  const list = _el('cal-events-list');
  if (list) list.scrollIntoView({ behavior:'smooth', block:'start' });
}

function openEventModal() {
  fillMatSels();
  ['ev-title','ev-desc'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ev-date').value = '';
  document.getElementById('ev-time').value = '';
  document.getElementById('modal-event').classList.add('open');
}
function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  if (!title) return;
  State.events.push({
    id: Date.now().toString(), title,
    matId: document.getElementById('ev-mat').value,
    type:  document.getElementById('ev-type').value,
    date:  document.getElementById('ev-date').value,
    hora:  document.getElementById('ev-time').value,
    desc:  document.getElementById('ev-desc').value,
  });
  saveState(['events']);
  closeModal('modal-event');
  renderCalendar();
  renderOverview();
}
function deleteEvent(id) {
  State.events = State.events.filter(e => e.id !== id);
  saveState(['events']); renderCalendar(); renderOverview();
}

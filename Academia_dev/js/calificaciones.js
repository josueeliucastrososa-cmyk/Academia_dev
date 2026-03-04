function pctToNet(pct, maxPts)  { return (parseFloat(pct) || 0) / 100 * maxPts; }
function compColor(v)           { return v >= 80 ? '#4ade80' : v >= 60 ? '#fbbf24' : '#f87171'; }
function barColor(v)            { return v >= 80 ? '#4ade80' : v >= 50 ? '#fbbf24' : '#f87171'; }
function getMat(id) {
  if (!getMat._cache) getMat._cache = Object.create(null);
  if (getMat._cache[id]) return getMat._cache[id];
  const m = State.materias.find(m => m.id === id);
  getMat._cache[id] = m || {};
  return getMat._cache[id];
}
getMat.bust = function() { getMat._cache = Object.create(null); };
function getG(matId, key)       { return State.grades[matId]?.[key] ?? ''; }
function setG(matId, key, val) {
  if (!State.grades[matId]) State.grades[matId] = {};
  const num = val === '' ? '' : Math.min(Math.max(parseFloat(val) || 0, 0), 100);
  State.grades[matId][key] = num;
  saveState(['grades']);
  _updateGradeSummary(matId);
  renderMaterias();
  renderOverview();
}

// Live update % and pts columns in the grade row without full re-render
function _liveUpdateGradeRow(inp) {
  const pctVal = inp.value !== '' ? Math.min(parseFloat(inp.value) || 0, 100) : null;
  const maxPts = parseFloat(inp.dataset.maxpts) || 0;
  const netPts = pctVal !== null ? pctVal / 100 * maxPts : null;
  const row    = inp.closest('.grade-row');
  if (!row) return;
  const color = netPts !== null ? compColor(netPts / maxPts * 100) : '#5a5a72';
  const pctEl = row.querySelector('.grade-pct');
  const netEl = row.querySelector('.grade-net');
  const fill  = row.querySelector('.prog-fill');
  if (pctEl) { pctEl.textContent = pctVal !== null ? pctVal.toFixed(0)+'%' : '—'; pctEl.style.color = color; }
  if (netEl) { netEl.textContent = netPts !== null ? netPts.toFixed(2) : '—'; netEl.style.color = color; }
  if (fill)  { fill.style.background = color; fill.style.width = netPts !== null ? Math.min(netPts/maxPts*100,100)+'%' : '0%'; }
}

function _updateGradeSummary(matId) {
  const mat = getMat(matId);
  if (!mat || !mat.zones) return;
  const minG = parseFloat(document.getElementById('min-grade')?.value) || 70;

  let grandTotal = 0, grandMax = 0, anyFilled = false;

  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { grandTotal += Math.min(ld.netPts, z.maxPts); anyFilled = true; }
      grandMax += z.maxPts;
      return;
    }
    let zTotal = 0, zAny = false;
    z.subs.forEach(s => {
      const v = getG(matId, s.key);
      if (v !== '') { zTotal += Math.min(pctToNet(v, s.maxPts), s.maxPts); zAny = true; anyFilled = true; }
    });
    grandTotal += zTotal;
    grandMax   += z.maxPts;

    const subEl = document.querySelector(`[data-zone-subtotal="${matId}-${z.key}"]`);
    if (subEl && zAny) {
      const c = compColor(z.maxPts ? zTotal/z.maxPts*100 : 0);
      subEl.innerHTML = `<span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">SUBTOTAL</span>
        <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:800;color:${c};">${zTotal.toFixed(2)} / ${z.maxPts} pts</span>`;
    }
  });

  const totEl = document.querySelector(`[data-mat-total="${matId}"]`);
  if (totEl && anyFilled) {
    const sc = compColor(grandMax ? grandTotal/grandMax*100 : 0);
    totEl.style.color = sc;
    totEl.childNodes[0].textContent = grandTotal.toFixed(2);
  }
}

function getLabNetPts(mat) {
  if (!mat.linkedLabId) return null;
  const lab = getMat(mat.linkedLabId);
  if (!lab?.zones) return null;

  let labGrade = getG(lab.id, 'nota');
  if (labGrade === '') {

    if (lab.zones[0]?.subs?.[0]) labGrade = getG(lab.id, lab.zones[0].subs[0].key);
  }
  if (labGrade === '' || labGrade == null) return null;
  const scale     = mat.labScale  || lab.labScale  || 100;
  const maxPts    = mat.labMaxPts || lab.labMaxPts || 10;
  const labPct    = Math.min(parseFloat(labGrade) || 0, scale);
  const netPts    = (labPct / scale) * maxPts;
  return { netPts, labGrade: labPct, labScale: scale, labMaxPts: maxPts };
}

function calcTotal(matId) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let total = 0, filled = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { total += Math.min(ld.netPts, z.maxPts); filled++; }
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') { total += Math.min(pctToNet(v, s.maxPts), s.maxPts); filled++; }
      });
    }
  });
  if (!filled) return null;
  const maxTotal = mat.zones.reduce((a, z) => a + z.maxPts, 0);
  return { total, maxTotal, pct: total / maxTotal * 100 };
}

function calcProjected(matId) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let earned = 0, potential = 0, filledPts = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) { earned += ld.netPts; filledPts += z.maxPts; }
      potential += z.maxPts;
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') {
          const net = Math.min(pctToNet(v, s.maxPts), s.maxPts);
          earned += net; filledPts += s.maxPts;
        }
        potential += s.maxPts;
      });
    }
  });
  if (!filledPts) return null;
  const avgRate = earned / filledPts;
  const remaining = potential - filledPts;
  return { projected: earned + avgRate * remaining, maxTotal: potential };
}

function calcMinNeeded(matId, targetPts) {
  const mat = getMat(matId);
  if (!mat.zones) return null;
  let earned = 0, remainingMax = 0;
  mat.zones.forEach(z => {
    if (z.isLabZone) {
      const ld = getLabNetPts(mat);
      if (ld) earned += ld.netPts;
      else remainingMax += z.maxPts;
    } else {
      z.subs.forEach(s => {
        const v = getG(matId, s.key);
        if (v !== '') earned += Math.min(pctToNet(v, s.maxPts), s.maxPts);
        else remainingMax += s.maxPts;
      });
    }
  });
  if (remainingMax === 0) return null;
  const needed = targetPts - earned;
  return { needed, remainingMax, pct: (needed / remainingMax) * 100 };
}

function renderGrades() { _schedRender(_renderGrades); }
function _renderGrades() {
  // If in index mode (no mat selected), render card grid
  if (!_gradesDetailMatId) {
    _renderGradeCards();
    return;
  }
  // Detail mode: render only selected mat
  const min = parseFloat(document.getElementById('min-grade')?.value) || State.settings.minGrade;
  const container = _el('grades-container');
  if (!container) return;
  container.innerHTML = '';

  const USAC_ZONA_MIN = 36;
  const USAC_GANADA   = 61;

  const materiasToShow = _gradesDetailMatId
    ? State.materias.filter(m => m.id === _gradesDetailMatId)
    : State.materias;

  materiasToShow.forEach(mat => {
    const t     = calcTotal(mat.id);
    const total = t ? t.total : 0;
    const maxT  = mat.zones.reduce((a, z) => a + z.maxPts, 0);
    const pct   = t ? t.pct : 0;
    const sc    = t ? (total >= min ? '#4ade80' : total >= min * .8 ? '#fbbf24' : '#f87171') : '#5a5a72';
    const sl    = t ? (total >= min ? '✓ Aprobado' : total >= min * .8 ? '⚠ En zona' : '✗ En riesgo') : 'Sin datos';
    const proj  = calcProjected(mat.id);
    const minN  = calcMinNeeded(mat.id, min);

    const isUSAC       = maxT >= 80 && maxT <= 120;
    const zonaMinOk    = t && total >= USAC_ZONA_MIN;
    const isGanada     = t && total >= USAC_GANADA;

    let faltaParaGanar = null;
    if (t && !isGanada && zonaMinOk) {
      const minFinal = calcMinNeeded(mat.id, USAC_GANADA);
      if (minFinal) faltaParaGanar = minFinal;
    }

    const wrap = document.createElement('div');
    wrap.id = 'grades-mat-' + mat.id;
    wrap.className = 'grades-block';
    wrap.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:22px;';
    if (isGanada) wrap.style.borderColor = '#4ade80';

    let parentBadge = '', labBadge = '';
    if (mat.parentId)    parentBadge = `<span class="lab-parent-badge">🔗 Lab de: ${getMat(mat.parentId).name||''}</span>`;
    if (mat.linkedLabId) labBadge    = `<span class="lab-link-badge">🧪 Lab: ${getMat(mat.linkedLabId).name||''}</span>`;

    wrap.innerHTML = `
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);border-left:4px solid ${isGanada?'#4ade80':mat.color};display:flex;align-items:center;gap:14px;">
        <div style="flex:1;">
          <div style="font-size:17px;font-weight:800;">${mat.icon||'📚'} ${mat.name}</div>
          <div style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;margin-top:2px;">${mat.code} ${parentBadge} ${labBadge}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:9px;">
            <div class="prog-bar" style="flex:1;max-width:220px;">
              <div class="prog-fill" style="background:${isGanada?'#4ade80':mat.color};width:${Math.min(pct,100)}%;"></div>
            </div>
            <span style="font-size:11px;font-family:'Space Mono',monospace;color:${isGanada?'#4ade80':mat.color};">${pct.toFixed(1)}%</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:34px;font-weight:800;color:${isGanada?'#4ade80':sc};">${t ? total.toFixed(2) : '—'}</div>
          <div style="font-size:11px;color:var(--text3);">de ${maxT} pts</div>
          <div style="font-size:12px;font-weight:700;color:${isGanada?'#4ade80':sc};margin-top:3px;">${isGanada?'🏆 GANADA':sl}</div>
        </div>
      </div>`;

    if (t) {
      const milestoneEl = document.createElement('div');
      milestoneEl.style.cssText = 'padding:10px 20px;border-bottom:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;align-items:center;';
      if (isGanada) {
        milestoneEl.innerHTML = `<div class="usac-won">🎉 ¡CLASE GANADA! Tienes ${total.toFixed(2)} pts — aprobaste sin necesidad de examen final.</div>`;
      } else if (zonaMinOk && faltaParaGanar) {
        const faltaN = faltaParaGanar.needed;
        const pctN   = faltaParaGanar.pct;
        const color  = pctN <= 100 ? '#fbbf24' : '#f87171';
        const msg    = pctN <= 100
          ? `Necesitas ${faltaN.toFixed(1)} pts más (${pctN.toFixed(0)}% de lo que queda) para ganar`
          : 'Ya no es posible llegar a 61 pts — estudia para el mínimo';
        milestoneEl.innerHTML = `
          <div class="usac-zona-min-ok">✅ Zona mínima alcanzada (${total.toFixed(1)}/36)</div>
          <div class="usac-falta-examen">🎯 ${msg}</div>`;
      } else if (!zonaMinOk) {
        const faltaZona = USAC_ZONA_MIN - total;
        milestoneEl.innerHTML = `<div class="usac-zona-min-no">⚠️ Faltan ${faltaZona.toFixed(1)} pts para zona mínima (36 pts)</div>`;
      }
      wrap.appendChild(milestoneEl);
    }

    if (proj || minN) {
      const projEl = document.createElement('div');
      projEl.style.cssText = 'display:flex;gap:0;border-bottom:1px solid var(--border);';
      let _ph = '';
      if (proj) {
        const projColor = proj.projected >= min ? '#4ade80' : proj.projected >= min*.8 ? '#fbbf24' : '#f87171';
        _ph += `<div style="flex:1;padding:10px 20px;border-right:1px solid var(--border);">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">📈 NOTA PROYECTADA</div>
          <div style="font-size:20px;font-weight:800;color:${projColor};">${proj.projected.toFixed(2)}<span style="font-size:11px;color:var(--text3);"> / ${proj.maxTotal}</span></div>
        </div>`;
      }
      if (minN && minN.needed > 0) {
        const mnColor = minN.pct <= 100 ? '#fbbf24' : '#f87171';
        const mnMsg   = minN.pct <= 100 ? `Necesitas ${minN.pct.toFixed(0)}% en lo que queda` : 'Ya no es posible alcanzar el mínimo';
        _ph += `<div style="flex:1;padding:10px 20px;">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">⚠️ MÍNIMO NECESARIO</div>
          <div style="font-size:13px;font-weight:700;color:${mnColor};">${mnMsg}</div>
        </div>`;
      } else if (minN && minN.needed <= 0) {
        _ph += `<div style="flex:1;padding:10px 20px;">
          <div style="font-size:9px;color:var(--text3);font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:3px;">✅ ESTADO</div>
          <div style="font-size:13px;font-weight:700;color:#4ade80;">¡Ya alcanzaste el mínimo para aprobar!</div>
        </div>`;
      }
      projEl.innerHTML = _ph;
      wrap.appendChild(projEl);
    }

    const body = document.createElement('div');
    body.style.cssText = 'display:grid;grid-template-columns:1fr 220px;';

    const zonesDiv = document.createElement('div');
    zonesDiv.style.cssText = 'padding:16px 20px;';

    mat.zones.forEach(z => {
      const zBlock = document.createElement('div');
      zBlock.className = 'zone-block';

      if (z.isLabZone) {
        const ld = getLabNetPts(mat);
        zBlock.innerHTML = `
          <div class="zone-header" style="background:rgba(74,222,128,.05);">
            <span class="zone-title" style="color:#4ade80;">🧪 ${z.label}</span>
            <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);">máx <strong style="color:#4ade80;">${z.maxPts}</strong> pts · auto</span>
          </div>
          <div class="zone-body">${ld
            ? `<div class="linked-info">🔗 Auto del lab — ${ld.labGrade.toFixed(0)}/${ld.labScale} → <strong>${ld.netPts.toFixed(2)}/${ld.labMaxPts} pts</strong></div>`
            : `<div style="font-size:11px;color:var(--text3);padding:10px;background:var(--surface2);border-radius:7px;">🧪 Ingresa la nota en la sección del lab para verla aquí automáticamente.</div>`
          }</div>`;
        zonesDiv.appendChild(zBlock);
        return;
      }

      const subData = z.subs.map(s => {
        const v      = getG(mat.id, s.key);
        const pctVal = v !== '' ? Math.min(parseFloat(v) || 0, 100) : null;
        const netPts = pctVal !== null ? pctToNet(pctVal, s.maxPts) : null;
        return { v, pctVal, netPts, key: s.key, label: s.label, maxPts: s.maxPts };
      });
      const zFilledData = subData.filter(d => d.netPts !== null);
      const zTotal  = zFilledData.reduce((a, d) => a + d.netPts, 0);
      const zFilled = zFilledData.length;
      const zPct    = z.maxPts > 0 ? zTotal / z.maxPts * 100 : 0;
      const zColor  = zFilled ? compColor(zPct) : '#5a5a72';

      const hdr = document.createElement('div');
      hdr.className = 'zone-header';
      hdr.style.background = `rgba(100,100,100,.04)`;
      hdr.innerHTML = `<span class="zone-title" style="color:${z.color};">${z.label}</span>
        <span style="font-size:11px;font-family:'Space Mono',monospace;color:var(--text2);">
          máx <strong style="color:${z.color};">${z.maxPts}</strong> pts ·
          obtenido <strong style="color:${zColor};">${zFilled ? zTotal.toFixed(2) : '—'}</strong>
          ${zFilled ? `<span style="color:${zColor};">(${zPct.toFixed(1)}%)</span>` : ''}
        </span>`;
      zBlock.appendChild(hdr);

      const zBody = document.createElement('div');
      zBody.className = 'zone-body';
      zBody.innerHTML = `<div class="input-tip">↓ Ingresa el % que muestra la plataforma (ej: 85 = 85%)</div>`;

      subData.forEach(d => {
        const row = document.createElement('div');
        row.className = 'grade-row';
        const netColor = d.netPts !== null ? compColor(d.netPts / d.maxPts * 100) : '#5a5a72';
        row.setAttribute('data-grade-row', `${mat.id}-${d.key}`);
        row.innerHTML = `
          <div class="grade-label">${d.label} <span style="color:var(--text3);">(/${d.maxPts} pts)</span></div>
          <input type="number" class="grade-input" min="0" max="100" placeholder="%"
            value="${d.v !== '' ? d.v : ''}"
            data-mat="${mat.id}" data-key="${d.key}" data-maxpts="${d.maxPts}"
            oninput="if(parseFloat(this.value)>100){this.value=100;} setG('${mat.id}','${d.key}',this.value); _liveUpdateGradeRow(this);"
            title="Porcentaje 0–100">
          <div class="grade-pct" style="color:${netColor};">${d.pctVal !== null ? d.pctVal.toFixed(0)+'%' : '—'}</div>
          <div class="grade-net" style="color:${netColor};">${d.netPts !== null ? d.netPts.toFixed(2) : '—'}</div>
          <div class="grade-bar">
            <div class="prog-bar"><div class="prog-fill" style="background:${netColor};width:${d.netPts !== null ? Math.min(d.netPts/d.maxPts*100,100) : 0}%;"></div></div>
          </div>`;
        zBody.appendChild(row);
      });

      if (zFilled) {
        const sub = document.createElement('div');
        sub.className = 'zone-subtotal';
        sub.setAttribute('data-zone-subtotal', `${mat.id}-${z.key}`);
        sub.innerHTML = `<span style="font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;">SUBTOTAL</span>
          <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:800;color:${zColor};">${zTotal.toFixed(2)} / ${z.maxPts} pts</span>`;
        zBody.appendChild(sub);
      }
      zBlock.appendChild(zBody);
      zonesDiv.appendChild(zBlock);
    });

    body.appendChild(zonesDiv);

    const panel = document.createElement('div');
    panel.style.cssText = 'padding:16px 18px;border-left:1px solid var(--border);background:var(--surface2);';
    let ph = `<div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);letter-spacing:1px;margin-bottom:12px;text-transform:uppercase;">📊 Resumen</div>`;
    mat.zones.forEach(z => {
      let zNet = 0, zAny = false;
      if (z.isLabZone) { const ld = getLabNetPts(mat); if (ld) { zNet = ld.netPts; zAny = true; } }
      else { z.subs.forEach(s => { const v = getG(mat.id, s.key); if (v !== '') { zNet += Math.min(pctToNet(v,s.maxPts),s.maxPts); zAny = true; } }); }
      const zPct2 = z.maxPts > 0 ? zNet / z.maxPts * 100 : 0;
      ph += `<div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:7px;">
        <div style="width:8px;height:8px;border-radius:2px;background:${z.color};flex-shrink:0;"></div>
        <span style="color:var(--text2);flex:1;">${z.label}</span>
        <span style="font-family:'Space Mono',monospace;font-weight:700;color:${zAny ? compColor(zPct2) : '#5a5a72'};">${zAny ? zNet.toFixed(2)+' / '+z.maxPts : '—'}</span>
      </div>`;
    });
    ph += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--text3);letter-spacing:1px;margin-bottom:6px;text-transform:uppercase;">Total acumulado</div>
      <div style="font-size:28px;font-weight:800;color:${sc};" data-mat-total="${mat.id}">${t ? total.toFixed(2) : '—'}<span style="font-size:12px;color:var(--text3);"> / ${maxT}</span></div>
    </div>
    <div style="margin-top:14px;padding:10px;background:rgba(124,106,255,.06);border:1px solid rgba(124,106,255,.15);border-radius:8px;">
      <div style="font-size:9px;font-family:'Space Mono',monospace;color:var(--accent2);letter-spacing:1px;margin-bottom:4px;">💡 CÓMO USAR</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6;">Ingresa el <strong style="color:var(--text);">% de la plataforma</strong><br>Ej: <code style="color:var(--accent);background:var(--surface3);padding:1px 4px;border-radius:3px;">85</code> → <strong>85%</strong> → pts netos auto</div>
    </div>`;
    panel.innerHTML = ph;
    body.appendChild(panel);
    wrap.appendChild(body);
    container.appendChild(wrap);
  });
}

function scrollToMat(matId) {
  const el = document.getElementById('grades-mat-' + matId);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}

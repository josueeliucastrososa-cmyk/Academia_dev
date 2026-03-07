// ═══════════════════════════════════════════════════════════════
// STUDYSPACE — app.js (core: init, grupos, nav, helpers)
// ═══════════════════════════════════════════════════════════════

let _user         = null;
let _profile      = null;
let _groups       = [];
let _activeGroup  = null;
let _members      = [];
let _currentPage  = 'chat';

// Realtime channels
let _chatChannel  = null;
let _notesChannel = null;
let _tasksChannel = null;

// ── INIT ────────────────────────────────────────────────────────
(async () => {
  const { data: { session } } = await SS.client.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  _user = session.user;

  // Manejar invite pendiente
  const pendingInvite = sessionStorage.getItem('ss_pending_invite');
  if (pendingInvite) {
    sessionStorage.removeItem('ss_pending_invite');
    await _joinGroupByCode(pendingInvite);
  }

  // Upsert perfil
  _profile = await ssUpsertProfile(_user.id, {
    name:       _user.user_metadata?.full_name || _user.user_metadata?.name,
    avatar_url: _user.user_metadata?.avatar_url || _user.user_metadata?.picture,
    email:      _user.email
  });

  const name = _profile?.username || _user.email;
  document.getElementById('user-name').textContent       = name;
  document.getElementById('user-menu-name').textContent  = name;
  document.getElementById('user-menu-email').textContent = _user.email;
  const avatarEl = document.getElementById('user-avatar');
  if (_profile?.avatar_url) {
    avatarEl.innerHTML = `<img src="${_profile.avatar_url}" alt="avatar">`;
    document.getElementById('user-menu-avatar').innerHTML = `<img src="${_profile.avatar_url}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">`;
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }

  await _loadGroups();
})();

// ── GRUPOS ──────────────────────────────────────────────────────

async function _loadGroups() {
  try {
    _groups = await SS.DB.getMyGroups(_user.id);
    _renderGroupDropdown();
    if (_groups.length === 0) {
      document.getElementById('active-group-name').textContent = 'Sin grupos';
      _showNoGroupState();
      return;
    }
    await _setActiveGroup(_groups[0]);
  } catch(e) {
    console.error(e);
    showToast('Error cargando grupos', 'error');
  }
}

function _renderGroupDropdown() {
  const list = document.getElementById('group-list');
  list.innerHTML = _groups.map(g => `
    <div class="group-dd-item ${_activeGroup?.id === g.id ? 'active' : ''}"
         onclick="event.stopPropagation();_setActiveGroup(${JSON.stringify(g).replace(/"/g,"'")});closeGroupDropdown()">
      📂 ${_esc(g.name)}
    </div>
  `).join('');
}

async function _setActiveGroup(group) {
  SS.DB.unsubscribe(_chatChannel);
  SS.DB.unsubscribe(_notesChannel);
  SS.DB.unsubscribe(_tasksChannel);
  if (typeof _pomChannel !== 'undefined') SS.DB.unsubscribe(_pomChannel);
  _pomPage = false;
  clearInterval(typeof _pomTick !== 'undefined' ? _pomTick : null);

  _activeGroup = group;
  document.getElementById('active-group-name').textContent = group.name;
  document.getElementById('topbar-subtitle').textContent   = group.name;
  document.getElementById('user-role').textContent         = group.myRole === 'admin' ? '👑 Admin' : 'Miembro';

  _members = await SS.DB.getGroupMembers(group.id);
  document.getElementById('members-count').textContent = _members.length;

  _chatChannel  = SS.DB.subscribeMessages(group.id, _onNewMessage, _onDeleteMessage);
  _notesChannel = SS.DB.subscribeNotes(group.id, _onNoteChange);
  _tasksChannel = SS.DB.subscribeTasks(group.id, _onTaskChange);

  await _loadCurrentPage();
  _renderGroupDropdown();
}

function _showNoGroupState() {
  document.getElementById('chat-messages').innerHTML = `
    <div class="empty-state" style="flex:1;">
      <div class="empty-state-icon">🏫</div>
      <div class="empty-state-title">No perteneces a ningún grupo</div>
      <div class="empty-state-desc">Crea un grupo o pide un link de invitación a tu equipo</div>
      <button class="btn btn-primary" style="margin-top:16px;" onclick="openCreateGroup()">
        ➕ Crear primer grupo
      </button>
    </div>
  `;
}

function toggleGroupDropdown() { document.getElementById('group-dropdown').classList.toggle('open'); }
function closeGroupDropdown()  { document.getElementById('group-dropdown').classList.remove('open'); }

async function openCreateGroup() {
  closeGroupDropdown();
  closeModal('modal-user');
  document.getElementById('new-group-name').value = '';
  document.getElementById('new-group-desc').value = '';
  openModal('modal-create-group');
}

async function confirmCreateGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) { showToast('Ingresa un nombre', 'error'); return; }
  const desc = document.getElementById('new-group-desc').value.trim();
  try {
    const group = await SS.DB.createGroup(name, desc, _user.id);
    group.myRole = 'admin';
    _groups.unshift(group);
    await _setActiveGroup(group);
    closeModal('modal-create-group');
    showToast('¡Grupo creado!', 'success');
  } catch(e) {
    console.error(e);
    showToast('Error creando el grupo', 'error');
  }
}

async function _joinGroupByCode(code) {
  try {
    const { data: group } = await SS.client
      .from('social_groups').select('id, name')
      .eq('invite_code', code.toLowerCase()).single();
    if (!group) return;
    await SS.client.from('social_members').upsert(
      { group_id: group.id, user_id: _user.id, role: 'member' },
      { onConflict: 'group_id,user_id' }
    );
    showToast(`¡Te uniste a "${group.name}"!`, 'success');
  } catch(e) {}
}

// ── MODALES ─────────────────────────────────────────────────────

function openInviteModal() {
  if (!_activeGroup) return;
  const base = window.location.origin + window.location.pathname.replace('app.html', '');
  const link = `${base}index.html?invite=${_activeGroup.invite_code}`;
  document.getElementById('invite-link-url').textContent      = link;
  document.getElementById('invite-code-display').textContent  = _activeGroup.invite_code.toUpperCase();
  openModal('modal-invite');
}

function copyInviteLink() {
  const url = document.getElementById('invite-link-url').textContent;
  navigator.clipboard.writeText(url).then(() => showToast('¡Link copiado!', 'success'));
}

async function openMembersModal() {
  const list = document.getElementById('members-list');
  list.innerHTML = _members.map(m => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);">
      <div class="user-avatar" style="width:32px;height:32px;font-size:13px;">
        ${m.avatar_url ? `<img src="${m.avatar_url}">` : m.username?.charAt(0).toUpperCase() || '?'}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;">${_escHtml(m.username || 'Usuario')}</div>
        <div style="font-size:10px;color:var(--text3);">${m.role === 'admin' ? '👑 Admin' : 'Miembro'}</div>
      </div>
    </div>
  `).join('');
  openModal('modal-members');
}

async function confirmLeaveGroup() {
  if (!confirm(`¿Salir del grupo "${_activeGroup.name}"?`)) return;
  await SS.DB.leaveGroup(_activeGroup.id, _user.id);
  closeModal('modal-members');
  await _loadGroups();
  showToast('Saliste del grupo', 'info');
}

function openUserMenu() { openModal('modal-user'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
});

// ── SIDEBAR MOBILE ───────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ── NAVEGACIÓN ───────────────────────────────────────────────────

async function switchPage(page) {
  _currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  closeSidebar();

  const titles = { chat:'💬 Chat', notes:'📝 Notas compartidas', tasks:'✅ Tareas', files:'📁 Archivos', history:'🕐 Historial', pomodoro:'🍅 Pomodoro & Vaca' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';
  if      (page === 'notes') actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="createNote()">+ Nota</button>`;
  else if (page === 'tasks') actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openCreateTask()">+ Tarea</button>`;
  else if (page === 'files') actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="document.getElementById('file-input').click()">⬆ Subir</button>`;
  if (page !== 'pomodoro' && typeof _pomPage !== 'undefined') _pomPage = false;

  await _loadCurrentPage();
}

async function _loadCurrentPage() {
  if (!_activeGroup) return;
  if      (_currentPage === 'chat')    await _loadChat();
  else if (_currentPage === 'notes')   await _loadNotes();
  else if (_currentPage === 'tasks')   await _loadTasks();
  else if (_currentPage === 'files')   await _loadFiles();
  else if (_currentPage === 'history')  await _loadHistory();
  else if (_currentPage === 'pomodoro') await _loadPomodoro();
}

// ── HELPERS ──────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${_escHtml(msg)}</span>`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function _esc(str)     { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _escHtml(str) { return _esc(str); }
function _escAttr(str) { return _esc(str); }

function _timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return new Date(iso).toLocaleDateString('es-ES', { day:'numeric', month:'short' });
}

document.addEventListener('click', e => {
  if (!e.target.closest('#group-switcher')) closeGroupDropdown();
});

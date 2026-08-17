/* ---------------- وحدة تحكم المستحقات ---------------- */

let REWARDS_STATE = {
  isOpen: false,
  allRewards: [],
  statusFilter: 'all',
  rewardsQuery: '',
  historyQuery: ''
};

function renderRewardsSection() {
  const root = document.getElementById('rewardsSection');
  if (!root) return;

  root.innerHTML = `
    <div class="space-y-4 fade">
      <div class="flex items-center justify-between border-b border-[color:var(--line)] pb-3 flex-wrap gap-2">
        <div>
          <h2 class="text-sm font-bold text-white">وحدة تحكم المستحقات</h2>
          <p class="text-[11px] text-[color:var(--muted)] mt-0.5">المكافآت اللي عدّى عليها 4 أيام من غير تسليم بتتحول تلقائيًا لـ Expired.</p>
        </div>
        <button onclick="toggleDuesDoor()" id="doorToggleBtn" class="btn py-2 px-4 text-xs flex items-center gap-2 focus-ring">
          ${ICONS.gift}<span id="doorToggleLabel">...</span>
        </button>
      </div>
      <div id="rewardsPanelBody">
        <div class="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--muted)]"><div class="spinner"></div><span>جاري التحميل...</span></div>
      </div>
    </div>
  `;

  loadRewardsPanel();
}

async function loadRewardsPanel() {
  try {
    const statusRes = await fetch('/api/rewards/door-status', { credentials: 'include' });
    const statusResult = await statusRes.json();
    if (!statusResult.success) {
      document.getElementById('rewardsPanelBody').innerHTML = `<p class="text-xs text-red-400 text-center py-10">${escapeHtml(statusResult.error || 'فشل جلب حالة الباب')}</p>`;
      return;
    }
    REWARDS_STATE.isOpen = statusResult.isOpen;

    const toggleBtn = document.getElementById('doorToggleBtn');
    const toggleLabel = document.getElementById('doorToggleLabel');
    if (toggleLabel) toggleLabel.textContent = REWARDS_STATE.isOpen ? 'غلق باب المستحقات' : 'فتح باب المستحقات';
    if (toggleBtn) {
      toggleBtn.classList.toggle('btn', !REWARDS_STATE.isOpen);
      toggleBtn.classList.toggle('btn-outline', REWARDS_STATE.isOpen);
    }

    if (REWARDS_STATE.isOpen) {
      await loadRewardsList();
    } else {
      await loadDoorHistory();
    }
  } catch (e) {
    document.getElementById('rewardsPanelBody').innerHTML = `<p class="text-xs text-red-400 text-center py-10">تعذّر الاتصال بالسيرفر</p>`;
  }
}

async function toggleDuesDoor() {
  const toggleBtn = document.getElementById('doorToggleBtn');
  if (toggleBtn) toggleBtn.disabled = true;
  try {
    const endpoint = REWARDS_STATE.isOpen ? '/api/rewards/door/close' : '/api/rewards/door/open';
    const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
    const result = await res.json();
    if (!result.success) {
      toast(result.error || 'حصل خطأ', 'error');
      return;
    }
    toast(REWARDS_STATE.isOpen ? 'تم غلق باب المستحقات' : 'تم فتح باب المستحقات', 'success');
    REWARDS_STATE.statusFilter = 'all';
    REWARDS_STATE.rewardsQuery = '';
    document.getElementById('rewardsPanelBody').innerHTML = `<div class="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--muted)]"><div class="spinner"></div><span>جاري التحميل...</span></div>`;
    await loadRewardsPanel();
  } catch (e) {
    toast('تعذّر الاتصال بالسيرفر', 'error');
  } finally {
    if (toggleBtn) toggleBtn.disabled = false;
  }
}

/* ---------------- عرض المكافآت (الباب مفتوح) ---------------- */

async function loadRewardsList() {
  const body = document.getElementById('rewardsPanelBody');
  body.innerHTML = `<div class="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--muted)]"><div class="spinner"></div><span>جاري جلب المستحقات...</span></div>`;

  try {
    const res = await fetch('/api/rewards', { credentials: 'include' });
    const result = await res.json();
    if (!result.success) {
      body.innerHTML = `<p class="text-xs text-red-400 text-center py-10">${escapeHtml(result.error || 'فشل جلب المستحقات')}</p>`;
      return;
    }
    REWARDS_STATE.allRewards = result.data;
    renderRewardsPanelBody();
  } catch (e) {
    body.innerHTML = `<p class="text-xs text-red-400 text-center py-10">تعذّر الاتصال بالسيرفر</p>`;
  }
}

function renderRewardsPanelBody() {
  const body = document.getElementById('rewardsPanelBody');
  const all = REWARDS_STATE.allRewards;

  const pendingCount = all.filter(r => r.status === 'pending').length;
  const expiredCount = all.filter(r => r.status === 'expired').length;
  const deliveredCount = all.filter(r => r.status === 'delivered').length;

  body.innerHTML = `
    <div class="space-y-3">
      <div class="grid grid-cols-3 gap-2">
        <button onclick="setRewardsFilter('pending')" class="p-2.5 rounded bg-[color:var(--panel-2)] border ${REWARDS_STATE.statusFilter === 'pending' ? 'border-white' : 'border-[color:var(--line)]'} text-center focus-ring transition">
          <div class="text-sm font-bold text-white">${pendingCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">في الانتظار</div>
        </button>
        <button onclick="setRewardsFilter('expired')" class="p-2.5 rounded bg-red-500/5 border ${REWARDS_STATE.statusFilter === 'expired' ? 'border-red-400' : 'border-red-500/20'} text-center focus-ring transition">
          <div class="text-sm font-bold text-red-400">${expiredCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">Expired</div>
        </button>
        <button onclick="setRewardsFilter('delivered')" class="p-2.5 rounded bg-green-500/5 border ${REWARDS_STATE.statusFilter === 'delivered' ? 'border-green-400' : 'border-green-500/20'} text-center focus-ring transition">
          <div class="text-sm font-bold text-green-400">${deliveredCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">تم التسليم</div>
        </button>
      </div>

      ${REWARDS_STATE.statusFilter !== 'all' ? `
      <button onclick="setRewardsFilter('all')" class="text-[11px] text-blue-400 hover:underline">← عرض الكل (إلغاء الفلتر)</button>
      ` : ''}

      <div class="flex items-center gap-2">
        <input type="text" id="rewardsSearchInput" oninput="onRewardsSearchInput(this.value)" value="${escapeAttr(REWARDS_STATE.rewardsQuery)}" placeholder="ابحث بايدي/كود العسكري أو الضابط..." class="flex-1 bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-xs text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]" />
        <button onclick="loadRewardsList()" title="تحديث" class="w-9 h-9 flex items-center justify-center rounded btn-outline text-blue-400 hover:text-white hover:bg-blue-500/10 transition-colors focus-ring shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /></svg>
        </button>
      </div>

      <div id="rewardsFilteredList" class="space-y-2"></div>
    </div>
  `;

  renderFilteredRewardsList();
}

function setRewardsFilter(status) {
  REWARDS_STATE.statusFilter = REWARDS_STATE.statusFilter === status ? 'all' : status;
  renderRewardsPanelBody();
}

function onRewardsSearchInput(value) {
  REWARDS_STATE.rewardsQuery = value;
  renderFilteredRewardsList();
}

function renderFilteredRewardsList() {
  const listEl = document.getElementById('rewardsFilteredList');
  if (!listEl) return;

  const q = REWARDS_STATE.rewardsQuery.trim().toLowerCase();
  let filtered = REWARDS_STATE.allRewards;

  if (REWARDS_STATE.statusFilter !== 'all') {
    filtered = filtered.filter(r => r.status === REWARDS_STATE.statusFilter);
  }
  if (q) {
    filtered = filtered.filter(r =>
      (r.soldierId || '').toLowerCase().includes(q) ||
      (r.soldierDisplay || '').toLowerCase().includes(q) ||
      (r.officerId || '').toLowerCase().includes(q) ||
      (r.officerDisplay || '').toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = `<p class="text-xs text-[color:var(--muted)] text-center py-8">مفيش نتائج مطابقة.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderRewardRow).join('');
}

function renderRewardRow(r) {
  let statusHtml;
  if (r.status === 'delivered') {
    statusHtml = `<span class="px-2.5 py-1 rounded text-[11px] font-semibold bg-green-500/10 text-green-400 whitespace-nowrap">تم التسليم</span>`;
  } else if (r.status === 'expired') {
    statusHtml = `<span class="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-500/10 text-red-400 whitespace-nowrap">Expired</span>`;
  } else {
    statusHtml = `<button onclick="markRewardDelivered('${r.id}', this)" class="btn btn-success py-1.5 px-3 text-[11px] whitespace-nowrap focus-ring">تم التسليم</button>`;
  }

  const extra = (r.extraFields || []).map(f => `<span class="ml-2">${escapeHtml(f.label)}: <span class="text-[color:var(--text)]">${escapeHtml(f.value)}</span></span>`).join('');

  return `
    <div class="p-3 rounded bg-[color:var(--panel-2)] border border-[color:var(--line)] flex items-center justify-between flex-wrap gap-3 text-xs">
      <div class="min-w-0">
        <button onclick="openSoldierProfile('${escapeHtml(r.soldierId)}')" class="text-blue-400 hover:underline font-medium mono">${escapeHtml(r.soldierDisplay)}</button>
        <span class="text-[color:var(--muted)] mx-1">·</span>
        <span class="text-[color:var(--muted)]">الضابط: <span class="mono text-[color:var(--text)]">${escapeHtml(r.officerDisplay || '')}</span></span>
        <div class="text-[color:var(--muted)] mt-1">${escapeHtml(r.date || '')} - ${escapeHtml(r.reason || 'غير محدد')}</div>
        ${extra ? `<div class="text-[10px] text-[color:var(--muted)] mt-1">${extra}</div>` : ''}
      </div>
      ${statusHtml}
    </div>
  `;
}

async function markRewardDelivered(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const res = await fetch(`/api/rewards/${id}/deliver`, { method: 'POST', credentials: 'include' });
    const result = await res.json();
    if (result.success) {
      toast('تم تسجيل تسليم المكافأة', 'success');
      await loadRewardsList();
    } else {
      toast(result.error || 'فشل تسجيل التسليم', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'تم التسليم'; }
    }
  } catch (e) {
    toast('تعذّر الاتصال بالسيرفر', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'تم التسليم'; }
  }
}

/* ---------------- سجل فتح/غلق الباب (الباب مقفول) ---------------- */

let DOOR_HISTORY_DATA = [];

async function loadDoorHistory() {
  const body = document.getElementById('rewardsPanelBody');
  body.innerHTML = `<div class="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--muted)]"><div class="spinner"></div><span>جاري جلب السجل...</span></div>`;

  try {
    const res = await fetch('/api/rewards/door-history', { credentials: 'include' });
    const result = await res.json();
    if (!result.success) {
      body.innerHTML = `<p class="text-xs text-red-400 text-center py-10">${escapeHtml(result.error || 'فشل جلب السجل')}</p>`;
      return;
    }
    DOOR_HISTORY_DATA = result.data;
    renderDoorHistoryBody();
  } catch (e) {
    body.innerHTML = `<p class="text-xs text-red-400 text-center py-10">تعذّر الاتصال بالسيرفر</p>`;
  }
}

function renderDoorHistoryBody() {
  const body = document.getElementById('rewardsPanelBody');
  body.innerHTML = `
    <div class="space-y-3">
      <p class="text-xs text-[color:var(--muted)]">الباب مقفول حاليًا. ده سجل بكل مرة اتفتح وقفل فيها من قبل.</p>
      <div class="flex items-center gap-2">
        <input type="text" id="doorHistorySearchInput" oninput="onDoorHistorySearchInput(this.value)" value="${escapeAttr(REWARDS_STATE.historyQuery)}" placeholder="ابحث بايدي أو اسم الضابط..." class="flex-1 bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-xs text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]" />
        <button onclick="loadDoorHistory()" title="تحديث" class="w-9 h-9 flex items-center justify-center rounded btn-outline text-blue-400 hover:text-white hover:bg-blue-500/10 transition-colors focus-ring shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /></svg>
        </button>
      </div>
      <div id="doorHistoryList" class="space-y-2"></div>
    </div>
  `;
  renderFilteredDoorHistory();
}

function onDoorHistorySearchInput(value) {
  REWARDS_STATE.historyQuery = value;
  renderFilteredDoorHistory();
}

function formatDoorTime(iso) {
  if (!iso) return 'لسه مفتوح';
  try {
    return new Date(iso).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch (e) { return iso; }
}

function renderFilteredDoorHistory() {
  const listEl = document.getElementById('doorHistoryList');
  if (!listEl) return;

  const q = REWARDS_STATE.historyQuery.trim().toLowerCase();
  let filtered = DOOR_HISTORY_DATA;
  if (q) {
    filtered = filtered.filter(s =>
      (s.openedBy || '').toLowerCase().includes(q) ||
      (s.openedById || '').toLowerCase().includes(q) ||
      (s.closedBy || '').toLowerCase().includes(q) ||
      (s.closedById || '').toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = `<p class="text-xs text-[color:var(--muted)] text-center py-8">مفيش سجل فتح للباب لسه.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map(s => `
    <div class="p-3 rounded bg-[color:var(--panel-2)] border border-[color:var(--line)] text-xs space-y-1">
      <div class="text-[color:var(--text)]">فتحه: <span class="font-medium mono">${escapeHtml(s.openedBy || s.openedById || 'غير معروف')}</span></div>
      <div class="text-[color:var(--muted)]">من <span class="text-[color:var(--text)]">${escapeHtml(formatDoorTime(s.openedAt))}</span> إلى <span class="text-[color:var(--text)]">${escapeHtml(formatDoorTime(s.closedAt))}</span></div>
      ${s.closedBy ? `<div class="text-[color:var(--muted)]">قفله: <span class="text-[color:var(--text)] mono">${escapeHtml(s.closedBy)}</span></div>` : ''}
    </div>
  `).join('');
}

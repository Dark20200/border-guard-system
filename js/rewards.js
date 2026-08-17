/* ---------------- وحدة تحكم المستحقات ---------------- */

function renderRewardsSection() {
  const root = document.getElementById('rewardsSection');
  if (!root) return;

  root.innerHTML = `
    <div class="space-y-4 fade">
      <div class="flex items-center justify-between border-b border-[color:var(--line)] pb-3 flex-wrap gap-2">
        <div>
          <h2 class="text-sm font-bold text-white">وحدة تحكم المستحقات</h2>
          <p class="text-[11px] text-[color:var(--muted)] mt-0.5">فتح باب المستحقات بيجيب كل سجلات المكافآت، والمكافآت اللي عدّت عليها 4 أيام تتحول تلقائيًا لـ Expired.</p>
        </div>
        <button onclick="loadRewards()" id="openDuesDoorBtn" class="btn py-2 px-4 text-xs flex items-center gap-2 focus-ring">
          ${ICONS.gift}<span>فتح باب المستحقات</span>
        </button>
      </div>
      <div id="rewardsList" class="space-y-2">
        <p class="text-xs text-[color:var(--muted)] text-center py-10">دوس "فتح باب المستحقات" عشان تجيب كل المكافآت المسجلة.</p>
      </div>
    </div>
  `;
}

async function loadRewards() {
  const list = document.getElementById('rewardsList');
  const btn = document.getElementById('openDuesDoorBtn');
  if (!list) return;

  if (btn) btn.disabled = true;
  list.innerHTML = `<div class="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--muted)]"><div class="spinner"></div><span>جاري جلب المستحقات...</span></div>`;

  try {
    const res = await fetch('/api/rewards', { credentials: 'include' });
    const result = await res.json();

    if (btn) btn.disabled = false;

    if (!result.success) {
      list.innerHTML = `<p class="text-xs text-red-400 text-center py-10">${escapeHtml(result.error || 'فشل جلب المستحقات')}</p>`;
      return;
    }

    if (!result.data.length) {
      list.innerHTML = `<p class="text-xs text-[color:var(--muted)] text-center py-10">لا توجد أي مكافآت مسجلة حاليًا.</p>`;
      return;
    }

    const pendingCount = result.data.filter(r => r.status === 'pending').length;
    const expiredCount = result.data.filter(r => r.status === 'expired').length;
    const deliveredCount = result.data.filter(r => r.status === 'delivered').length;

    list.innerHTML = `
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div class="p-2.5 rounded bg-[color:var(--panel-2)] border border-[color:var(--line)] text-center">
          <div class="text-sm font-bold text-white">${pendingCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">في الانتظار</div>
        </div>
        <div class="p-2.5 rounded bg-red-500/5 border border-red-500/20 text-center">
          <div class="text-sm font-bold text-red-400">${expiredCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">Expired</div>
        </div>
        <div class="p-2.5 rounded bg-green-500/5 border border-green-500/20 text-center">
          <div class="text-sm font-bold text-green-400">${deliveredCount}</div>
          <div class="text-[10px] text-[color:var(--muted)]">تم التسليم</div>
        </div>
      </div>
      ${result.data.map(renderRewardRow).join('')}
    `;
  } catch (e) {
    if (btn) btn.disabled = false;
    list.innerHTML = `<p class="text-xs text-red-400 text-center py-10">تعذّر الاتصال بالسيرفر</p>`;
  }
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
      loadRewards();
    } else {
      toast(result.error || 'فشل تسجيل التسليم', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'تم التسليم'; }
    }
  } catch (e) {
    toast('تعذّر الاتصال بالسيرفر', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'تم التسليم'; }
  }
}

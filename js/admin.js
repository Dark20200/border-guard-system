let ADMIN_FILTER = 'pending';
let ALL_REQUESTS = [];

function renderAdminSectionShell() {
  const adminSec = document.getElementById('adminSection');
  if (!adminSec) return;
  adminSec.innerHTML = `
    <div class="card p-5 fade">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 class="text-sm font-bold">إدارة طلبات الأعضاء</h2>
        <div class="flex gap-2">
          <button onclick="setAdminFilter('pending')" id="filterPending" class="chip px-3 py-1 text-xs active">قيد الانتظار</button>
          <button onclick="setAdminFilter('approved')" id="filterApproved" class="chip px-3 py-1 text-xs">المقبولون</button>
          <button onclick="setAdminFilter('rejected')" id="filterRejected" class="chip px-3 py-1 text-xs">المرفوضون</button>
        </div>
      </div>
      <div id="adminRequestsList" class="overflow-x-auto">
        <div class="text-center py-10 text-[color:var(--muted)] text-xs">جاري التحميل...</div>
      </div>
    </div>
  `;
}

function setAdminFilter(filter) {
  ADMIN_FILTER = filter;
  ['pending', 'approved', 'rejected'].forEach(f => {
    const btn = document.getElementById(`filter${f.charAt(0).toUpperCase() + f.slice(1)}`);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  renderAdminRequestsTable();
}

async function loadAdminRequests() {
  try {
    const res = await fetch('/api/admin/requests', { credentials: 'include' });
    if (!res.ok) throw new Error('فشل جلب الطلبات');
    ALL_REQUESTS = await res.json();
    renderAdminRequestsTable();
  } catch (e) {
    console.error(e);
    toast('تعذّر جلب قائمة الطلبات', 'error');
  }
}

function renderAdminRequestsTable() {
  const container = document.getElementById('adminRequestsList');
  if (!container) return;
  const filtered = ALL_REQUESTS.filter(r => r.status === ADMIN_FILTER);

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-10 text-[color:var(--muted)] text-xs">لا توجد طلبات في هذه القائمة</div>`;
    return;
  }

  let html = `
    <table class="w-full text-right text-xs">
      <thead>
        <tr class="border-b border-[color:var(--line)] text-[color:var(--muted)]">
          <th class="pb-2.5 font-medium">المستخدم</th>
          <th class="pb-2.5 font-medium">الرتبة</th>
          <th class="pb-2.5 font-medium text-left">الإجراءات</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(req => {
    const isOwnerUser = (req.id === "450047099288027146");
    const avatarUrl = getDiscordAvatarUrl(req);
    const userAvatarHtml = avatarUrl ? `<img src="${avatarUrl}" alt="${req.username}">` : initial(req.username);
    const reqDisplayName = getDisplayName(req);

    const ranksList = [
      "قائد حرس الحدود", "نائب قائد حرس الحدود", "لواء أركان", "عميد ركن", 
      "عقيد ركن", "مقدم ركن", "رائد", "نقيب", "ملازم أول", "ملازم", 
      "رئيس رقباء", "رقيب أول", "رقيب", "وكيل رقيب", "عريف", "جندي أول", "جندي",
      "قاضي عسكري", "محقق الشؤون القانونية", "الشؤون القانونية"
    ];

    let rankOptionsHtml = '';
    ranksList.forEach(r => {
      const isSelected = (req.rank === r || (!req.rank && r === 'جندي')) ? 'selected' : '';
      rankOptionsHtml += `<option value="${r}" ${isSelected}>${r}</option>`;
    });

    html += `
      <tr class="row">
        <td class="py-3 font-medium text-[color:var(--text)]">
          <div class="flex items-center gap-2.5">
            <div class="avatar w-8 h-8">${userAvatarHtml}</div>
            <div>
              <span>${reqDisplayName}</span>
              <span class="text-[10px] text-[color:var(--muted)] block mono">${req.id}</span>
            </div>
          </div>
        </td>
        <td class="py-3">
          <select id="rank-${req.id}" onchange="updateRankDirectly('${req.id}')" class="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded px-2 py-1 text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]" ${isOwnerUser ? 'disabled' : ''}>
            ${rankOptionsHtml}
          </select>
        </td>
        <td class="py-3 text-left">
          ${isOwnerUser ? `
            <span class="text-[11px] px-2.5 py-1 rounded bg-[color:var(--panel-2)] border border-[color:var(--line)] text-[color:var(--muted)]">مطور</span>
          ` : `
            <div class="flex items-center justify-end gap-1.5">
              ${ADMIN_FILTER !== 'approved' ? `<button onclick="handleAdminAction('${req.id}', 'approved')" class="btn btn-success px-2.5 py-1 rounded text-xs">قبول</button>` : ''}
              ${ADMIN_FILTER !== 'rejected' ? `<button onclick="handleAdminAction('${req.id}', 'rejected')" class="btn btn-danger px-2.5 py-1 rounded text-xs">رفض</button>` : ''}
              ${ADMIN_FILTER !== 'pending' ? `<button onclick="handleAdminAction('${req.id}', 'pending')" class="btn btn-warning px-2.5 py-1 rounded text-xs">إعادة للانتظار</button>` : ''}
            </div>
          `}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function updateRankDirectly(userId) {
  if (userId === "450047099288027146") return;
  const rankSelect = document.getElementById(`rank-${userId}`);
  const rank = rankSelect ? rankSelect.value : 'جندي';
  const userObj = ALL_REQUESTS.filter(r => r.id === userId)[0];
  const action = userObj ? userObj.status : 'approved';

  try {
    await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action, rank })
    });
    if (userObj) userObj.rank = rank;
    toast('تم تغيير وحفظ الرتبة بنجاح', 'success');
  } catch (e) {
    toast('حدث خطأ أثناء حفظ الرتبة', 'error');
  }
}

async function handleAdminAction(userId, action) {
  if (userId === "450047099288027146") return;
  const rankSelect = document.getElementById(`rank-${userId}`);
  const rank = rankSelect ? rankSelect.value : 'جندي';

  try {
    await fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, action, rank })
    });
    toast('تم تحديث حالة المستخدم بنجاح', 'success');
    loadAdminRequests();
  } catch (e) {
    toast('حدث خطأ أثناء تنفيذ الإجراء', 'error');
  }
}

async function fetchPendingCount() {
  try {
    const res = await fetch('/api/admin/requests', { credentials: 'include' });
    if (!res.ok) return;
    const requests = await res.json();
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('pendingBadgeNav');
    const bellWrapper = document.getElementById('bellIconWrapper');

    if (badge && bellWrapper) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.classList.remove('hidden');
        bellWrapper.classList.add('bell-shaking');
      } else {
        badge.classList.add('hidden');
        bellWrapper.classList.remove('bell-shaking');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

setInterval(async () => {
    try {
        const response = await fetch('/api/user', { credentials: 'include' });
        const data = await response.json();
        if (data.loggedIn && CURRENT_USER_DATA) {
            if (data.rank !== CURRENT_USER_DATA.rank || data.perm !== CURRENT_USER_DATA.perm) {
                CURRENT_USER_DATA = data;
                const rankElement = document.querySelector('header span[class*="rounded"]');
                if (rankElement && data.rank) rankElement.textContent = data.rank;
            }
        }
    } catch (e) {}
}, 10000);
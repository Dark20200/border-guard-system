/* ---------------- Toast ---------------- */
function toast(message, kind = 'info') {
  const host = document.getElementById('toastHost');
  const colors = {
    info:    { fg:'var(--text)' },
    success: { fg:'var(--green)' },
    error:   { fg:'var(--red)' },
  }[kind] || { fg:'var(--text)' };

  const el = document.createElement('div');
  el.className = 'toast card px-4 py-2 shadow text-sm';
  el.style.color = colors.fg;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 2400);
}

/* ---------------- Icons & Helpers ---------------- */
const ICONS = {
  home: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  file: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.33 21a1.94 1.94 0 0 0 3.34 0"/></svg>`,
  logout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  discord: `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  clock: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  x: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
};

function getDisplayName(userObj) {
  if (!userObj) return 'مستخدم';
  return userObj.rpName || userObj.global_name || userObj.username || 'مستخدم';
}

function getDiscordAvatarUrl(userObj) {
  if (!userObj) return null;
  if (userObj.avatarUrl) return userObj.avatarUrl;
  if (userObj.avatar_url) return userObj.avatar_url;
  if (userObj.id && userObj.avatar) {
    const ext = userObj.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${userObj.id}/${userObj.avatar}.${ext}?size=128`;
  }
  return null;
}

function initial(name){ return (name || '?').trim().charAt(0).toUpperCase(); }

function renderAuth(inner) {
  const root = document.getElementById('appRoot');
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-sm fade">
        <div class="flex items-center gap-2 justify-center mb-6 text-[color:var(--muted)]">
          <img src="assets/shield.png" alt="شعار" class="w-5 h-5 object-contain">
          <span class="text-sm font-semibold text-white drop-shadow">قطاع حرس الحدود</span>
        </div>
        <div class="card p-6 shadow-xl">${inner}</div>
      </div>
    </div>
  `;
}

renderAuth(`
  <div class="flex items-center gap-3 justify-center py-4">
    <div class="spinner"></div>
    <span class="text-sm text-[color:var(--muted)]">جاري التحقق من بيانات الحساب...</span>
  </div>
`);

let CURRENT_USER_DATA = null;

window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  if (error === 'pending_approval') {
    renderAuth(`
      <div class="text-center">
        <div class="text-[color:var(--amber)] flex justify-center mb-3">${ICONS.clock}</div>
        <h1 class="text-base font-bold mb-1.5">طلبك قيد المراجعة</h1>
        <p class="text-[color:var(--muted)] text-sm mb-5 leading-relaxed">تم تسجيل الدخول بنجاح، ولكن يلزم موافقة صاحب الموقع للدخول إلى النظام.</p>
        <a href="/" class="btn-outline block text-sm py-2 focus-ring">تحديث حالة الطلب</a>
      </div>
    `);
    return;
  }

  if (error === 'not_in_sheet') {
    renderAuth(`
      <div class="text-center">
        <div class="text-[color:var(--red)] flex justify-center mb-3">${ICONS.x}</div>
        <h1 class="text-base font-bold mb-1.5">عذرًا، غير مسجل بالجدول</h1>
        <p class="text-[color:var(--muted)] text-sm mb-5 leading-relaxed">معرف ديسكورد الخاص بك غير مدرج في جدول حرس الحدود المعتمد.</p>
        <a href="/" class="btn-outline block text-sm py-2 focus-ring">تسجيل الدخول بحساب آخر</a>
      </div>
    `);
    return;
  }

  if (error === 'rejected') {
    renderAuth(`
      <div class="text-center">
        <div class="text-[color:var(--red)] flex justify-center mb-3">${ICONS.x}</div>
        <h1 class="text-base font-bold mb-1.5">تم رفض الطلب</h1>
        <p class="text-[color:var(--muted)] text-sm mb-5 leading-relaxed">عذرًا، تم رفض طلب انضمامك لهذه اللوحة من قِبل الإدارة.</p>
        <a href="/" class="btn-outline block text-sm py-2 focus-ring">تسجيل الدخول بحساب آخر</a>
      </div>
    `);
    return;
  }

  try {
    const res = await fetch('/api/user', { credentials: 'include' });
    const data = await res.json();

    if (!data.loggedIn) {
      renderAuth(`
        <div class="text-center">
          <h1 class="text-base font-bold mb-1.5">تسجيل الدخول</h1>
          <p class="text-[color:var(--muted)] text-sm mb-5 leading-relaxed">قم بتسجيل الدخول بحساب ديسكورد للوصول إلى لوحة تحكم شؤون حرس الحدود.</p>
          <button onclick="loginWithDiscord()" class="btn w-full py-2.5 flex items-center justify-center gap-2 focus-ring">
            ${ICONS.discord} تسجيل الدخول بـ Discord
          </button>
        </div>
      `);
    } else if (data.status === 'approved') {
      renderDashboard(data);
    } else {
      window.location.href = '/?error=pending_approval';
    }
  } catch (e) {
    console.error('خطأ:', e);
    toast('تعذّر الاتصال بالسيرفر', 'error');
  }
});

function loginWithDiscord() { window.location.href = `/auth/discord`; }
function logout() { window.location.href = '/auth/logout'; }

function renderDashboard(data) {
  CURRENT_USER_DATA = data;
  const root = document.getElementById('appRoot');
  const avatarSrc = getDiscordAvatarUrl(data.user);
  const userAvatarHtml = avatarSrc ? `<img src="${avatarSrc}" alt="${data.user.username}">` : initial(data.user.username);
  const displayName = getDisplayName(data.user);

  let badgeHtml = '';
  if (data.isOwner) {
    badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded border border-[color:var(--line)] text-[color:var(--muted)]">مطور</span>`;
  } else if (data.rank) {
    badgeHtml = `<span class="text-[10px] px-2 py-0.5 rounded border border-[color:var(--line)] text-[color:var(--muted)]">${data.rank}</span>`;
  }

  const canManageRequests = data.isOwner || data.rank === 'قائد حرس الحدود' || data.rank === 'نائب قائد حرس الحدود';

  root.innerHTML = `
    <div class="min-h-screen flex flex-col">
      <header class="border-b border-[color:var(--line)]" style="background:var(--panel);">
        <div class="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-2 text-[color:var(--muted)]">
            <img src="assets/shield.png" alt="شعار" class="w-5 h-5 object-contain">
            <span class="text-sm font-medium text-[color:var(--text)]">قطاع حرس الحدود</span>
          </div>

          <nav class="flex items-center gap-5">
            <button onclick="switchTab('home')" id="navHome" class="tab active flex items-center gap-1.5 pb-3 -mb-3 text-sm focus-ring">
              ${ICONS.home}<span>الرئيسية</span>
            </button>
            <button onclick="switchTab('analyzer')" id="navAnalyzer" class="tab flex items-center gap-1.5 pb-3 -mb-3 text-sm focus-ring">
              ${ICONS.file}<span>تحليل القرارات</span>
            </button>
            <button onclick="switchTab('archive')" id="navArchive" class="tab flex items-center gap-1.5 pb-3 -mb-3 text-sm focus-ring">
              ${ICONS.clock}<span>الأرشيف والسجلات</span>
            </button>
          </nav>

          <div class="flex items-center gap-3">
            ${badgeHtml}
            ${canManageRequests ? `
            <button onclick="switchTab('admin')" id="navAdminBtn" class="btn-outline p-2 text-xs flex items-center justify-center relative focus-ring rounded-lg transition" title="إدارة الطلبات">
              <span id="bellIconWrapper" class="flex items-center justify-center text-[color:var(--text)]">${ICONS.bell}</span>
              <span id="pendingBadgeNav" class="hidden absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow">0</span>
            </button>` : ''}

            <div class="relative group py-1">
              <div class="flex items-center gap-2 cursor-pointer p-1 rounded-md transition hover:bg-[color:var(--panel-2)]">
                <span class="text-sm text-[color:var(--text)] font-medium">${displayName}</span>
                <div class="avatar">${userAvatarHtml}</div>
              </div>
              <div class="absolute left-0 top-full mt-1 w-48 card p-1.5 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 flex flex-col gap-1">
                <button onclick="logout()" class="w-full text-right flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-[color:var(--panel-2)] btn-logout transition">
                  ${ICONS.logout}<span>خروج</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 max-w-5xl w-full mx-auto px-5 py-6">
        <div id="homeSection"></div>
        <div id="analyzerSection" class="hidden"></div>
        <div id="archiveSection" class="hidden"></div>
        <div id="adminSection" class="hidden"></div>
      </main>
    </div>
  `;

  renderHomeSection(data);
  if (typeof renderAnalyzerSection === 'function') renderAnalyzerSection();
  if (typeof renderArchiveSection === 'function') renderArchiveSection();
  if (typeof renderAdminSectionShell === 'function') renderAdminSectionShell();
  if (canManageRequests && typeof fetchPendingCount === 'function') fetchPendingCount();
}

function switchTab(tabName) {
  const isHome = tabName === 'home';
  const isAnalyzer = tabName === 'analyzer';
  const isArchive = tabName === 'archive';
  const isAdmin = tabName === 'admin';

  document.getElementById('homeSection').classList.toggle('hidden', !isHome);
  document.getElementById('analyzerSection').classList.toggle('hidden', !isAnalyzer);
  const archiveSec = document.getElementById('archiveSection');
  if (archiveSec) archiveSec.classList.toggle('hidden', !isArchive);
  const adminSec = document.getElementById('adminSection');
  if (adminSec) adminSec.classList.toggle('hidden', !isAdmin);

  document.getElementById('navHome').classList.toggle('active', isHome);
  document.getElementById('navAnalyzer').classList.toggle('active', isAnalyzer);
  const navArchive = document.getElementById('navArchive');
  if (navArchive) navArchive.classList.toggle('active', isArchive);

  const navAdminBtn = document.getElementById('navAdminBtn');
  if (navAdminBtn) {
    navAdminBtn.classList.toggle('border-blue-500', isAdmin);
    navAdminBtn.classList.toggle('text-blue-400', isAdmin);
  }

  if (isAdmin && typeof loadAdminRequests === 'function') {
    loadAdminRequests();
  }
}

function renderHomeSection(data) {
  const avatarSrc = getDiscordAvatarUrl(data.user);
  const userAvatarHtml = avatarSrc ? `<img src="${avatarSrc}" alt="${data.user.username}">` : initial(data.user.username);
  const displayName = getDisplayName(data.user);
  const roleText = data.isOwner ? "مطور النظام" : (data.rank || "عضو معتمد");

  document.getElementById('homeSection').innerHTML = `
    <div class="space-y-6 fade">
      <div class="card p-6 flex items-center justify-between flex-wrap gap-4" style="background: linear-gradient(135deg, var(--panel), var(--panel-2));">
        <div class="flex items-center gap-4">
          <div class="avatar w-14 h-14 text-lg shadow-md">${userAvatarHtml}</div>
          <div>
            <h1 class="text-lg font-bold text-white">أهلاً بك، <span class="text-blue-400">${displayName}</span></h1>
            <p class="text-xs text-[color:var(--muted)] mt-1">الرتبة في القطاع: <span class="text-[color:var(--text)] font-semibold">${roleText}</span> - لوحة تحكم شؤون حرس الحدود.</p>
          </div>
        </div>
        <div class="text-left">
          <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">النظام يعمل بكفاءة</span>
        </div>
      </div>

      <div>
        <h2 class="text-sm font-bold text-[color:var(--muted)] mb-3">الخدمات الرئيسية</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div onclick="switchTab('analyzer')" class="card p-5 cursor-pointer hover:border-blue-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">${ICONS.file}</div>
              <h3 class="text-sm font-bold mb-1 text-[color:var(--text)]">تحليل القرارات</h3>
              <p class="text-xs text-[color:var(--muted)] leading-relaxed">استخراج البيانات التلقائي من نصوص قرارات الديسكورد باستخدام الذكاء الاصطناعي.</p>
            </div>
            <div class="mt-4 pt-3 border-t border-[color:var(--line)] text-xs text-blue-400 font-medium flex items-center justify-between">
              <span>بدء الاستخدام</span><span>←</span>
            </div>
          </div>

          <div onclick="switchTab('archive')" class="card p-5 cursor-pointer hover:border-green-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div class="w-10 h-10 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">${ICONS.clock}</div>
              <h3 class="text-sm font-bold mb-1 text-[color:var(--text)]">أرشيف العقوبات وسجل الأعضاء</h3>
              <p class="text-xs text-[color:var(--muted)] leading-relaxed">لوحة بحث متكاملة عن سجلات العقوبات والأعضاء بالقطاع والاستعراض الأرشيفي.</p>
            </div>
            <div class="mt-4 pt-3 border-t border-[color:var(--line)] text-xs text-green-400 font-medium flex items-center justify-between">
              <span>استعراض الأرشيف</span><span>←</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
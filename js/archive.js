const ARCHIVE_STATE = {
  tab: 'records',
  recordsPage: 1,
  recordsLimit: 8,
  membersPage: 1,
  membersLimit: 9,
  filters: { q: '', type: '', officer: '', dateFrom: '', dateTo: '' }
};

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cleanMention(val) {
  if (!val) return 'غير محدد';
  const digits = String(val).replace(/[^0-9]/g, '');
  return digits || escapeHtml(val);
}

function memberDisplay(info, rawId) {
  if (info && info.name) {
    return { label: info.name, code: info.code || '' };
  }
  return { label: rawId || 'غير محدد', code: '' };
}

const TYPE_COLOR_PALETTE = [
  'bg-blue-500/10 text-blue-400',
  'bg-green-500/10 text-green-400',
  'bg-amber-500/10 text-amber-400',
  'bg-red-500/10 text-red-400',
  'bg-purple-500/10 text-purple-400',
  'bg-teal-500/10 text-teal-400',
];
function typeBadgeColor(type) {
  const str = String(type || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_COLOR_PALETTE[Math.abs(hash) % TYPE_COLOR_PALETTE.length];
}

function renderPagination(page, totalPages, kind) {
  if (!totalPages || totalPages <= 1) return '';
  return `
    <div class="flex items-center justify-between pt-3 mt-1 border-t border-[color:var(--line)]">
      <button onclick="changeArchivePage${kind}(-1)" ${page <= 1 ? 'disabled' : ''} class="btn-outline px-3 py-1.5 text-xs">السابق</button>
      <span class="text-[10px] text-[color:var(--muted)]">صفحة ${page} من ${totalPages}</span>
      <button onclick="changeArchivePage${kind}(1)" ${page >= totalPages ? 'disabled' : ''} class="btn-outline px-3 py-1.5 text-xs">التالي</button>
    </div>
  `;
}

function renderRecordCard(rec) {
  const type = rec.type || rec.typeFolder || 'قرار إداري';

  const soldierRaw = rec.soldierId || cleanMention(rec.soldier) || '';
  const officerRaw = cleanMention(rec.officer) || '';

  const soldierInfo = memberDisplay(rec.soldierIdInfo, soldierRaw);
  const officerInfo = memberDisplay(rec.officerInfo, officerRaw);

  return `
    <div class="p-3.5 rounded bg-[color:var(--panel-2)] border border-[color:var(--line)] space-y-2 text-xs">
      <div class="flex items-center justify-between flex-wrap gap-2 border-b border-[color:var(--line)] pb-1.5">
        <span class="px-2 py-0.5 rounded font-bold ${typeBadgeColor(type)}">${escapeHtml(type)}</span>
        <span class="text-[color:var(--muted)]">التاريخ: <span class="text-white">${escapeHtml(rec.date || 'غير محدد')}</span></span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-white">
        <div>
          <span class="text-[color:var(--muted)]">العسكري:</span>
          ${soldierRaw ? `
            <button onclick="openSoldierProfile('${escapeHtml(soldierRaw)}')" class="text-blue-400 hover:underline mono inline-flex items-center gap-1">
              <span>${escapeHtml(soldierInfo.label)}</span>
              ${soldierInfo.code ? `<span class="text-gray-400 text-[10px]">(${escapeHtml(soldierInfo.code)})</span>` : ''}
            </button>
          ` : 'غير محدد'}
        </div>
        <div>
          <span class="text-[color:var(--muted)]">الضابط المسؤول:</span>
          ${officerRaw ? `
            <span class="mono inline-flex items-center gap-1 text-white">
              <span>${escapeHtml(officerInfo.label)}</span>
              ${officerInfo.code ? `<span class="text-gray-400 text-[10px]">(${escapeHtml(officerInfo.code)})</span>` : ''}
            </span>
          ` : 'غير محدد'}
        </div>
      </div>
      ${rec.penalty ? `<div><span class="text-[color:var(--muted)]">العقوبة:</span> <span class="text-[color:var(--text)]">${escapeHtml(rec.penalty)}</span></div>` : ''}
      <div><span class="text-[color:var(--muted)]">السبب / التفاصيل:</span> <span class="text-[color:var(--text)]">${escapeHtml(rec.reason || rec.details || 'لا توجد تفاصيل')}</span></div>
      ${Array.isArray(rec.extraFields) && rec.extraFields.length ? rec.extraFields.map(f => `
        <div><span class="text-[color:var(--muted)]">${escapeHtml(f.label)}:</span> <span class="text-[color:var(--text)]">${escapeHtml(f.value)}</span></div>
      `).join('') : ''}
    </div>
  `;
}

/* ---------------- Section Shell ---------------- */
function renderArchiveSection() {
  const archiveSec = document.getElementById('archiveSection');
  if (!archiveSec) return;

  archiveSec.innerHTML = `
    <div class="space-y-6 fade">
      <!-- شريط البحث والفلاتر -->
      <div class="card p-5 space-y-3">
        <h2 class="text-sm font-bold mb-1">أرشيف العقوبات وسجلات الأعضاء</h2>
        <div class="flex flex-col sm:flex-row gap-2">
          <input type="text" id="archiveSearchInput" placeholder="ابحث باسم العسكري، الكود، المعرف، أو أي كلمة في السبب..."
            class="w-full bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2.5 text-[color:var(--text)] text-xs focus:outline-none focus:border-[color:var(--accent)] text-right"
            onkeydown="if(event.key === 'Enter') applyArchiveFilters()" />
          <div class="flex gap-2">
            <button onclick="applyArchiveFilters()" class="btn px-5 py-2.5 text-xs whitespace-nowrap">بحث</button>
            <button onclick="resetArchiveFilters()" class="btn-outline px-4 py-2.5 text-xs whitespace-nowrap">إعادة تعيين</button>
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          <select id="archiveTypeFilter" onchange="applyArchiveFilters()"
            class="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] text-xs focus:outline-none focus:border-[color:var(--accent)]">
            <option value="">كل الأنواع</option>
          </select>
          <input type="text" id="archiveOfficerFilter" placeholder="فلترة حسب الضابط (معرف)..."
            class="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] text-xs focus:outline-none focus:border-[color:var(--accent)] text-right" />
          <input type="date" id="archiveDateFrom" title="من تاريخ"
            class="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] text-xs focus:outline-none focus:border-[color:var(--accent)]" />
          <input type="date" id="archiveDateTo" title="إلى تاريخ"
            class="bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] text-xs focus:outline-none focus:border-[color:var(--accent)]" />
        </div>
      </div>

      <!-- الإحصائيات -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-4 flex items-center justify-between">
          <div><p class="text-xs text-[color:var(--muted)] mb-1">إجمالي العقوبات المسجلة</p><h3 id="statTotalPenalties" class="text-lg font-bold text-white">0</h3></div>
          <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-bold">📊</div>
        </div>
        <div class="card p-4 flex items-center justify-between">
          <div><p class="text-xs text-[color:var(--muted)] mb-1">الأعضاء المخالفين</p><h3 id="statTotalViolators" class="text-lg font-bold text-white">0</h3></div>
          <div class="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center text-sm font-bold">⚠️</div>
        </div>
        <div class="card p-4 flex items-center justify-between">
          <div><p class="text-xs text-[color:var(--muted)] mb-1">القرارات هذا الشهر</p><h3 id="statMonthDecisions" class="text-lg font-bold text-white">0</h3></div>
          <div class="w-10 h-10 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center text-sm font-bold">📈</div>
        </div>
        <div class="card p-4 flex items-center justify-between">
          <div><p class="text-xs text-[color:var(--muted)] mb-1">أنواع القرارات</p><h3 id="statTotalTypes" class="text-lg font-bold text-white">0</h3></div>
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm font-bold">🗂️</div>
        </div>
      </div>

      <!-- تبويبات فرعية -->
      <div class="flex items-center gap-5 border-b border-[color:var(--line)]">
        <button onclick="switchArchiveTab('records')" id="archiveTabRecords" class="tab active pb-3 -mb-px text-xs font-semibold focus-ring">تصفح كل السجلات</button>
        <button onclick="switchArchiveTab('members')" id="archiveTabMembers" class="tab pb-3 -mb-px text-xs font-semibold focus-ring">الأعضاء المسجلون</button>
      </div>

      <div id="archiveRecordsPanel"></div>
      <div id="archiveMembersPanel" class="hidden"></div>
    </div>

    <!-- نافذة ملف العسكري -->
    <div id="soldierModalHost"></div>
  `;

  fetchArchiveStats();
  loadArchiveRecords();
}

/* ---------------- Tabs & Filters ---------------- */
function switchArchiveTab(tab) {
  ARCHIVE_STATE.tab = tab;
  const isRecords = tab === 'records';

  document.getElementById('archiveTabRecords').classList.toggle('active', isRecords);
  document.getElementById('archiveTabMembers').classList.toggle('active', !isRecords);
  document.getElementById('archiveRecordsPanel').classList.toggle('hidden', !isRecords);
  document.getElementById('archiveMembersPanel').classList.toggle('hidden', isRecords);

  if (isRecords) loadArchiveRecords();
  else loadArchiveMembers();
}

function applyArchiveFilters() {
  ARCHIVE_STATE.filters.q = document.getElementById('archiveSearchInput').value.trim();
  ARCHIVE_STATE.filters.type = document.getElementById('archiveTypeFilter').value;
  ARCHIVE_STATE.filters.officer = document.getElementById('archiveOfficerFilter').value.trim();
  ARCHIVE_STATE.filters.dateFrom = document.getElementById('archiveDateFrom').value;
  ARCHIVE_STATE.filters.dateTo = document.getElementById('archiveDateTo').value;
  ARCHIVE_STATE.recordsPage = 1;
  ARCHIVE_STATE.membersPage = 1;

  if (ARCHIVE_STATE.tab === 'records') loadArchiveRecords();
  else loadArchiveMembers();
}

function resetArchiveFilters() {
  document.getElementById('archiveSearchInput').value = '';
  document.getElementById('archiveTypeFilter').value = '';
  document.getElementById('archiveOfficerFilter').value = '';
  document.getElementById('archiveDateFrom').value = '';
  document.getElementById('archiveDateTo').value = '';
  ARCHIVE_STATE.filters = { q: '', type: '', officer: '', dateFrom: '', dateTo: '' };
  ARCHIVE_STATE.recordsPage = 1;
  ARCHIVE_STATE.membersPage = 1;

  if (ARCHIVE_STATE.tab === 'records') loadArchiveRecords();
  else loadArchiveMembers();
}

function populateTypeFilterOptions(types) {
  const select = document.getElementById('archiveTypeFilter');
  if (!select) return;
  const current = ARCHIVE_STATE.filters.type;
  const existing = new Set(Array.from(select.options).map(o => o.value));
  (types || []).forEach(t => {
    if (!existing.has(t)) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    }
  });
  select.value = current || '';
}

/* ---------------- Stats ---------------- */
async function fetchArchiveStats() {
  try {
    const response = await fetch('/api/stats', { method: 'GET', credentials: 'include' });
    if (!response.ok) throw new Error('فشل جلب الإحصائيات من السيرفر');
    const result = await response.json();

    document.getElementById('statTotalPenalties').textContent = result.totalPenalties ?? 0;
    document.getElementById('statTotalViolators').textContent = result.totalOffenders ?? 0;
    document.getElementById('statMonthDecisions').textContent = result.monthlyDecisions ?? 0;
    document.getElementById('statTotalTypes').textContent = result.totalTypes ?? 0;
  } catch (e) {
    console.error('خطأ في جلب الإحصائيات:', e);
  }
}

/* ---------------- Records Tab ---------------- */
function changeArchivePageRecords(delta) {
  ARCHIVE_STATE.recordsPage = Math.max(1, ARCHIVE_STATE.recordsPage + delta);
  loadArchiveRecords();
}

function refreshArchiveRecords(btn) {
  if (btn) btn.querySelector('svg')?.style.setProperty('animation', 'spin .7s linear infinite');
  loadArchiveRecords();
}

async function loadArchiveRecords() {
  const panel = document.getElementById('archiveRecordsPanel');
  if (!panel) return;
  panel.innerHTML = `<div class="card p-10 text-center text-[color:var(--muted)] text-xs">جاري تحميل السجلات...</div>`;

  const params = new URLSearchParams({
    page: ARCHIVE_STATE.recordsPage,
    limit: ARCHIVE_STATE.recordsLimit,
    q: ARCHIVE_STATE.filters.q,
    type: ARCHIVE_STATE.filters.type,
    officer: ARCHIVE_STATE.filters.officer,
    dateFrom: ARCHIVE_STATE.filters.dateFrom,
    dateTo: ARCHIVE_STATE.filters.dateTo
  });

  try {
    const response = await fetch(`/api/records?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) throw new Error('فشل جلب السجلات');
    const result = await response.json();
    const records = result.data || [];

    populateTypeFilterOptions(result.types || []);

    if (records.length === 0) {
      panel.innerHTML = `<div class="card p-10 text-center text-[color:var(--muted)] text-xs">لا توجد سجلات مطابقة لمعايير البحث الحالية.</div>`;
      return;
    }

    panel.innerHTML = `
      <div class="card p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
          <h3 class="text-xs font-bold text-white">السجلات (${result.total ?? records.length})</h3>
          <div class="flex items-center gap-2">
            <button onclick="refreshArchiveRecords(this)" title="تحديث السجلات" class="w-6 h-6 flex items-center justify-center rounded btn-outline text-blue-400 hover:text-white hover:bg-blue-500/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
            <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">صفحة ${result.page} من ${result.totalPages}</span>
          </div>
        </div>
        <div class="space-y-2 max-h-[520px] overflow-y-auto pr-1">${records.map(renderRecordCard).join('')}</div>
        ${renderPagination(result.page, result.totalPages, 'Records')}
      </div>
    `;
  } catch (error) {
    console.error(error);
    panel.innerHTML = `<div class="card p-10 text-center text-red-400 text-xs">حدث خطأ أثناء جلب السجلات من السيرفر.</div>`;
  }
}

/* ---------------- Members Tab ---------------- */
function changeArchivePageMembers(delta) {
  ARCHIVE_STATE.membersPage = Math.max(1, ARCHIVE_STATE.membersPage + delta);
  loadArchiveMembers();
}

async function loadArchiveMembers() {
  const panel = document.getElementById('archiveMembersPanel');
  if (!panel) return;
  panel.innerHTML = `<div class="card p-10 text-center text-[color:var(--muted)] text-xs">جاري تحميل قائمة الأعضاء...</div>`;

  const params = new URLSearchParams({
    page: ARCHIVE_STATE.membersPage,
    limit: ARCHIVE_STATE.membersLimit,
    q: ARCHIVE_STATE.filters.q
  });

  try {
    const response = await fetch(`/api/soldiers?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) throw new Error('فشل جلب الأعضاء');
    const result = await response.json();
    const members = result.data || [];

    if (members.length === 0) {
      panel.innerHTML = `<div class="card p-10 text-center text-[color:var(--muted)] text-xs">لا يوجد أعضاء لديهم سجلات مطابقة.</div>`;
      return;
    }

    const cardsHtml = members.map(m => `
      <div onclick="openSoldierProfile('${m.id}')" class="card p-4 cursor-pointer hover:border-blue-500/50 transition-all space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-white truncate">${escapeHtml(m.rpName || ('عسكري #' + m.id))}</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 whitespace-nowrap">${m.totalRecords} سجل</span>
        </div>
        <div class="text-[10px] text-[color:var(--muted)] mono">المعرف: ${m.id}</div>
        ${m.rank ? `<div class="text-[10px] text-[color:var(--muted)]">الرتبة: <span class="text-[color:var(--text)]">${escapeHtml(m.rank)}</span></div>` : ''}
        <div class="flex flex-wrap gap-1 pt-1">
          ${Object.entries(m.typesCount || {}).map(([t, c]) => `<span class="text-[10px] px-1.5 py-0.5 rounded ${typeBadgeColor(t)}">${escapeHtml(t)}: ${c}</span>`).join('')}
        </div>
        ${m.lastSavedAt ? `<div class="text-[10px] text-[color:var(--muted)] pt-1.5 mt-1 border-t border-[color:var(--line)]">آخر نشاط: ${new Date(m.lastSavedAt).toLocaleDateString('ar-EG')}</div>` : ''}
      </div>
    `).join('');

    panel.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-white">إجمالي الأعضاء (${result.total ?? members.length})</h3>
          <span class="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">صفحة ${result.page} من ${result.totalPages}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${cardsHtml}</div>
        <div class="card p-3">${renderPagination(result.page, result.totalPages, 'Members')}</div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    panel.innerHTML = `<div class="card p-10 text-center text-red-400 text-xs">حدث خطأ أثناء جلب قائمة الأعضاء.</div>`;
  }
}

/* ---------------- Member Profile Modal ---------------- */
async function openSoldierProfile(id) {
  const cleanId = String(id).replace(/[^0-9]/g, '');
  const host = document.getElementById('soldierModalHost');
  if (!cleanId || !host) return;

  host.innerHTML = `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeSoldierProfile()">
      <div class="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4 fade">
        <div class="text-center py-10 text-[color:var(--muted)] text-xs">جاري تحميل ملف العسكري...</div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`/api/soldiers/${cleanId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('فشل جلب بيانات العسكري');
    const result = await response.json();
    const records = result.data || [];

    const timelineHtml = records.length > 0
      ? records.map(renderRecordCard).join('')
      : `<div class="text-center py-6 text-[color:var(--muted)] text-xs">لا توجد سجلات لهذا العسكري.</div>`;

    const typesHtml = Object.entries(result.typesCount || {})
      .map(([t, c]) => `<span class="text-[10px] px-2 py-0.5 rounded ${typeBadgeColor(t)}">${escapeHtml(t)}: ${c}</span>`)
      .join('');

    host.innerHTML = `
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeSoldierProfile()">
        <div class="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4 fade">
          <div class="flex items-center justify-between border-b border-[color:var(--line)] pb-3">
            <div>
              <h3 class="text-sm font-bold text-white">${escapeHtml(result.rpName || ('عسكري #' + result.id))}</h3>
              <p class="text-[10px] text-[color:var(--muted)] mono mt-0.5">المعرف: ${result.id}${result.rank ? ' • الرتبة: ' + escapeHtml(result.rank) : ''}</p>
            </div>
            <button onclick="closeSoldierProfile()" class="btn-outline px-2.5 py-1.5 text-xs">إغلاق</button>
          </div>
          <div class="flex flex-wrap gap-1.5">${typesHtml || '<span class="text-[10px] text-[color:var(--muted)]">لا توجد أنواع مسجلة</span>'}</div>
          <div class="space-y-2 max-h-[420px] overflow-y-auto pr-1">${timelineHtml}</div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    host.innerHTML = `
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onclick="if(event.target === this) closeSoldierProfile()">
        <div class="card w-full max-w-md p-5 text-center text-red-400 text-xs fade">
          حدث خطأ أثناء جلب بيانات العسكري.
          <div class="pt-3"><button onclick="closeSoldierProfile()" class="btn-outline px-4 py-1.5 text-xs">إغلاق</button></div>
        </div>
      </div>
    `;
  }
}

function closeSoldierProfile() {
  const host = document.getElementById('soldierModalHost');
  if (host) host.innerHTML = '';
}
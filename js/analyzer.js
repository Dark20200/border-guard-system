let currentExtractedData = {};
const decisionTypes = ["الاستدعاء", "المكافأة", "الفصل", "قبول", "عقوبة", "تحذير", "إجازة", "استقالة", "تحديث اكواد", "تغير هوية"];
const BASE_FIELD_IDS = ['fieldOfficer', 'fieldSoldier', 'fieldReason', 'fieldPenalty', 'fieldDate', 'fieldTotalRecords'];

function escapeAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderAnalyzerSection() {
  const container = document.getElementById('analyzerSection');
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 fade">
      <div class="lg:col-span-2 card p-5 flex flex-col justify-between">
        <div>
          <h2 class="text-sm font-bold mb-3">البيانات المستخرجة</h2>
          <div id="resultContainer" class="hidden space-y-3 text-xs">
            <div id="resultFields" class="space-y-3"></div>
          </div>
          <div id="resultEmpty" class="flex items-center justify-center text-center py-20">
            <p class="text-[color:var(--muted)] text-xs">لم يتم تحليل أي رسالة بعد</p>
          </div>
        </div>

        <div id="actionButtons" class="hidden flex flex-col gap-2 mt-4 pt-3 border-t border-[color:var(--line)]">
          <div class="flex gap-2">
            <button id="editBtn" onclick="toggleEditMode()" class="btn btn-outline flex-1 py-1.5 text-xs focus-ring">Edit</button>
            <button id="saveBtn" onclick="saveEditedData()" class="btn btn-success flex-1 py-1.5 text-xs focus-ring">Save</button>
            <button id="copyAllBtn" onclick="copyAllData()" class="btn flex-1 py-1.5 text-xs focus-ring" style="background:var(--accent);">نسخ الكل</button>
          </div>
        </div>
      </div>

      <div class="lg:col-span-3 card p-5 flex flex-col">
        <h2 class="text-sm font-bold mb-3">القرار</h2>
        <textarea id="messageInput" rows="11"
          class="w-full bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-md p-3 text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)] transition placeholder-[color:var(--muted)] text-sm leading-relaxed focus-ring"
          placeholder="الصق نص القرار هنا..."></textarea>
        <button id="analyzeBtn" onclick="analyzeMessage()" class="btn w-full mt-3 py-2.5 focus-ring">
          تحليل القرار واستخراج البيانات
        </button>
      </div>
    </div>
  `;

  applyEditPermissionVisibility();
}

function applyEditPermissionVisibility() {
  const isOwner = CURRENT_USER_DATA?.isOwner;
  const rank = CURRENT_USER_DATA?.rank || '';
  const canEdit = isOwner || rank === 'قائد حرس الحدود' || rank === 'نائب قائد حرس الحدود' || rank === 'قاضي عسكري';

  const editBtn = document.getElementById('editBtn');
  const saveBtn = document.getElementById('saveBtn');
  if (editBtn) editBtn.classList.toggle('hidden', !canEdit);
  if (saveBtn) saveBtn.classList.toggle('hidden', !canEdit);
}

function textFieldRow(id, label, value, disabled = true) {
  return `
    <div data-field-row="${id}">
      <span class="text-[color:var(--muted)] block mb-1">${escapeAttr(label)}</span>
      <div class="flex gap-2">
        <input type="text" id="${id}" value="${escapeAttr(value)}" class="w-full bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]" ${disabled ? 'disabled' : ''} />
        <button onclick="copyField('${id}')" class="btn-outline px-2.5 rounded text-xs flex items-center justify-center">📋</button>
      </div>
    </div>
  `;
}

function selectFieldRow(id, label, value, disabled = true) {
  return `
    <div data-field-row="${id}">
      <span class="text-[color:var(--muted)] block mb-1">${escapeAttr(label)}</span>
      <div class="flex gap-2">
        <select id="${id}" class="w-full bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded p-2 text-[color:var(--text)] focus:outline-none focus:border-[color:var(--accent)]" ${disabled ? 'disabled' : ''}>
          ${decisionTypes.map(t => `<option value="${t}" ${t === value ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
}

function renderResultFields(data, disabled = true) {
  const resultFields = document.getElementById('resultFields');
  if (!resultFields) return;

  const extra = Array.isArray(data.extraFields) ? data.extraFields : [];

  const html = [
    textFieldRow('fieldOfficer', 'الظابط:', data.officer, disabled),
    textFieldRow('fieldSoldier', data.soldierLabel || 'العسكري المستهدف:', data.soldier, disabled),
    textFieldRow('fieldReason', 'السبب:', data.reason, disabled),
    selectFieldRow('fieldPenalty', 'نوع القرار:', data.penalty, disabled),
    ...extra.map((f, i) => textFieldRow(`extraField_${i}`, `${f.label}:`, f.value, disabled)),
    textFieldRow('fieldDate', 'التاريخ:', data.date, disabled),
    textFieldRow('fieldTotalRecords', data.recordsLabel || 'إجمالي السجلات:', data.totalRecords, disabled)
  ].join('');

  resultFields.innerHTML = html;
}

function copyField(elementId) {
  const el = document.getElementById(elementId);
  if (!el || !el.value) { 
    toast('لا توجد بيانات للنسخ', 'error'); 
    return; 
  }
  navigator.clipboard.writeText(el.value).then(() => {
    toast('تم نسخ السطر بنجاح', 'success');
  }).catch(() => toast('فشل النسخ', 'error'));
}

function copyAllData() {
  const officer = document.getElementById('fieldOfficer')?.value || '';
  const soldier = document.getElementById('fieldSoldier')?.value || '';
  const reason = document.getElementById('fieldReason')?.value || '';
  const penalty = document.getElementById('fieldPenalty')?.value || '';
  const date = document.getElementById('fieldDate')?.value || '';
  const totalRecords = document.getElementById('fieldTotalRecords')?.value || '';

  const extra = Array.isArray(currentExtractedData.extraFields) ? currentExtractedData.extraFields : [];
  const extraLines = extra.map((f, i) => {
    const val = document.getElementById(`extraField_${i}`)?.value || '';
    return `${f.label}: ${val}`;
  }).join('\n');

  const dataText = [
    `الظابط: ${officer}`,
    `${currentExtractedData.soldierLabel || 'العسكري المستهدف:'} ${soldier}`,
    `السبب: ${reason}`,
    `نوع القرار: ${penalty}`,
    extraLines,
    `التاريخ: ${date}`,
    `${currentExtractedData.recordsLabel || 'إجمالي السجلات:'} ${totalRecords}`
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(dataText).then(() => {
    toast('تم نسخ جميع البيانات بنجاح!', 'success');
  }).catch(() => toast('فشل نسخ البيانات', 'error'));
}

async function analyzeMessage() {
  const messageInput = document.getElementById('messageInput');
  const text = messageInput ? messageInput.value : '';
  const btn = document.getElementById('analyzeBtn');
  const resultContainer = document.getElementById('resultContainer');
  const resultEmpty = document.getElementById('resultEmpty');
  const actionButtons = document.getElementById('actionButtons');

  if (!text.trim()) {
    toast('حط رسالة الأول يا غالي', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'جاري التحليل بواسطة نموذج الذكاء الاصطناعي...';
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) throw new Error('فشل الاتصال بخدمة التحليل الذكي');

    const resJson = await response.json();
    const extracted = resJson.data || resJson;

    const realToday = new Date().toLocaleDateString('ar-EG');
    const rawDate = extracted.date || extracted.fieldDate || '';
    const finalDate = (!rawDate || rawDate.includes('الوقت') || rawDate.includes('الحالي') || rawDate.includes('تاريخ اليوم')) ? realToday : rawDate;

    const penaltyVal = decisionTypes.includes(extracted.penalty || extracted.decisionType) 
      ? (extracted.penalty || extracted.decisionType) 
      : 'عقوبة';

    currentExtractedData = {
      officer: extracted.officer || extracted.fieldOfficer || 'غير محدد',
      soldier: extracted.soldier || extracted.fieldSoldier || 'غير محدد',
      soldierLabel: extracted.soldierLabel || 'العسكري المستهدف:',
      reason: extracted.reason || extracted.fieldReason || 'غير محدد',
      penalty: penaltyVal,
      date: finalDate,
      totalRecords: extracted.totalRecords || extracted.fieldTotalRecords || '1',
      recordsLabel: extracted.recordsLabel || 'إجمالي السجلات:',
      extraFields: Array.isArray(extracted.extraFields) ? extracted.extraFields : []
    };

    renderResultFields(currentExtractedData, true);

    if (resultEmpty) resultEmpty.classList.add('hidden');
    if (resultContainer) resultContainer.classList.remove('hidden');
    if (actionButtons) actionButtons.classList.remove('hidden');
    applyEditPermissionVisibility();

    const editBtn = document.getElementById('editBtn');
    if (editBtn) editBtn.textContent = 'Edit';

    toast('تم تحليل القرار بنجاح', 'success');
  } catch (error) {
    console.error(error);
    toast('حدث خطأ أثناء الاتصال بنموذج الذكاء الاصطناعي', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'تحليل القرار واستخراج البيانات';
    }
  }
}

function collectAllFieldIds() {
  const extraCount = Array.isArray(currentExtractedData.extraFields) ? currentExtractedData.extraFields.length : 0;
  const extraIds = Array.from({ length: extraCount }, (_, i) => `extraField_${i}`);
  return [...BASE_FIELD_IDS, ...extraIds];
}

function toggleEditMode() {
  const isOwner = CURRENT_USER_DATA?.isOwner;
  const rank = CURRENT_USER_DATA?.rank || '';
  const canEdit = isOwner || rank === 'قائد حرس الحدود' || rank === 'نائب قائد حرس الحدود' || rank === 'قاضي عسكري';

  if (!canEdit) {
    toast('عذرًا، ليس لديك صلاحية التعديل', 'error');
    return;
  }

  const ids = collectAllFieldIds();
  const editBtn = document.getElementById('editBtn');
  const firstInput = document.getElementById('fieldOfficer');
  if (!firstInput) return;
  const isDisabled = firstInput.disabled;

  if (isDisabled) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
    if (editBtn) editBtn.textContent = 'Cancel';
    toast('وضع التعديل مفعل، عدل ما تريد ثم اضغط Save', 'info');
  } else {
    // إلغاء التعديل: إعادة بناء الحقول من آخر بيانات محفوظة
    renderResultFields(currentExtractedData, true);
    if (editBtn) editBtn.textContent = 'Edit';
    toast('تم إلغاء التعديل', 'info');
  }
}

async function saveEditedData() {
  const extra = Array.isArray(currentExtractedData.extraFields) ? currentExtractedData.extraFields : [];
  const editBtn = document.getElementById('editBtn');

  const updatedExtraFields = extra.map((f, i) => ({
    label: f.label,
    value: document.getElementById(`extraField_${i}`)?.value || ''
  }));

  const updatedData = {
    officer: document.getElementById('fieldOfficer')?.value || '',
    soldier: document.getElementById('fieldSoldier')?.value || '',
    soldierLabel: currentExtractedData.soldierLabel,
    reason: document.getElementById('fieldReason')?.value || '',
    penalty: document.getElementById('fieldPenalty')?.value || '',
    date: document.getElementById('fieldDate')?.value || '',
    totalRecords: document.getElementById('fieldTotalRecords')?.value || '',
    recordsLabel: currentExtractedData.recordsLabel,
    extraFields: updatedExtraFields
  };

  try {
    const response = await fetch('/api/save-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updatedData)
    });

    if (!response.ok) throw new Error('فشل حفظ البيانات في السيرفر');

    currentExtractedData = updatedData;
    renderResultFields(currentExtractedData, true);
    if (editBtn) editBtn.textContent = 'Edit';

    toast('تم حفظ وإرسال القرار في الملف بنجاح!', 'success');
  } catch (error) {
    console.error(error);
    toast('حدث خطأ أثناء الحفظ', 'error');
  }
}

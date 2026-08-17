import { Groq } from 'groq-sdk';
import { ObjectId } from 'mongodb';
import { getUsersDB, saveUsersDB, canManageAdmin, OWNER_DISCORD_ID } from './db.js';
import { getSheetData, getCharacterNameFromSheet, getRankFromSheet, getPermFromSheet, updateCharacterNameInSheet } from './sheets.js';
import { getRecordsCollection } from './mongo.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// كاش بسيط لأسماء/أكواد الشيت خاص بلوحة المستحقات (دقيقة واحدة)
let rewardsSheetCache = { data: null, at: 0 };
async function getRewardsSheetMap() {
    const now = Date.now();
    if (rewardsSheetCache.data && (now - rewardsSheetCache.at) < 60000) return rewardsSheetCache.data;
    const map = {};
    try {
        const rows = await getSheetData('A:E');
        (rows || []).forEach(row => {
            const cleanId = row[0] ? String(row[0]).replace(/[^0-9]/g, '') : '';
            if (cleanId) {
                map[cleanId] = {
                    name: row[2] ? String(row[2]).trim() : '',
                    code: row[3] ? String(row[3]).trim() : ''
                };
            }
        });
    } catch (e) {
        console.error('تعذر تحميل بيانات الشيت لوحدة المستحقات:', e.message);
    }
    rewardsSheetCache = { data: map, at: now };
    return map;
}

export function setupApiRoutes(app) {
    app.get('/api/sheet-data', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }
        const data = await getSheetData('Sheet1!A1:Q100');
        res.json({ success: true, data });
    });

    app.get('/api/user', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.json({ loggedIn: false });
        }

        const db = await getUsersDB();
        const userId = req.user.id;
        const isOwner = userId === OWNER_DISCORD_ID;
        const status = isOwner ? 'approved' : (db[userId]?.status || 'pending');

        let sheetRpName = await getCharacterNameFromSheet(userId);
        let sheetRank = await getRankFromSheet(userId);
        let sheetPerm = await getPermFromSheet(userId);

        if (!db[userId]) {
            db[userId] = {};
        }

        if (sheetRank) db[userId].rank = sheetRank;
        db[userId].perm = sheetPerm !== undefined ? sheetPerm : '';
        if (sheetRpName) db[userId].rpName = sheetRpName;
        
        await saveUsersDB(db);

        res.json({
            loggedIn: true,
            user: {
                id: req.user.id,
                username: db[userId]?.username || req.user.username,
                rpName: sheetRpName || db[userId]?.rpName || req.user.username,
                avatar: db[userId]?.avatar || req.user.avatar
            },
            status: status,
            isOwner: isOwner,
            rank: sheetRank || db[userId]?.rank || 'جندي',
            perm: sheetPerm !== undefined ? sheetPerm : (db[userId]?.perm || '')
        });
    });

    app.get('/api/admin/requests', async (req, res) => {
        if (!req.isAuthenticated() || !(await canManageAdmin(req.user.id))) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }

        const db = await getUsersDB();
        const currentUserId = req.user.id;

        let requests = await Promise.all(Object.keys(db).map(async (id) => {
            let sheetRpName = await getCharacterNameFromSheet(id);
            let sheetRank = await getRankFromSheet(id);
            let sheetPerm = await getPermFromSheet(id);
            return {
                id,
                username: db[id].username,
                rpName: sheetRpName || db[id].rpName || db[id].username,
                avatar: db[id].avatar || null,
                status: db[id].status,
                rank: sheetRank || db[id].rank || 'جندي',
                perm: sheetPerm !== undefined ? sheetPerm : (db[id].perm || '')
            };
        }));

        requests.sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return 0;
        });

        res.json(requests);
    });

    app.post('/api/admin/action', async (req, res) => {
        if (!req.isAuthenticated() || !(await canManageAdmin(req.user.id))) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }

        const { userId, action, rank, perm } = req.body; 
        const currentUserId = req.user.id;
        const db = await getUsersDB();

        if (userId === OWNER_DISCORD_ID && currentUserId !== OWNER_DISCORD_ID) {
            return res.status(403).json({ error: 'لا يمكنك تعديل صلاحيات أو رتبة الأونر' });
        }

        if (db[userId]) {
            db[userId].status = action;
            if (rank !== undefined && rank !== null) db[userId].rank = rank;
            if (perm !== undefined && perm !== null) db[userId].perm = perm;

            await saveUsersDB(db);
            return res.json({ success: true });
        }

        res.status(404).json({ error: 'المستخدم غير موجود' });
    });

    app.post('/api/analyze', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }

        const message = req.body.message || req.body.msg;
        if (!message) return res.status(400).json({ error: 'النص مطلوب' });

        try {
            const currentDateStr = new Date().toLocaleDateString('ar-EG');
            const decisionTypesList = ["الاستدعاء", "المكافأة", "الفصل", "قبول", "عقوبة", "تحذير", "إجازة", "استقالة", "تحديث اكواد", "تغير هوية"];

            const completion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `أنت مساعد ذكي ومحترف لتحليل قرارات الشؤون العسكرية وحرس الحدود من رسائل الديسكورد. كل نوع قرار له طبيعة بيانات مختلفة تمامًا، ومهمتك إنك تفهم نوع القرار الأول، وبعدين تستخرج البيانات المناسبة له بالظبط (مش نفس الحقول الثابتة لكل الأنواع).

**الخطوة 1 - تحديد نوع القرار (decisionType):**
اختر نوعًا واحدًا فقط من هذه القائمة الثابتة (انسخ النص حرفيًا كما هو بالظبط بدون أي تعديل):
[${decisionTypesList.map(t => `"${t}"`).join(', ')}]

**الخطوة 2 - استخراج الحقول الأساسية:**
1. **officer:** منشن المستخدم الحقيقي (مثل <@ID>) الذي أصدر أو وقّع أو اعتمد القرار فعليًا (وليس الرول أو الجهة العامة مثل <@&ID>)، بدون أي إيموجي أو رموز.
2. **soldier:** منشن العسكري/العسكريين المستهدفين بالقرار. لو أكتر من شخص، اكتب كل المنشنات مفصولة بمسافة في نفس الحقل (مثال: "<@111> <@222>").
3. **soldierLabel:** تسمية مناسبة للحقل حسب نوع القرار (مثال: عقوبة → "العسكري المتعاقب:"، مكافأة → "العسكري/العسكريين المكرّمين:"، استدعاء → "العسكري المستدعى:"، قبول → "العسكري المقبول:"، إجازة → "العسكري صاحب الإجازة:"، استقالة → "العسكري المستقيل:"، فصل → "العسكري المفصول:"، تحذير → "العسكري المحذَّر:"، تحديث اكواد/تغير هوية → "العسكري المعني:").
4. **reason:** السبب أو التفاصيل أو الغرض الأساسي من القرار.
5. **date:** التاريخ المذكور في النص إن وُجد، وإلا استخدم حصراً: "${currentDateStr}".
6. **totalRecords:** العدد الإجمالي للأشخاص/السجلات المستهدفة بالقرار.
7. **recordsLabel:** تسمية مناسبة لحقل الإجمالي حسب نوع القرار (مثال: عقوبة → "إجمالي سجلات عقابات العسكري:"، مكافأة → "إجمالي عدد المكرَّمين:"، إجازة → "إجمالي عدد الإجازات:"، إلخ).

**الخطوة 3 - استخراج extraFields (بيانات إضافية خاصة بنوع القرار فقط، مش مكررة مع الحقول فوق):**
استخرج أي بيانات مهمة موجودة فعليًا في النص ومرتبطة بطبيعة نوع القرار تحديدًا، كمصفوفة من { "label": "...", "value": "..." }. لو مفيش بيانات إضافية حقيقية، رجّع مصفوفة فاضية []. أمثلة توجيهية (مش قائمة ملزمة، استخدم اللي يظهر فعلاً بالنص فقط):
- المكافأة → "قيمة المكافأة"، "الجهة المانحة" (لو مذكورة كرول منفصل عن الموقّع)
- إجازة → "مدة الإجازة"، "تاريخ البداية"، "تاريخ النهاية"
- تحديث اكواد → "الكود القديم"، "الكود الجديد"
- تغير هوية → "الاسم/الهوية القديمة"، "الاسم/الهوية الجديدة"
- قبول → "الرتبة الممنوحة"، "الفرقة/القسم"
- عقوبة/تحذير → "درجة العقوبة" أو "نوع الإنذار" (لو مختلف عن reason)
- فصل/استقالة → "تاريخ سريان القرار"
- استدعاء → "موعد الاستدعاء"، "مكان الاستدعاء"

لا تخترع بيانات غير موجودة في النص أبدًا. لو حقل مش موجود في النص خالص، سيبه ولا تضيفه لـ extraFields.

**الخطوة 4 - تحديد تحديث الشيت (sheetUpdate):**
بغض النظر عن نوع القرار، افحص النص وحدد: هل فيه تغيير فعلي في **اسم** العسكري أو **كوده** المسجل في الجدول الرسمي؟ ده ممكن يحصل مع أي نوع قرار مش بس "تغير هوية" أو "تحديث اكواد" (مثلاً قرار قبول بيدي اسم جديد للمجند، أو قرار عقوبة بيغيّر كود كعقوبة إضافية). 
- لو النص فعلاً بيذكر اسم جديد أو كود جديد محدد وواضح للعسكري، رجّع "shouldUpdate": true مع القيم.
- لو مفيش تغيير اسم/كود واضح ومباشر في النص (الحالة الشائعة في معظم القرارات)، رجّع "shouldUpdate": false.
- لا تخمّن أو تفترض قيم غير مذكورة صراحة في النص.

أرجع النتيجة حصراً بتنسيق JSON بالمفاتيح التالية، بدون أي نص إضافي قبلها أو بعدها:
{
  "decisionType": "...",
  "officer": "...",
  "soldier": "...",
  "soldierLabel": "...",
  "reason": "...",
  "date": "...",
  "totalRecords": "...",
  "recordsLabel": "...",
  "extraFields": [ { "label": "...", "value": "..." } ],
  "sheetUpdate": { "shouldUpdate": false, "newName": null, "newCode": null }
}`
                    },
                    { role: "user", content: message }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.choices[0].message.content;
            const extractedData = JSON.parse(rawContent);

            const rawType = extractedData.decisionType || extractedData.penalty || extractedData.fieldPenalty || '';
            const matchedType = decisionTypesList.find(t => t === rawType)
                || decisionTypesList.find(t => rawType && (rawType.includes(t) || t.includes(rawType)))
                || 'عقوبة';

            const rawDate = extractedData.date || '';
            const finalDate = (!rawDate || rawDate.includes('الوقت') || rawDate.includes('الحالي') || rawDate.includes('تاريخ اليوم'))
                ? currentDateStr : rawDate;

            const extraFields = Array.isArray(extractedData.extraFields)
                ? extractedData.extraFields
                    .filter(f => f && f.label && f.value)
                    .map(f => ({ label: String(f.label), value: String(f.value) }))
                : [];

            const rawSheetUpdate = extractedData.sheetUpdate || {};
            const sheetUpdate = {
                shouldUpdate: Boolean(rawSheetUpdate.shouldUpdate) && (Boolean(rawSheetUpdate.newName) || Boolean(rawSheetUpdate.newCode)),
                newName: rawSheetUpdate.newName ? String(rawSheetUpdate.newName).trim() : null,
                newCode: rawSheetUpdate.newCode ? String(rawSheetUpdate.newCode).trim() : null
            };

            const formattedData = {
                officer: extractedData.officer || extractedData.fieldOfficer || 'غير محدد',
                soldier: extractedData.soldier || extractedData.fieldSoldier || 'غير محدد',
                soldierLabel: extractedData.soldierLabel || 'العسكري المستهدف:',
                reason: extractedData.reason || extractedData.fieldReason || 'غير محدد',
                penalty: matchedType,
                decisionType: matchedType,
                date: finalDate,
                totalRecords: extractedData.totalRecords || extractedData.fieldTotalRecords || '1',
                recordsLabel: extractedData.recordsLabel || 'إجمالي السجلات:',
                extraFields,
                sheetUpdate
            };

            res.json({ success: true, data: formattedData });
        } catch (error) {
            console.error("خطأ في تحليل Groq:", error);
            res.status(500).json({ success: false, error: 'فشل تحليل القرار عبر الذكاء الاصطناعي' });
        }
    });

    app.post('/api/save-data', async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }

        const { soldier, officer, reason, penalty, date, type, extraFields, sheetUpdate } = req.body;
        if (!soldier || !officer) return res.status(400).json({ error: 'بيانات العسكري أو الضابط مفقودة' });

        const cleanExtraFields = Array.isArray(extraFields)
            ? extraFields.filter(f => f && f.label && f.value).map(f => ({ label: String(f.label), value: String(f.value) }))
            : [];

        const soldierIds = soldier.match(/\d+/g) || [];

        if (soldierIds.length === 0) {
            return res.status(400).json({ error: 'لم يتم العثور على رقم عسكري صالح' });
        }

        try {
            const decisionType = penalty || type || 'عقوبة';
            const col = await getRecordsCollection();

            const docs = soldierIds.map(cleanSoldierId => ({
                soldierId: cleanSoldierId,
                soldier,
                officer,
                reason,
                penalty: decisionType,
                date: date || new Date().toLocaleDateString('ar-EG'),
                type: decisionType,
                extraFields: cleanExtraFields,
                savedAt: new Date().toISOString(),
                savedBy: req.user.username
            }));

            // بيتحفظ سجل منفصل لكل عسكري مذكور، زي ما كان الحال بالظبط
            await col.insertMany(docs);

            // كل قرار بيعدي على الذكاء الاصطناعي أولًا (في /api/analyze)، وهو اللي
            // بيقرر لو فيه اسم/كود جديد فعلي مذكور في النص - مش بس لأنواع قرارات
            // محددة. لو الواجهة بعتت sheetUpdate.shouldUpdate=true، نحدّث الشيت.
            let newName = sheetUpdate?.shouldUpdate ? sheetUpdate.newName : null;
            let newCode = sheetUpdate?.shouldUpdate ? sheetUpdate.newCode : null;

            // احتياط: لو الواجهة القديمة بعتت بيانات من غير sheetUpdate، نرجع
            // للطريقة القديمة (البحث عن حقول "الاسم الجديد"/"الكود الجديد")
            if (!newName && !newCode) {
                const newNameField = cleanExtraFields.find(f => f.label.includes('الاسم الجديد'));
                const newCodeField = cleanExtraFields.find(f => f.label.includes('الكود الجديد'));
                if (newNameField?.value) {
                    newName = newNameField.value;
                    newCode = newCodeField?.value || null;
                }
            }

            let sheetUpdateWarning = null;
            if (newName || newCode) {
                const results = await Promise.all(
                    soldierIds.map(id => updateCharacterNameInSheet(id, newName, newCode))
                );
                if (results.some(ok => !ok)) {
                    sheetUpdateWarning = 'تم حفظ القرار، لكن تعذر تحديث الاسم/الكود في شيت جوجل لبعض العساكر (تأكد إنهم موجودين في الشيت أصلاً)';
                }
            }

            res.json({ success: true, message: 'تم حفظ القرار في أرشيف العسكريين بنجاح', warning: sheetUpdateWarning });
        } catch (error) {
            console.error("خطأ في حفظ القرار:", error);
            res.status(500).json({ success: false, error: 'فشل حفظ القرار في النظام' });
        }
    });

    // ===================== وحدة تحكم المستحقات (المكافآت) =====================
    const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

    // "فتح باب المستحقات": بيجيب كل سجلات المكافآت بس (type = المكافأة)
    app.get('/api/rewards', async (req, res) => {
        if (!req.isAuthenticated() || !(await canManageAdmin(req.user.id))) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }
        try {
            const col = await getRecordsCollection();
            const docs = await col.find({ type: 'المكافأة' }).sort({ savedAt: -1 }).toArray();
            const sheetMap = await getRewardsSheetMap();
            const now = Date.now();

            const data = docs.map(d => {
                const info = sheetMap[d.soldierId];
                const soldierDisplay = info && info.name ? (info.code ? `[${info.code}] ${info.name}` : info.name) : d.soldierId;
                const savedTime = d.savedAt ? new Date(d.savedAt).getTime() : 0;

                let status = 'pending';
                if (d.status === 'delivered') status = 'delivered';
                else if (savedTime && (now - savedTime) > FOUR_DAYS_MS) status = 'expired';

                return {
                    id: String(d._id),
                    soldierId: d.soldierId,
                    soldierDisplay,
                    officer: d.officer,
                    reason: d.reason,
                    date: d.date,
                    savedAt: d.savedAt,
                    extraFields: d.extraFields || [],
                    status,
                    deliveredAt: d.deliveredAt || null,
                    deliveredBy: d.deliveredBy || null
                };
            });

            res.json({ success: true, data });
        } catch (error) {
            console.error("خطأ في جلب المستحقات:", error);
            res.status(500).json({ success: false, error: 'فشل جلب سجلات المستحقات' });
        }
    });

    // تسجيل تسليم مكافأة معينة (بتفضل ظاهرة بعلامة "تم التسليم" بدل الزرار)
    app.post('/api/rewards/:id/deliver', async (req, res) => {
        if (!req.isAuthenticated() || !(await canManageAdmin(req.user.id))) {
            return res.status(403).json({ error: 'غير مصرح لك' });
        }
        try {
            const col = await getRecordsCollection();
            const result = await col.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { status: 'delivered', deliveredAt: new Date().toISOString(), deliveredBy: req.user.username } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ success: false, error: 'المكافأة غير موجودة' });
            }
            res.json({ success: true });
        } catch (error) {
            console.error("خطأ في تسجيل تسليم المكافأة:", error);
            res.status(500).json({ success: false, error: 'فشل تسجيل التسليم' });
        }
    });
}
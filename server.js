import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import passport from 'passport';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { setupAuth } from './server/auth.js';
import { setupApiRoutes } from './server/api.js';
import { getSheetData, getCharacterNameFromSheet, getRankFromSheet } from './server/sheets.js';
import { getRecordsCollection } from './server/mongo.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MemoryStore = createMemoryStore(session);
const isProd = process.env.NODE_ENV === 'production';

// ===================== إعدادات الحماية العامة =====================

// SESSION_SECRET لازم ييجي من .env في بيئة الإنتاج - مفيش قيمة افتراضية ثابتة
if (isProd && !process.env.SESSION_SECRET) {
    console.error('خطأ: لازم تحدد SESSION_SECRET في ملف .env قبل تشغيل السيرفر في وضع الإنتاج');
    process.exit(1);
}

// إخفاء هيدر X-Powered-By وإضافة هيدرز حماية قياسية (CSP, HSTS, ...الخ)
app.use(helmet({
    contentSecurityPolicy: false // فعّلها وشكّلها يدويًا لو عايز تتحكم بمصادر السكربتات/الصور بدقة
}));

app.set('trust proxy', 1); // لو السيرفر شغال خلف Nginx / Cloudflare / أي بروكسي

// تحديد عدد الطلبات لمنع الـ brute force و الـ scraping الآلي
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'طلبات كتير جدًا، حاول تاني بعد شوية' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'محاولات دخول كتير، حاول تاني بعد شوية' }
});

app.use('/api', generalLimiter);
app.use('/auth', authLimiter);

app.use(express.json({ limit: '200kb' }));

// حدد نطاق الموقع الحقيقي بتاعك في .env (CORS_ORIGIN=https://yourdomain.com)
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({ checkPeriod: 86400000 }),
    cookie: {
        secure: isProd,       // لازم https في الإنتاج عشان الكوكي يتبعت
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ===================== حماية ملفات المشروع من الوصول المباشر =====================
// المشكلة اللي كانت موجودة: express.static(__dirname) كان بيعرض كل ملفات المشروع
// بما فيها data/soldiers (كل السجلات والبيانات الحساسة) و server.js و package.json و .env
// أي حد يعرف الرابط كان يقدر يفتحها من المتصفح مباشرة من غير تسجيل دخول.
const BLOCKED_PATHS = ['/data', '/server', '/.env', '/server.js', '/build.js', '/js', '/package.json', '/package-lock.json', '/node_modules', '/.git'];
app.use((req, res, next) => {
    const p = req.path;
    if (BLOCKED_PATHS.some(b => p === b || p.startsWith(b + '/'))) {
        return res.status(404).end();
    }
    next();
});

app.use(express.static(__dirname, { dotfiles: 'deny', index: 'index.html' }));

setupAuth(passport);
setupApiRoutes(app);

// ===================== أدوات قراءة البيانات =====================

// بترجع كل السجلات من قاعدة البيانات (بدل ما كانت بتتقرا من ملفات على القرص)
async function readAllRecords() {
    const col = await getRecordsCollection();
    const docs = await col.find({}).toArray();
    return docs.map(d => ({ ...d, typeFolder: d.type, fileName: String(d._id) }));
}

function recordTimestamp(rec) {
    return rec.savedAt ? new Date(rec.savedAt).getTime() : 0;
}

// ===================== ربط الأيدي بالاسم والكود من الشيت =====================
// بدل ما الجدول يعرض رقم الأيدي الخام، بنجيب الاسم/الكود المسجلين في الشيت
// ونحطهم بدل الرقم. النتيجة متخزنة مؤقتًا (كاش) دقيقة واحدة عشان منضربش الشيت
// API على كل ريكوست.

let sheetCache = { data: null, at: 0 };
const SHEET_CACHE_TTL = 60 * 1000; // دقيقة

async function getSheetMap() {
    const now = Date.now();
    if (sheetCache.data && (now - sheetCache.at) < SHEET_CACHE_TTL) {
        return sheetCache.data;
    }
    const map = {};
    try {
        const rows = await getSheetData('A:E');
        (rows || []).forEach(row => {
            const cleanId = row[0] ? String(row[0]).replace(/[^0-9]/g, '') : '';
            if (cleanId) {
                map[cleanId] = {
                    name: row[2] ? String(row[2]).trim() : '',
                    code: row[3] ? String(row[3]).trim() : '',
                    rank: row[4] ? String(row[4]).trim() : ''
                };
            }
        });
    } catch (e) {
        console.error('تعذر تحميل بيانات الشيت:', e.message);
    }
    sheetCache = { data: map, at: now };
    return map;
}

function displayFor(id, sheetMap) {
    const info = sheetMap[id];
    if (!info || !info.name) return { id, name: null, code: null, display: id };
    const display = info.code ? `[${info.code}] ${info.name}` : info.name;
    return { id, name: info.name, code: info.code || null, display };
}

// يحول نص فيه منشنات ديسكورد <@ID> لمصفوفة من الأشخاص (اسم + كود) باستخدام الشيت
function resolveMentions(text, sheetMap) {
    if (!text) return [];
    const ids = [...String(text).matchAll(/<@!?(\d+)>/g)].map(m => m[1]);
    return ids.map(id => displayFor(id, sheetMap));
}

// يضيف لكل سجل: officerInfo (اسم/كود الضابط) و soldiersInfo (اسماء/اكواد العساكر)
// و soldierIdInfo (اسم/كود صاحب السجل نفسه - ده اللي بيتعرض في عمود "العسكري" بالجدول)
async function enrichRecords(records) {
    const sheetMap = await getSheetMap();
    return records.map(rec => {
        const officerPeople = resolveMentions(rec.officer, sheetMap);
        const soldierPeople = resolveMentions(rec.soldier, sheetMap);
        const soldierIdInfo = rec.soldierId ? displayFor(rec.soldierId, sheetMap) : null;
        return {
            ...rec,
            officerInfo: officerPeople[0] || null,
            officerDisplay: officerPeople[0] ? officerPeople[0].display : rec.officer,
            soldiersInfo: soldierPeople,
            soldiersDisplay: soldierPeople.map(s => s.display).join('، '),
            soldierIdInfo,
            soldierIdDisplay: soldierIdInfo ? soldierIdInfo.display : rec.soldierId
        };
    });
}

// ===================== الـ API =====================

app.get('/api/stats', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ success: false, error: 'غير مصرح لك' });
    try {
        const records = await readAllRecords();
        const totalPenalties = records.length;
        const totalOffenders = new Set(records.map(r => r.soldierId)).size;

        const now = new Date();
        const monthlyDecisions = records.filter(r => {
            if (!r.savedAt) return false;
            const d = new Date(r.savedAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;

        const typeBreakdown = {};
        records.forEach(r => {
            const t = r.type || r.typeFolder || 'غير محدد';
            typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
        });

        res.json({
            success: true,
            totalPenalties,
            totalOffenders,
            monthlyDecisions,
            typeBreakdown,
            totalTypes: Object.keys(typeBreakdown).length
        });
    } catch (error) {
        console.error("خطأ في جلب الإحصائيات:", error);
        res.status(500).json({ success: false, message: "خطأ في السيرفر" });
    }
});

app.get('/api/search', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ success: false, error: 'غير مصرح لك' });
    try {
        const query = (req.query.q || '').trim().toLowerCase();
        if (!query) return res.json({ success: true, data: [] });

        const matched = (await readAllRecords())
            .filter(rec => rec.soldierId.toLowerCase().includes(query) || JSON.stringify(rec).toLowerCase().includes(query))
            .sort((a, b) => recordTimestamp(b) - recordTimestamp(a));

        res.json({ success: true, data: await enrichRecords(matched) });
    } catch (error) {
        console.error("خطأ في البحث:", error);
        res.status(500).json({ success: false, message: "فشل البحث في السجلات" });
    }
});

app.get('/api/records', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ success: false, error: 'غير مصرح لك' });
    try {
        const { q = '', type = '', officer = '', soldier = '', dateFrom = '', dateTo = '', page = '1', limit = '10', sort = 'desc' } = req.query;

        const all = await readAllRecords();
        const types = [...new Set(all.map(r => r.type || r.typeFolder).filter(Boolean))];

        const qLower = q.trim().toLowerCase();
        const officerLower = officer.trim().toLowerCase();
        const soldierLower = soldier.trim().toLowerCase();

        let filtered = all.filter(rec => {
            if (type && (rec.type || rec.typeFolder) !== type) return false;
            if (officerLower && !String(rec.officer || '').toLowerCase().includes(officerLower)) return false;
            if (soldierLower && !(rec.soldierId.toLowerCase().includes(soldierLower) || String(rec.soldier || '').toLowerCase().includes(soldierLower))) return false;
            if (qLower && !JSON.stringify(rec).toLowerCase().includes(qLower)) return false;
            if (dateFrom) {
                const from = new Date(dateFrom).getTime();
                if (!isNaN(from) && recordTimestamp(rec) < from) return false;
            }
            if (dateTo) {
                const to = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1;
                if (!isNaN(to) && recordTimestamp(rec) > to) return false;
            }
            return true;
        });

        filtered.sort((a, b) => sort === 'asc' ? recordTimestamp(a) - recordTimestamp(b) : recordTimestamp(b) - recordTimestamp(a));

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const start = (pageNum - 1) * limitNum;

        const pageRecords = filtered.slice(start, start + limitNum);

        res.json({
            success: true,
            data: await enrichRecords(pageRecords),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            types
        });
    } catch (error) {
        console.error("خطأ في جلب السجلات:", error);
        res.status(500).json({ success: false, message: "فشل جلب السجلات" });
    }
});

app.get('/api/soldiers', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ success: false, error: 'غير مصرح لك' });
    try {
        const { q = '', page = '1', limit = '12' } = req.query;

        const allRecords = await readAllRecords();
        const bySoldier = {};
        allRecords.forEach(r => {
            if (!r.soldierId) return;
            if (!bySoldier[r.soldierId]) bySoldier[r.soldierId] = { id: r.soldierId, totalRecords: 0, typesCount: {}, lastSavedAt: null };
            const s = bySoldier[r.soldierId];
            s.totalRecords += 1;
            const t = r.type || r.typeFolder || 'غير محدد';
            s.typesCount[t] = (s.typesCount[t] || 0) + 1;
            if (r.savedAt && (!s.lastSavedAt || new Date(r.savedAt) > new Date(s.lastSavedAt))) {
                s.lastSavedAt = r.savedAt;
            }
        });

        let soldiers = Object.values(bySoldier);

        try {
            const sheetMap = await getSheetMap();
            soldiers = soldiers.map(s => {
                const info = sheetMap[s.id];
                const rpName = info && info.name ? (info.code ? `[${info.code}] ${info.name}` : info.name) : null;
                return { ...s, rpName, rank: info ? info.rank || null : null };
            });
        } catch (e) {
        }

        const qLower = q.trim().toLowerCase();
        let filtered = soldiers.filter(s => !qLower || s.id.includes(qLower) || (s.rpName && s.rpName.toLowerCase().includes(qLower)));
        filtered.sort((a, b) => {
            const ta = a.lastSavedAt ? new Date(a.lastSavedAt).getTime() : 0;
            const tb = b.lastSavedAt ? new Date(b.lastSavedAt).getTime() : 0;
            return tb - ta;
        });

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / limitNum));
        const start = (pageNum - 1) * limitNum;

        res.json({ success: true, data: filtered.slice(start, start + limitNum), total, page: pageNum, limit: limitNum, totalPages });
    } catch (error) {
        console.error("خطأ في جلب قائمة الأعضاء:", error);
        res.status(500).json({ success: false, message: "فشل جلب قائمة الأعضاء" });
    }
});

app.get('/api/soldiers/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(403).json({ success: false, error: 'غير مصرح لك' });
    try {
        const soldierId = req.params.id.replace(/[^0-9]/g, '');
        if (!soldierId) {
            return res.status(404).json({ success: false, message: 'لا توجد سجلات لهذا العسكري' });
        }

        const col = await getRecordsCollection();
        const found = await col.find({ soldierId }).toArray();

        if (found.length === 0) {
            return res.status(404).json({ success: false, message: 'لا توجد سجلات لهذا العسكري' });
        }

        const typesCount = {};
        found.forEach(r => {
            const t = r.type || 'غير محدد';
            typesCount[t] = (typesCount[t] || 0) + 1;
        });

        let records = found.map(r => ({ ...r, typeFolder: r.type }));
        records.sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
        records = await enrichRecords(records);

        let rpName = null, rank = null;
        try {
            rpName = await getCharacterNameFromSheet(soldierId);
            rank = await getRankFromSheet(soldierId);
        } catch (e) {}

        res.json({ success: true, id: soldierId, rpName, rank, totalRecords: records.length, typesCount, data: records });
    } catch (error) {
        console.error("خطأ في جلب بيانات العسكري:", error);
        res.status(500).json({ success: false, message: "فشل جلب بيانات العسكري" });
    }
});

app.get('/auth/discord', (req, res, next) => {
    if (req.query.rpName) req.session.rpName = req.query.rpName;
    passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: '/index.html?error=not_in_sheet'
}), (req, res) => {
    res.redirect('/index.html');
});

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/index.html');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل بكفاءة على الرابط: http://localhost:${PORT}`);
});

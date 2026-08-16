import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDENTIALS_PATH = path.join(__dirname, '..', 'data', 'system', 'credentials.json');

// على Render (وأي استضافة سحابية) مفيش ملف credentials.json فعليًا (متعمد - الملف
// ده حساس ومش بيترفع على GitHub). لازم تحط *محتوى* الملف كامل كمتغير بيئة.
// أفضل طريقة: GOOGLE_SERVICE_ACCOUNT_BASE64 (نسخة Base64 من الملف - آمنة من أي
// تقصيص أو غلط وقت اللصق لأنها حروف وأرقام بس من غير علامات تنصيص أو أسطر).
// أو بديل: GOOGLE_SERVICE_ACCOUNT_JSON (نص الملف الخام - أكتر عرضة للتقصيص).
// على جهازك محليًا، بيستخدم الملف عادي لو موجود.
function getGoogleCredentials() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
        const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        return JSON.parse(decoded);
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    if (fs.existsSync(CREDENTIALS_PATH)) {
        return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    }
    throw new Error('لازم تحدد GOOGLE_SERVICE_ACCOUNT_BASE64 في متغيرات البيئة أو تحط ملف data/system/credentials.json محليًا');
}

async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleCredentials(),
        // Read + Write - محتاجين الكتابة عشان نقدر نحدّث الاسم في الشيت من الموقع
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
}

async function getSheetName(googleSheets) {
    const meta = await googleSheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    return meta.data.sheets[0].properties.title;
}

export async function getSheetData(range = 'A:Z') {
    try {
        const googleSheets = await getSheetsClient();
        const sheetName = await getSheetName(googleSheets);

        const response = await googleSheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
        });
        return response.data.values || [];
    } catch (error) {
        console.error("خطأ في جلب بيانات جوجل شيت:", error.message);
        return [];
    }
}

// بتدور على رقم الصف بتاع عسكري معين في الشيت (عشان نقدر نحدّث خلاياه)
// بترجع null لو مالقتوش
async function findRowNumberByDiscordId(discordId) {
    const rows = await getSheetData('A:A');
    const cleanTargetId = String(discordId).replace(/[^0-9]/g, '');
    for (let i = 0; i < rows.length; i++) {
        const cleanSheetId = rows[i][0] ? String(rows[i][0]).replace(/[^0-9]/g, '') : '';
        if (cleanSheetId && cleanSheetId === cleanTargetId) {
            return i + 1; // أرقام صفوف الشيت بتبدأ من 1 مش 0
        }
    }
    return null;
}

// بتحدّث اسم (وكود لو اتبعت) العسكري في عمودي C و D في الشيت مباشرة.
// بتترجع true لو نجحت، false لو العسكري مش موجود في الشيت أو حصل خطأ.
export async function updateCharacterNameInSheet(discordId, newName, newCode = null) {
    try {
        const rowNumber = await findRowNumberByDiscordId(discordId);
        if (!rowNumber) {
            console.error(`تحديث الاسم فشل: العسكري ${discordId} مش موجود في الشيت`);
            return false;
        }

        const googleSheets = await getSheetsClient();
        const sheetName = await getSheetName(googleSheets);

        const data = [{ range: `${sheetName}!C${rowNumber}`, values: [[newName]] }];
        if (newCode !== null && newCode !== undefined && newCode !== '') {
            data.push({ range: `${sheetName}!D${rowNumber}`, values: [[newCode]] });
        }

        await googleSheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data }
        });

        return true;
    } catch (error) {
        console.error("خطأ أثناء تحديث الاسم في الشيت:", error.message);
        return false;
    }
}

export async function getCharacterNameFromSheet(discordId) {
    try {
        const rows = await getSheetData('A:Q'); 
        if (!rows || rows.length === 0) return null;

        const cleanTargetId = String(discordId).replace(/[^0-9]/g, '');

        for (const row of rows) {
            const sheetDiscordIdCell = row[0] ? String(row[0]) : '';
            const sheetCharacterName = row[2]; 
            const sheetCode = row[3];          

            const cleanSheetId = sheetDiscordIdCell.replace(/[^0-9]/g, '');

            if (cleanSheetId && cleanSheetId === cleanTargetId) {
                const name = sheetCharacterName ? sheetCharacterName.trim() : '';
                const code = sheetCode ? sheetCode.trim() : '';

                if (code && name) {
                    return `\u200E[${code}] ${name}`;
                } else {
                    return name || null;
                }
            }
        }
    } catch (error) {
        console.error("خطأ أثناء البحث عن الاسم والكود في الشيت:", error);
    }
    return null;
}

export async function getRankFromSheet(discordId) {
    try {
        const rows = await getSheetData('A:E'); 
        if (!rows || rows.length === 0) return null;

        const cleanTargetId = String(discordId).replace(/[^0-9]/g, '');

        for (const row of rows) {
            const sheetDiscordIdCell = row[0] ? String(row[0]) : '';
            const sheetRank = row[4]; 

            const cleanSheetId = sheetDiscordIdCell.replace(/[^0-9]/g, '');

            if (cleanSheetId && cleanSheetId === cleanTargetId) {
                return sheetRank ? sheetRank.trim() : null;
            }
        }
    } catch (error) {
        console.error("خطأ أثناء البحث عن الرتبة في الشيت:", error);
    }
    return null;
}

export async function getPermFromSheet(discordId) {
    try {
        const rows = await getSheetData('A:Z'); 
        if (!rows || rows.length < 1) return '';

        const cleanTargetId = String(discordId).replace(/[^0-9]/g, '');

        for (let i = 0; i < rows.length; i++) {
            if (i >= 2 && i <= 8) continue; 

            const row = rows[i];
            const sheetDiscordIdCell = row[0] ? String(row[0]) : '';
            const cleanSheetId = sheetDiscordIdCell.replace(/[^0-9]/g, '');

            if (cleanSheetId && cleanSheetId === cleanTargetId) {
                const valLegalAffairs = row[14]; 
                const valInvestigator = row[15]; 
                const valJudge = row[16];        

                const isTrue = (val) => {
                    if (val === true) return true;
                    if (typeof val === 'string') {
                        const upper = val.trim().toUpperCase();
                        if (upper === 'TRUE' || upper === 'صح' || upper === '1') return true;
                    }
                    return false;
                };

                let activePerms = [];
                if (isTrue(valJudge)) activePerms.push('قاضي عسكري');
                if (isTrue(valInvestigator)) activePerms.push('محقق الشؤون القانونية');
                if (isTrue(valLegalAffairs)) activePerms.push('الشؤون القانونية');

                if (activePerms.length > 0) return activePerms.join(' - '); 
                return ''; 
            }
        }
    } catch (error) {
        console.error("خطأ أثناء البحث عن الصلاحية في الشيت:", error);
    }
    return '';
}
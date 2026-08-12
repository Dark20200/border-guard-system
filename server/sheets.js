import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function getSheetData(range = 'A:Z') {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '..', 'data', 'system', 'credentials.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: 'v4', auth: client });

        const meta = await googleSheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const sheetName = meta.data.sheets[0].properties.title;

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
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_DB_PATH = path.join(__dirname, '..', 'data', 'system', 'users_status.json');
const OWNER_DISCORD_ID = "450047099288027146";

export function getUsersDB() {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const systemDir = path.join(dataDir, 'system');
    if (!fs.existsSync(systemDir)) {
        fs.mkdirSync(systemDir, { recursive: true });
    }
    if (!fs.existsSync(USERS_DB_PATH)) {
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf8'));
}

export function saveUsersDB(data) {
    const dataDir = path.join(__dirname, '..', 'data', 'system');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(data, null, 2));
}

export function canManageAdmin(userId) {
    if (userId === OWNER_DISCORD_ID) return true;
    const db = getUsersDB();
    const rank = db[userId]?.rank;
    const perm = db[userId]?.perm;
    return db[userId]?.status === 'approved' && (
        (rank && (rank.includes('قائد حرس الحدود') || rank.includes('نائب قائد حرس الحدود'))) ||
        (perm && (perm.includes('قائد حرس الحدود') || perm.includes('نائب قائد حرس الحدود')))
    );
}

export function canModifyRecords(userId) {
    if (userId === OWNER_DISCORD_ID) return true;
    const db = getUsersDB();
    const rank = db[userId]?.rank;
    const perm = db[userId]?.perm;
    return db[userId]?.status === 'approved' && (
        (rank && (rank.includes('قائد') || rank.includes('نائب') || rank.includes('قاضي عسكري'))) ||
        (perm && (perm.includes('قائد') || perm.includes('نائب') || perm.includes('قاضي عسكري')))
    );
}

export { OWNER_DISCORD_ID };
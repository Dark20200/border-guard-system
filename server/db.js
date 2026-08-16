import { getUsersCollection } from './mongo.js';

const OWNER_DISCORD_ID = "450047099288027146";

// بترجع نفس الشكل القديم بالظبط: { userId: { status, rank, perm, ... }, ... }
// عشان كل الكود اللي بيستخدمها من قبل يفضل شغال زي ما هو من غير تعديل كبير
export async function getUsersDB() {
    const col = await getUsersCollection();
    const docs = await col.find({}).toArray();
    const out = {};
    for (const doc of docs) {
        const { _id, ...rest } = doc;
        out[_id] = rest;
    }
    return out;
}

// بتاخد نفس الشكل القديم (object فيه كل المستخدمين) وتحفظه في قاعدة البيانات
export async function saveUsersDB(data) {
    const col = await getUsersCollection();
    const ops = Object.entries(data).map(([id, val]) => ({
        updateOne: { filter: { _id: id }, update: { $set: val }, upsert: true }
    }));
    if (ops.length) await col.bulkWrite(ops);
}

export async function canManageAdmin(userId) {
    if (userId === OWNER_DISCORD_ID) return true;
    const db = await getUsersDB();
    const rank = db[userId]?.rank;
    const perm = db[userId]?.perm;
    return db[userId]?.status === 'approved' && (
        (rank && (rank.includes('قائد حرس الحدود') || rank.includes('نائب قائد حرس الحدود'))) ||
        (perm && (perm.includes('قائد حرس الحدود') || perm.includes('نائب قائد حرس الحدود')))
    );
}

export async function canModifyRecords(userId) {
    if (userId === OWNER_DISCORD_ID) return true;
    const db = await getUsersDB();
    const rank = db[userId]?.rank;
    const perm = db[userId]?.perm;
    return db[userId]?.status === 'approved' && (
        (rank && (rank.includes('قائد') || rank.includes('نائب') || rank.includes('قاضي عسكري'))) ||
        (perm && (perm.includes('قائد') || perm.includes('نائب') || perm.includes('قاضي عسكري')))
    );
}

export { OWNER_DISCORD_ID };
